const express = require('express');
const router = express.Router();
const UAParser = require('ua-parser-js');
const contactsService = require('../services/contacts.service');
const trackingService = require('../services/tracking.service');
const { databasePool } = require('../config/database.config');
const { verifyCname, normalizeDomain } = require('../utils/dns-helper');

// Ya no necesitamos IDs de tenant
const DEFAULT_TRACKING_ID = 'default';

function extractTrackingHostname(req) {
  const candidates = [
    req.headers['x-forwarded-host'],
    req.headers['x-original-host'],
    req.headers['cf-original-host'],
    req.headers.host,
    req.get ? req.get('host') : undefined
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const host = String(candidate)
      .split(',')[0]
      .trim()
      .replace(/:\d+$/, '')
      .toLowerCase();
    if (host) {
      return host;
    }
  }

  return null;
}

// =============================================================================
// TRACKING AVANZADO (TIPO HYROS)
// =============================================================================
// - Captura TODOS los parámetros de tracking
// - Visitor ID persistente en localStorage
// - Session management con timeout
// - Attribution multitouch completo
// =============================================================================

// EN DESARROLLO NO NECESITAMOS CORS - YA ESTÁ CONFIGURADO GLOBALMENTE EN server.js

// =============================================================================
// GET /api/tracking/sessions - Obtener sesiones para analytics
// =============================================================================
router.get('/sessions', async (req, res) => {
  console.log('📊 Fetching tracking sessions for analytics');

  try {
    const { start, end, filters } = req.query;

    // Validar fechas
    const startDate = start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end || new Date().toISOString().split('T')[0];

    // Agn\u00f3stico: Parse de filtros múltiples si vienen
    let parsedFilters = {};
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch (e) {
        console.log('⚠️ Error parseando filtros, usando ninguno');
      }
    }

    // IMPORTANTE: Las fechas en DB están en UTC
    // El frontend envía fechas en formato YYYY-MM-DD del timezone configurado
    // Usar el timezone del usuario desde el middleware o el header
    const timezone = req.userTimezone || req.headers['x-user-timezone'] || 'America/Mexico_City';

    // Agn\u00f3stico: Construir query con filtros dinámicos
    let whereClauses = [
      'DATE(created_at) >= $1',
      'DATE(created_at) <= $2'
    ];
    let queryParams = [startDate, endDate];
    let paramCounter = 3;

    // Agregar filtros dinámicamente si existen
    if (Object.keys(parsedFilters).length > 0) {
      for (const [field, values] of Object.entries(parsedFilters)) {
        if (!Array.isArray(values) || values.length === 0) continue;

        // Mapear campos del frontend a campos de la DB
        let dbField = field;
        if (field === 'landing_url') {
          // Para páginas, necesitamos hacer un LIKE o extraer el nombre de la página
          const pageConditions = values.map(value => {
            queryParams.push(`%/${value}%`);
            return `landing_url LIKE $${paramCounter++}`;
          });
          whereClauses.push(`(${pageConditions.join(' OR ')})`);
        } else {
          // Para otros campos, usar IN
          const placeholders = values.map((_, i) => `$${paramCounter + i}`).join(', ');
          queryParams.push(...values);
          paramCounter += values.length;
          whereClauses.push(`${dbField} IN (${placeholders})`);
        }
      }
    }

    const query = `
      SELECT
        session_id,
        visitor_id,
        contact_id,
        event_name,
        started_at,
        created_at,
        landing_url,
        landing_host,
        referrer_url,
        referrer_domain,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        channel,
        source_platform,
        placement,
        device_type,
        os,
        browser,
        geo_country,
        geo_city,
        pageviews_count,
        events_count,
        is_bounce,
        properties
      FROM tracking.sessions
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    console.log('🔍 Query con filtros:', { filters: parsedFilters, paramCount: queryParams.length });
    const result = await databasePool.query(query, queryParams);

    console.log(`✅ Found ${result.rows.length} sessions between ${startDate} and ${endDate} (timezone: ${timezone})`);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching tracking sessions:', error);
    res.status(500).json({
      error: 'Error al obtener sesiones de tracking',
      details: error.message
    });
  }
});

// =============================================================================
// GET /snip.js - Servir el script de tracking minificado
// =============================================================================
router.get('/snip.js', (req, res) => {
  const sid = req.query.s || DEFAULT_TRACKING_ID;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = extractTrackingHostname(req) || req.get('host');

  // Script MEJORADO con auto-append de visitor_id a URLs
  const script = `!function(){
// MODO STEALTH: Si tienes ?notrack=true en la URL, no se ejecuta NADA
if(location.search.includes('notrack=true')||location.hash.includes('notrack=true')){
console.log("[HT] 🥷 Modo stealth activado - Sin tracking");
return;
}
var e="${sid}",t="${protocol}://${host}",a=localStorage,s=sessionStorage,i=Date.now(),
c=function(e){var t=RegExp("[?&]"+e+"=([^&]*)").exec(location.search);return t&&decodeURIComponent(t[1].replace(/\\+/g," "))},
l=function(e){var t="; "+document.cookie,n=t.split("; "+e+"=");return 2===n.length?n.pop().split(";").shift():null};
// NUEVO: Función para setear cookies con expiración larga (agnóstico: guardamos la puta cookie)
var setCookie=function(name,value,days){
  var expires="";
  if(days){var date=new Date();date.setTime(date.getTime()+(days*24*60*60*1000));expires="; expires="+date.toUTCString()}
  document.cookie=name+"="+value+expires+"; path=/; SameSite=Lax";
};
// NUEVO SISTEMA: Todo en una sola key "rstk_local" como _ud
var rstkLocal=null;
try{rstkLocal=JSON.parse(a.getItem("rstk_local")||"{}")}catch(e){rstkLocal={}}
// CRÍTICO: Buscar visitor_id en este orden de prioridad (agnóstico: el que encuentre primero)
var existingVid=null;
// 1. Primero checar la URL
existingVid=c("rstk_vid")||c("vid");
// 2. Si no está en URL, checar localStorage
if(!existingVid&&rstkLocal.visitor_id){
  existingVid=rstkLocal.visitor_id;
}
// 3. Si no está en localStorage, checar cookies (agnóstico: respaldo de cookies)
if(!existingVid){
  existingVid=l("rstk_vid")||l("rstk_visitor");
}
// 4. Si encontramos uno existente, úsalo. Si no, crea uno nuevo
if(existingVid){
  // Visitor recurrente detectado!
  rstkLocal.visitor_id=existingVid;
  if(!rstkLocal.first_visit){
    rstkLocal.first_visit=new Date().toISOString();
  }
  rstkLocal.session_count=(rstkLocal.session_count||0)+1;
  console.log("[HT] 🔄 Visitor recurrente:",existingVid);
}else{
  // Nuevo visitor
  rstkLocal.visitor_id="v"+i+"_"+Math.random().toString(36).substring(2,9);
  rstkLocal.first_visit=new Date().toISOString();
  rstkLocal.session_count=1;
  console.log("[HT] 🆕 Nuevo visitor:",rstkLocal.visitor_id);
}
// IMPORTANTE: Sincronizar visitor_id en TODOS los storages (agnóstico: guardar en todos lados)
a.setItem("rstk_local",JSON.stringify(rstkLocal));
setCookie("rstk_vid",rstkLocal.visitor_id,3650); // Cookie de 10 años (prácticamente permanente)
setCookie("rstk_visitor",rstkLocal.visitor_id,3650); // Cookie backup con otro nombre
// Manejar sesiones
var lastActivity=rstkLocal.last_activity?new Date(rstkLocal.last_activity).getTime():0;
var sessionId=s.getItem("rstk_session_id");
var sessionStart=s.getItem("rstk_session_start");
// Nueva sesión si: no hay sesión actual O han pasado más de 30 minutos
if(!sessionId||!lastActivity||i-lastActivity>18e5){
  sessionId="s"+i+"_"+Math.random().toString(36).substring(2,9);
  s.setItem("rstk_session_id",sessionId);
  s.setItem("rstk_session_start",i.toString()); // Guardar timestamp de inicio
  sessionStart=i;
  if(lastActivity){rstkLocal.session_count=(rstkLocal.session_count||1)+1}
}else{
  // Sesión existente, recuperar inicio
  sessionStart=parseInt(sessionStart||i);
}
// Actualizar última actividad
rstkLocal.last_activity=new Date().toISOString();
rstkLocal.current_session=sessionId;
// Guardar todo en rstk_local
a.setItem("rstk_local",JSON.stringify(rstkLocal));
// Variables para el resto del script
var u=rstkLocal.visitor_id,g=sessionId,m=rstkLocal.session_count;
// Obtener el dominio del script dinámicamente
var y=document.currentScript||document.querySelector('script[src*="snip.js"]'),w=((y?y.src:t+"/snip.js").split("?")[0]||"").replace(/\\/snip\\.js$/,""),x=(w||t)+"/collect";
// Solo un log simple de inicialización
console.log("[HT] Tracking activo:",u);

// CRÍTICO: Inyectar rstk_vid en URL INMEDIATAMENTE si no está presente
if(!c("rstk_vid")&&!c("vid")){
  var currentUrl=new URL(location.href);
  currentUrl.searchParams.set('rstk_vid',u);
  // Usar replaceState para no crear entrada en historial
  history.replaceState(null,'',currentUrl.toString());
}

// NUEVO: Función para agregar rstk_vid a URLs
var addVidToUrl=function(url){
try{
var parsedUrl=new URL(url,location.href);
// Solo modificamos URLs del mismo dominio
if(parsedUrl.hostname!==location.hostname)return url;
// Si ya tiene rstk_vid, no lo duplicamos
if(parsedUrl.searchParams.get('rstk_vid'))return url;
parsedUrl.searchParams.set('rstk_vid',u);
return parsedUrl.toString();
}catch(e){return url}
};
// NUEVO: Interceptar clicks en links
document.addEventListener('click',function(e){
var target=e.target;
// Buscar el link más cercano
while(target&&target!==document&&target.tagName!=='A'){
target=target.parentNode;
}
if(target&&target.tagName==='A'&&target.href){
var newHref=addVidToUrl(target.href);
if(newHref!==target.href){
target.href=newHref;
console.log("[HT] 🔗 Link actualizado con rstk_vid");
}
}
},true);
// NUEVO: Actualizar links existentes y observar nuevos
var updateAllLinks=function(){
var links=document.querySelectorAll('a[href]');
links.forEach(function(link){
if(!link.dataset.htProcessed){
link.dataset.htProcessed='true';
var originalHref=link.href;
if(originalHref&&originalHref.indexOf(location.hostname)>-1){
link.href=addVidToUrl(originalHref);
}
}
});
};
// Observar cambios en el DOM
var domObserver=new MutationObserver(function(){updateAllLinks()});
if(document.body){
domObserver.observe(document.body,{childList:true,subtree:true});
updateAllLinks();
}else{
document.addEventListener('DOMContentLoaded',function(){
domObserver.observe(document.body,{childList:true,subtree:true});
updateAllLinks();
});
}
// MEJORADO: Actualizar URL actual y TODOS los links con reintentos agresivos
var injectRstkVidToUrls=function(){
// 1. Actualizar la URL actual si no tiene rstk_vid
if(!c("rstk_vid")&&!c("vid")&&!c("visitor_id")){
try{
var currentUrl=new URL(location.href);
if(!currentUrl.searchParams.has('rstk_vid')){
currentUrl.searchParams.set('rstk_vid',u);
history.replaceState(null,'',currentUrl.toString());
// Quitado log de URL actualizada
}
}catch(e){}
}
// 2. Actualizar TODOS los links en la página
var allLinks=document.querySelectorAll('a[href]');
allLinks.forEach(function(link){
try{
var linkUrl=new URL(link.href,location.href);
// Solo modificar links internos o del mismo dominio
if(linkUrl.hostname===location.hostname||linkUrl.hostname.includes('ghl')||linkUrl.hostname.includes('clickfunnels')){
if(!linkUrl.searchParams.has('rstk_vid')){
linkUrl.searchParams.set('rstk_vid',u);
link.href=linkUrl.toString();
// Quitado log de links actualizados
}
}
}catch(e){}
});
// 3. Actualizar iframes (importante para GHL embebido)
var allIframes=document.querySelectorAll('iframe[src]');
allIframes.forEach(function(iframe){
try{
var iframeSrc=new URL(iframe.src,location.href);
if(!iframeSrc.searchParams.has('rstk_vid')){
iframeSrc.searchParams.set('rstk_vid',u);
iframe.src=iframeSrc.toString();
// Quitado log de iframe
}
}catch(e){}
});
};
// INTELIGENTE: Reintentos espaciados para páginas lentas
var urlAttempts=0;
var urlInterval=setInterval(function(){
urlAttempts++;
injectRstkVidToUrls();
// Quitados logs de intentos de URLs
if(urlAttempts>=15){// 15 intentos = 45 segundos total
clearInterval(urlInterval);
}
},3000);// Cada 3 segundos
// Ejecutar inmediatamente
injectRstkVidToUrls();
// ROBUSTO: Lista configurable de selectores en orden de prioridad
var rstkSelectors=[
  'input[data-q="rstk_vid"]',  // GHL usa data-q como identificador real
  'input[name="rstk_vid"]',
  'input[name="custom_values[rstk_vid]"]',
  'input[name="contact.rstk_vid"]',
  'input[name*="custom_fields"][name*="rstk"]',
  'input[name*="customField"][name*="rstk"]',
  'input[data-custom-field*="rstk"]',
  'input[placeholder*="rstk_vid"]',
  'input[placeholder="rstk_vid"]'  // Exacto también
];

// MEJORADO: Función para setear valor con eventos completos
var setInputValue=function(input,value){
  if(!input||input.value===value)return false;
  // Setear el valor
  input.value=value;
  // Disparar TODOS los eventos posibles para máxima compatibilidad
  ['input','change','blur','keyup'].forEach(function(eventName){
    var event=new Event(eventName,{bubbles:true,cancelable:true});
    input.dispatchEvent(event);
  });
  // También intentar con CustomEvent para builders específicos
  try{
    input.dispatchEvent(new CustomEvent('value-changed',{bubbles:true,detail:{value:value}}));
  }catch(e){}
  return true;
};

// CRÍTICO: Inyección robusta en formularios con múltiples estrategias
var injectRstkVidToForms=function(){
  var injected=false;

  // 1. Buscar inputs con selectores configurables
  rstkSelectors.forEach(function(selector){
    try{
      var inputs=document.querySelectorAll(selector);
      inputs.forEach(function(input){
        if(!input.value||input.value===''){
          if(setInputValue(input,u)){
            injected=true;
          }
        }
      });
    }catch(e){}
  });

  // 2. Buscar TODOS los forms y agregar hidden input si no existe
  var allForms=document.querySelectorAll('form');
  allForms.forEach(function(form){
    // Verificar si ya tiene algún input de tracking
    var hasTracking=false;
    rstkSelectors.forEach(function(selector){
      if(form.querySelector(selector))hasTracking=true;
    });

    if(!hasTracking){
      // Crear input hidden
      var hiddenInput=document.createElement('input');
      hiddenInput.type='hidden';
      hiddenInput.name='rstk_vid';
      hiddenInput.value=u;
      form.appendChild(hiddenInput);
      injected=true;
    }

    // 3. También actualizar action URL del form
    if(form.action&&!form.action.includes('rstk_vid')){
      try{
        var actionUrl=new URL(form.action,location.href);
        actionUrl.searchParams.set('rstk_vid',u);
        form.action=actionUrl.toString();
      }catch(e){}
    }
  });

  return injected;
};
// BLINDAJE PRE-SUBMIT: Capturar submit ANTES que otros handlers
document.addEventListener('submit',function(e){
  // Última oportunidad para inyectar rstk_vid
  if(e.target&&e.target.tagName==='FORM'){
    var form=e.target;
    var hasValue=false;

    // Verificar si algún input tiene el valor
    rstkSelectors.forEach(function(selector){
      var input=form.querySelector(selector);
      if(input&&input.value){
        hasValue=true;
      }else if(input&&!input.value){
        // Setear valor justo antes de enviar
        setInputValue(input,u);
        hasValue=true;
      }
    });

    // Si no tiene ningún input, crear uno
    if(!hasValue){
      var panicInput=document.createElement('input');
      panicInput.type='hidden';
      panicInput.name='rstk_vid';
      panicInput.value=u;
      form.appendChild(panicInput);
    }
  }
},true); // useCapture=true para ejecutar ANTES que otros listeners

// HOOKS PARA WIDGETS TARDÍOS: Escuchar eventos de builders
var widgetEvents=['page_widgets_ready','hl_page_init','DOMContentLoaded','load'];
widgetEvents.forEach(function(eventName){
  window.addEventListener(eventName,function(){
    setTimeout(injectRstkVidToForms,100);
  });
});

// ESTRATEGIA DE REINTENTOS INTELIGENTE
// Inmediato
injectRstkVidToForms();

// Reintento rápido para in-app browsers
setTimeout(injectRstkVidToForms,800);

// Reintentos periódicos para widgets dinámicos
var attemptCount=0;
var maxAttempts=10;
var injectInterval=setInterval(function(){
  attemptCount++;
  injectRstkVidToForms();
  if(attemptCount>=maxAttempts){
    clearInterval(injectInterval);
  }
},2000); // Cada 2 segundos por 10 veces = 20 segundos
// MEJORADO: Observar TODOS los cambios en el DOM para formularios Y links nuevos
var domChangeObserver=new MutationObserver(function(mutations){
var hasNewElements=mutations.some(function(mutation){
return Array.from(mutation.addedNodes).some(function(node){
return node.nodeType===1&&(
node.tagName==='FORM'||
node.tagName==='INPUT'||
node.tagName==='A'||
node.tagName==='IFRAME'||
(node.querySelector&&(node.querySelector('form')||node.querySelector('input')||node.querySelector('a')||node.querySelector('iframe')))
);
});
});
if(hasNewElements){
// Quitado log de nuevos elementos
setTimeout(function(){
injectRstkVidToForms();
injectRstkVidToUrls();
},100);
}
});
if(document.body){
domChangeObserver.observe(document.body,{childList:true,subtree:true,attributes:true});
}else{
document.addEventListener('DOMContentLoaded',function(){
domChangeObserver.observe(document.body,{childList:true,subtree:true,attributes:true});
injectRstkVidToForms();
injectRstkVidToUrls();
});
}
// FINGERPRINTING FUNCTIONS - Genera huellas únicas del dispositivo
var getCanvasFp=function(){try{
var canvas=document.createElement('canvas');
canvas.width=280;
canvas.height=60;
var ctx=canvas.getContext('2d');
// Usar múltiples técnicas para crear un fingerprint único
ctx.textBaseline='top';
ctx.font='14px Arial';
ctx.textBaseline='alphabetic';
ctx.fillStyle='#f60';
ctx.fillRect(125,1,62,20);
ctx.fillStyle='#069';
// Texto con caracteres especiales que se renderizan diferente
ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃🎨',2,15);
ctx.fillStyle='rgba(102,204,0,0.7)';
ctx.fillText('Cwm fjordbank glyphs vext quiz, 😃🎨',4,17);
// Agregar arco y gradiente para más unicidad
var gradient=ctx.createLinearGradient(0,0,canvas.width,canvas.height);
gradient.addColorStop(0,'red');
gradient.addColorStop(0.5,'green');
gradient.addColorStop(1,'blue');
ctx.fillStyle=gradient;
ctx.arc(50,50,20,0,Math.PI*2,true);
ctx.fill();
// Tomar más caracteres del hash para mayor unicidad
return canvas.toDataURL();
}catch(e){return null}};
var getWebGLFp=function(){try{
var canvas=document.createElement('canvas');
var gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
if(!gl)return null;
var debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
if(debugInfo){
return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
}
return gl.getParameter(gl.RENDERER);
}catch(e){return null}};
var getAudioFp=function(){try{
// Audio fingerprinting mejorado
var AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext)return null;
var context=new AudioContext();
var oscillator=context.createOscillator();
var analyser=context.createAnalyser();
var gainNode=context.createGain();
var scriptProcessor=context.createScriptProcessor(4096,1,1);
// Configurar nodos de audio con valores específicos
oscillator.type='triangle';
oscillator.frequency.value=10000;
gainNode.gain.value=0;
oscillator.connect(analyser);
analyser.connect(scriptProcessor);
scriptProcessor.connect(gainNode);
gainNode.connect(context.destination);
oscillator.start(0);
// Capturar propiedades únicas del contexto de audio
var audioData={
sampleRate:context.sampleRate,
channelCount:context.destination.channelCount,
maxChannels:context.destination.maxChannelCount,
baseLatency:context.baseLatency||0,
outputLatency:context.outputLatency||0,
state:context.state,
// Propiedades del analyser
fftSize:analyser.fftSize,
minDecibels:analyser.minDecibels,
maxDecibels:analyser.maxDecibels,
smoothing:analyser.smoothingTimeConstant
};
// Limpiar
oscillator.stop(0);
oscillator.disconnect();
analyser.disconnect();
scriptProcessor.disconnect();
gainNode.disconnect();
context.close();
// Crear hash de todas las propiedades
return JSON.stringify(audioData);
}catch(e){return null}};
var getFontsFp=function(){try{
var fonts=['monospace','sans-serif','serif'];
var testString='mmmmmmmmmmlli';
var baseFonts={};
var s=document.createElement('span');
s.style.fontSize='72px';
s.innerHTML=testString;
document.body.appendChild(s);
for(var i=0;i<fonts.length;i++){
s.style.fontFamily=fonts[i];
baseFonts[fonts[i]]={width:s.offsetWidth,height:s.offsetHeight};
}
var detect=[];
var testFonts=['Andale Mono','Arial','Arial Black','Arial Hebrew','Arial MT','Arial Narrow','Arial Rounded MT Bold','Arial Unicode MS','Bitstream Vera Sans Mono','Book Antiqua','Bookman Old Style','Calibri','Cambria','Century','Century Gothic','Century Schoolbook','Comic Sans','Comic Sans MS','Consolas','Courier','Courier New','Georgia','Helvetica','Helvetica Neue','Impact','Lucida Bright','Lucida Calligraphy','Lucida Console','Lucida Fax','LUCIDA GRANDE','Lucida Handwriting','Lucida Sans','Lucida Sans Typewriter','Lucida Sans Unicode','Microsoft Sans Serif','Monaco','Monotype Corsiva','MS Gothic','MS Outlook','MS PGothic','MS Reference Sans Serif','MS Sans Serif','MS Serif','MYRIAD','MYRIAD PRO','Palatino','Palatino Linotype','Segoe Print','Segoe Script','Segoe UI','Segoe UI Light','Segoe UI Semibold','Segoe UI Symbol','Tahoma','Times','Times New Roman','Times New Roman PS','Trebuchet MS','Verdana','Wingdings','Wingdings 2','Wingdings 3'];
for(var j=0;j<testFonts.length;j++){
var matched=false;
for(var k=0;k<fonts.length;k++){
s.style.fontFamily=testFonts[j]+','+fonts[k];
var metrics={width:s.offsetWidth,height:s.offsetHeight};
if(metrics.width!==baseFonts[fonts[k]].width||metrics.height!==baseFonts[fonts[k]].height){
matched=true;break;
}
}
if(matched){detect.push(testFonts[j])}
}
document.body.removeChild(s);
return detect.slice(0,10).join(',');
}catch(e){return null}};
// Función hash simple para crear signatures
// Función de hash mejorada usando Web Crypto API para mejor unicidad
var simpleHash=function(str){
if(!str)return null;
// Usar un hash más robusto para evitar colisiones
var hash=0;
var hash2=0;
for(var i=0;i<str.length;i++){
var char=str.charCodeAt(i);
hash=((hash<<5)-hash)+char;
hash2=((hash2<<7)-hash2)+char;
hash=hash&hash;
hash2=hash2&hash2;
}
// Combinar ambos hashes para mayor unicidad (resulta en ~12-14 caracteres)
return Math.abs(hash).toString(36)+Math.abs(hash2).toString(36);
};
// SEPARACIÓN DE FINGERPRINTS EN 3 NIVELES
// 1. DEVICE FINGERPRINT - Solo hardware (cross-browser mismo dispositivo)
var getDeviceOnlyFp=function(){
try{
var components=[
// Pantalla - agregar más detalles
screen.width+'x'+screen.height+'x'+(screen.availWidth)+'x'+(screen.availHeight), // Resolución + área disponible
screen.colorDepth+'_'+screen.pixelDepth, // Profundidades de color
window.devicePixelRatio||1, // DPI
// Hardware
navigator.hardwareConcurrency||0, // CPU cores
navigator.deviceMemory||0, // RAM
navigator.maxTouchPoints||0, // Touch
// GPU - MÁS IMPORTANTE para unicidad
getWebGLFp(),
// WebGL vendor y renderer detallado
(function(){
  try{
    var canvas=document.createElement('canvas');
    var gl=canvas.getContext('webgl')||canvas.getContext('experimental-webgl');
    if(!gl)return null;
    var debugInfo=gl.getExtension('WEBGL_debug_renderer_info');
    if(!debugInfo)return null;
    return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)+'|'+gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  }catch(e){return null}
})(),
// Audio - único por hardware
getAudioFp(),
// MediaDevices - cámaras y micrófonos
(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices?'media':'nomedia'),
// Battery API si existe
(navigator.getBattery?'battery':'nobattery'),
// Conexión
(navigator.connection?navigator.connection.effectiveType:'noconn'),
// Plugins count (para detectar extensiones)
navigator.plugins.length
].filter(Boolean);
return simpleHash(components.join('|'));
}catch(e){return null}
};
// 2. BROWSER FINGERPRINT - Solo software (cambia entre navegadores)
var getBrowserOnlyFp=function(){
try{
var components=[
navigator.userAgent,
navigator.language,
navigator.languages?navigator.languages.join(','):'', // Todos los idiomas
navigator.platform,
Intl.DateTimeFormat().resolvedOptions().timeZone,
new Date().getTimezoneOffset(),
// Canvas - IMPORTANTE: usar solo hash, no el dataURL completo
getCanvasFp()?simpleHash(getCanvasFp()):'', // Hash del canvas para unicidad
getFontsFp(), // Fonts instaladas
// Más propiedades del navegador
navigator.cookieEnabled,
window.sessionStorage?'1':'0',
window.localStorage?'1':'0',
window.indexedDB?'1':'0',
// Permisos y APIs
(navigator.permissions?'perms':'noperms'),
(window.Notification?'notif':'nonotif'),
(navigator.webdriver||false), // Detecta automation
// Resolución y color únicos del browser
window.outerWidth+'x'+window.outerHeight, // Tamaño de ventana
window.screenX+'x'+window.screenY, // Posición de ventana
navigator.doNotTrack||'unspecified',
// Historia y performance
window.history.length, // Longitud del historial
performance.navigation.type // Tipo de navegación
].filter(function(v){return v!==null&&v!==undefined}).map(String);
return simpleHash(components.join('|'));
}catch(e){return null}
};
// 3. COMBINED FINGERPRINT - Todo junto (máxima unicidad)
var getCombinedFp=function(deviceFp,browserFp){
if(!deviceFp&&!browserFp)return null;
// Incluir más componentes únicos en el combined
var extraComponents=[
deviceFp||'',
browserFp||'',
// Timestamp de instalación (primera visita)
rstkLocal.first_visit||Date.now(),
// Canvas hash directo para máxima unicidad
getCanvasFp()?simpleHash(getCanvasFp().substring(0,500)):'',
// Audio fingerprint
getAudioFp()?simpleHash(getAudioFp()):'',
// WebGL completo
getWebGLFp()||''
].filter(Boolean);
return simpleHash(extraComponents.join('|'));
};
// Calcular los 3 fingerprints
var deviceFp=getDeviceOnlyFp();
var browserFp=getBrowserOnlyFp();
var combinedFp=getCombinedFp(deviceFp,browserFp);
// Calcular confianza de cada fingerprint
var deviceConfidence=0;
var browserConfidence=0;
// Device confidence
if(screen.width&&screen.height)deviceConfidence+=20;
if(navigator.hardwareConcurrency)deviceConfidence+=20;
if(getWebGLFp())deviceConfidence+=30;
if(getAudioFp())deviceConfidence+=30;
// Browser confidence
if(getCanvasFp())browserConfidence+=40;
if(getFontsFp())browserConfidence+=30;
if(navigator.userAgent)browserConfidence+=30;
// Detectar ad blocker
var detectAdBlocker=function(){
try{
var testAd=document.createElement('div');
testAd.innerHTML='&nbsp;';
testAd.className='adsbox ad-placement doubleclick pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
testAd.style.position='absolute';
testAd.style.left='-10000px';
testAd.style.top='-1000px';
document.body.appendChild(testAd);
var blocked=testAd.offsetHeight===0;
document.body.removeChild(testAd);
return blocked;
}catch(e){return null}
};
// Detectar capacidades de red
var getNetworkInfo=function(){
try{
var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
if(conn){
return{
type:conn.effectiveType||conn.type||null,
downlink:conn.downlink||null,
rtt:conn.rtt||null,
saveData:conn.saveData||false
};
}
}catch(e){}
return{type:null,downlink:null,rtt:null,saveData:false};
};
var netInfo=getNetworkInfo();
var adBlockerDetected=detectAdBlocker();
// Quitados todos los logs de fingerprints
var f=function(n){
// BYPASS DE TRACKING: Si la URL tiene ?notrack=true o &notrack=true, no enviar nada
if(location.search.includes('notrack=true')||location.hash.includes('notrack=true')){
console.log("[HT] 🚫 Tracking deshabilitado por parámetro notrack");
return;
}
// Calcular duración de la sesión en segundos
var currentTime=Date.now();
var durationSeconds=Math.floor((currentTime-sessionStart)/1000);
var o={
// Identificadores principales
sid:e,vid:u,sess:g,session_num:m,
duration_seconds:durationSeconds, // NUEVO: duración en segundos
// FINGERPRINTS SEPARADOS EN 3 NIVELES
device_fp:deviceFp, // Hardware only (cross-browser)
browser_fp:browserFp, // Software only
combined_fp:combinedFp, // Ambos (máxima unicidad)
device_confidence:deviceConfidence,
browser_confidence:browserConfidence,
// Fingerprints individuales para debugging
canvas_fp:getCanvasFp(),
webgl_fp:getWebGLFp(),
audio_fp:getAudioFp(),
fonts_fp:getFontsFp(),
// Información de la página
url:location.href,
title:document.title,
ref:document.referrer||"",
landing_fragment:location.hash||null, // AGREGADO: fragment de la URL
ts:(new Date).toISOString(),
event:n||"page_view",
// UTM Parameters (todos)
utm_source:c("utm_source"),
utm_medium:c("utm_medium"),
utm_campaign:c("utm_campaign"),
utm_content:c("utm_content"),
utm_term:c("utm_term"),
utm_id:c("utm_id"),
// Click IDs de todas las plataformas
fbclid:c("fbclid"),
gclid:c("gclid"),
wbraid:c("wbraid"),
gbraid:c("gbraid"),
msclkid:c("msclkid"),
ttclid:c("ttclid"),
twclid:c("twclid"),
li_fat_id:c("li_fat_id"),
epik:c("epik"),
pclid:c("pclid"),
sc_click_id:c("sc_click_id"),
rdt_cid:c("rdt_cid"),
qclid:c("qclid"),
yclid:c("yclid"),
// Facebook cookies
fbc:l("_fbc"),
fbp:l("_fbp"),
// Información de campañas (Facebook/Google Ads)
campaign_id:c("campaign_id"),
adset_id:c("adset_id")||c("ad_group_id"),
ad_group_id:c("ad_group_id"),
ad_id:c("ad_id"),
campaign_name:c("campaign_name"),
adset_name:c("adset_name")||c("ad_group_name"),
ad_group_name:c("ad_group_name"),
ad_name:c("ad_name"),
// Detalles de placement y targeting
placement:c("placement"),
site_source_name:c("site_source_name"),
network:c("network"),
device:c("device"),
match_type:c("matchtype")||c("match_type"),
keyword:c("keyword"),
search_query:c("search_query")||c("query"),
creative_id:c("creative")||c("creative_id"),
ad_position:c("adposition")||c("ad_position"),
target_id:c("targetid")||c("target_id"),
// Ubicación física e interés (Google Ads)
loc_physical_ms:c("loc_physical_ms"),
loc_interest_ms:c("loc_interest_ms"),
gclsrc:c("gclsrc"),
// Datos de contacto
email:c("email"),
phone:c("phone"),
contact_id:c("contact_id"),
// Información del dispositivo y navegador
user_agent:navigator.userAgent,
language:navigator.language,
timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
timezone_offset:new Date().getTimezoneOffset(), // AGREGADO: offset de timezone
screen_width:screen.width,
screen_height:screen.height,
color_depth:screen.colorDepth||null, // AGREGADO: profundidad de color
pixel_ratio:window.devicePixelRatio||1, // AGREGADO: pixel ratio
viewport_width:innerWidth,
viewport_height:innerHeight,
hardware_concurrency:navigator.hardwareConcurrency||null, // AGREGADO: núcleos CPU
device_memory:navigator.deviceMemory||null, // AGREGADO: memoria del dispositivo
// Capacidades del navegador
cookies_enabled:navigator.cookieEnabled,
local_storage_enabled:"undefined"!=typeof Storage,
do_not_track:"1"===navigator.doNotTrack||"1"===window.doNotTrack||"1"===navigator.msDoNotTrack||"yes"===navigator.doNotTrack,
gpc:navigator.globalPrivacyControl||false, // AGREGADO: Global Privacy Control
ad_blocker:adBlockerDetected, // AGREGADO: detección de ad blocker
// Información de red
network_type:netInfo.type,
network_downlink:netInfo.downlink,
network_rtt:netInfo.rtt,
network_save_data:netInfo.saveData,
// Google Analytics
ga_client_id:l("_ga")?l("_ga").replace(/^GA\\d+\\.\\d+\\./,""):null,
ga_session_id:c("ga_session_id"),
// Geolocalización (si viene en params)
country:c("country"),
region:c("region"),
city:c("city"),
// Source y channel
source:c("source"),
channel:c("channel")
};
// Intentar obtener datos del usuario guardados (GHL y nuestro rstk_local)
// Primero intentar con nuestro rstk_local (tiene prioridad)
try{if(rstkLocal&&Object.keys(rstkLocal).length>0){
// Quitado log de rstk_local
o.contact_id=rstkLocal.contact_id,
o.rstk_adid=rstkLocal.rstk_adid,
o.rstk_source=rstkLocal.rstk_source,
o.is_lead=rstkLocal.is_lead||false,
o.converted_at=rstkLocal.converted_at||null,
o.conversion_page=rstkLocal.conversion_page||null,
!o.email&&rstkLocal.email&&(o.email=rstkLocal.email),
!o.phone&&rstkLocal.phone&&(o.phone=rstkLocal.phone),
!o.first_name&&rstkLocal.first_name&&(o.first_name=rstkLocal.first_name),
!o.last_name&&rstkLocal.last_name&&(o.last_name=rstkLocal.last_name)}}catch(e){}
// MEJORADO: Buscar _ud de GHL con reintentos
var ghlUserData=null;
var checkGhlData=function(){
try{
var r=a.getItem("_ud");
if(r){
ghlUserData=JSON.parse(r);
// Quitado log de _ud detectado
return true;
}
}catch(e){}
return false;
};
// Intentar obtener _ud inmediatamente
if(checkGhlData()&&ghlUserData){
o.ghl_contact_id=ghlUserData.customer_id||ghlUserData.id,
o.ghl_location_id=ghlUserData.location_id,
!o.email&&ghlUserData.email&&(o.email=ghlUserData.email),
!o.phone&&ghlUserData.phone&&(o.phone=ghlUserData.phone),
!o.first_name&&(o.first_name=ghlUserData.first_name||ghlUserData.firstName),
!o.last_name&&(o.last_name=ghlUserData.last_name||ghlUserData.lastName),
o.full_name=ghlUserData.full_name||ghlUserData.name,
o.country=o.country||ghlUserData.country,
ghlUserData.source&&(o.ghl_source=ghlUserData.source);
// IMPORTANTE: Capturar campos de tracking directamente del _ud
if(ghlUserData.rstk_vid){
console.log("[HT] 🎯 rstk_vid encontrado en _ud:",ghlUserData.rstk_vid);
o.rstk_vid=ghlUserData.rstk_vid
}
// También capturar campos custom de GHL
if(ghlUserData.customData){
var customData=ghlUserData.customData;
customData.rstk_vid&&(o.rstk_vid=customData.rstk_vid);
customData.visitor_id&&(o.rstk_vid=customData.visitor_id);
}
// Capturar ad_id y utm_source si vienen
ghlUserData.ad_id&&(o.ad_id=ghlUserData.ad_id);
ghlUserData.utm_source&&!o.utm_source&&(o.utm_source=ghlUserData.utm_source);
ghlUserData.utm_medium&&!o.utm_medium&&(o.utm_medium=ghlUserData.utm_medium);
ghlUserData.utm_campaign&&!o.utm_campaign&&(o.utm_campaign=ghlUserData.utm_campaign);
ghlUserData.utm_content&&!o.utm_content&&(o.utm_content=ghlUserData.utm_content);
ghlUserData.campaign_id&&!o.campaign_id&&(o.campaign_id=ghlUserData.campaign_id);
ghlUserData.adset_id&&!o.adset_id&&(o.adset_id=ghlUserData.adset_id);
ghlUserData.placement&&!o.placement&&(o.placement=ghlUserData.placement);
ghlUserData.site_source_name&&!o.site_source_name&&(o.site_source_name=ghlUserData.site_source_name)
}
// MEJORADO: Si no se detectó _ud, buscar con reintentos EN CUALQUIER PÁGINA
if(!ghlUserData){
// Buscar _ud de GHL silenciosamente
var udAttempts=0;
var udDetected=false;
var udInterval=setInterval(function(){
udAttempts++;
if(checkGhlData()){
console.log("[HT] 🎉 _ud detectado en intento",udAttempts);
udDetected=true;
// IMPORTANTE: Solo enviar UNA VEZ los datos actualizados
// No usar f() directamente porque crearía nueva sesión
// En su lugar, actualizar el rstk_local con los nuevos datos
if(ghlUserData.customer_id||ghlUserData.id){
// NO guardar el ext_crm_id aquí, esperar el contact_id interno del backend
rstkLocal.ghl_contact_id=ghlUserData.customer_id||ghlUserData.id; // Solo guardar referencia GHL
rstkLocal.email=ghlUserData.email||rstkLocal.email;
rstkLocal.phone=ghlUserData.phone||rstkLocal.phone;
rstkLocal.ghl_detected=true;
rstkLocal.ghl_detected_at=new Date().toISOString();
a.setItem("rstk_local",JSON.stringify(rstkLocal));
// SINCRONIZAR: También guardar en cookies (agnóstico: backup en cookies)
setCookie("rstk_vid",rstkLocal.visitor_id,3650);
if(rstkLocal.contact_id){setCookie("rstk_contact_id",rstkLocal.contact_id,3650)} // Usar nombre consistente
// Enviar actualización al backend SIN crear nueva sesión
var updateData={
sid:e,vid:u,sess:g,
event:"ghl_update", // Evento especial para actualizar, no crear nueva sesión
ghl_contact_id:ghlUserData.customer_id||ghlUserData.id,
email:ghlUserData.email,
phone:ghlUserData.phone
};
// Si hay rstk_vid en el _ud, también enviarlo
if(ghlUserData.rstk_vid){
updateData.rstk_vid=ghlUserData.rstk_vid;
}
if(ghlUserData.customData&&ghlUserData.customData.rstk_vid){
updateData.rstk_vid=ghlUserData.customData.rstk_vid;
}
// Enviar actualización silenciosa
fetch(x,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(updateData),keepalive:!0})
.then(function(r){return r.json()})
.then(function(response){
  console.log("[HT] ✅ Datos GHL actualizados en backend");
  // Si el backend devuelve el contact_id interno, guardarlo
  if(response.contact_id){
    rstkLocal.contact_id = response.contact_id; // Ahora sí el ID interno!
    rstkLocal.contact_id_internal = true;
    a.setItem("rstk_local",JSON.stringify(rstkLocal));
    // SINCRONIZAR: También guardar contact_id en cookie (agnóstico: persistencia máxima)
    setCookie("rstk_contact_id",response.contact_id,3650); // Cookie permanente
  }
})
.catch(function(e){console.log("[HT] ⚠️ Error actualizando GHL:",e)});
}
clearInterval(udInterval);
}
if(udAttempts>=20&&!udDetected){// 20 intentos = 40 segundos
clearInterval(udInterval);
// _ud no detectado, es normal si no es usuario GHL
}
},2000);// Cada 2 segundos
}
Object.keys(o).forEach((function(e){null!=o[e]&&""!==o[e]||delete o[e]}));
var cleanData={};Object.keys(o).forEach(function(k){if(o[k]!==null&&o[k]!==undefined&&o[k]!==""){cleanData[k]=o[k]}});
// Enviar evento silenciosamente
fetch(x,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o),keepalive:!0})
.then((function(r){
// Evento enviado exitosamente
// Si el servidor devolvió un contact_id, actualizar rstk_local
if(r.status===200){return r.json().then(function(data){
if(data.contact_id&&(o.email||o.phone||o.ghl_contact_id)){
// Actualizar el objeto existente, no reemplazarlo
rstkLocal.contact_id=data.contact_id;
rstkLocal.email=o.email||rstkLocal.email||null;
rstkLocal.phone=o.phone||rstkLocal.phone||null;
rstkLocal.first_name=o.first_name||rstkLocal.first_name||null;
rstkLocal.last_name=o.last_name||rstkLocal.last_name||null;
rstkLocal.rstk_adid=o.ad_id||o.campaign_id||rstkLocal.rstk_adid||null;
rstkLocal.rstk_source=o.utm_source||o.ghl_source||rstkLocal.rstk_source||null;
rstkLocal.updated_at=new Date().toISOString();
// NUEVO: Marcar que este usuario ya convirtió
rstkLocal.is_lead=true;
rstkLocal.converted_at=rstkLocal.converted_at||new Date().toISOString();
rstkLocal.conversion_page=o.url||rstkLocal.conversion_page||null;
// También guardar datos de atribución si vienen
if(o.utm_campaign){rstkLocal.utm_campaign=o.utm_campaign}
if(o.utm_medium){rstkLocal.utm_medium=o.utm_medium}
if(o.utm_content){rstkLocal.utm_content=o.utm_content}
if(o.fbclid){rstkLocal.fbclid=o.fbclid}
if(o.gclid){rstkLocal.gclid=o.gclid}
// Guardar todo actualizado
a.setItem("rstk_local",JSON.stringify(rstkLocal));
// SINCRONIZAR: También guardar en cookies (agnóstico: máxima persistencia wey)
setCookie("rstk_contact_id",data.contact_id,3650); // Nombre consistente
setCookie("rstk_vid",rstkLocal.visitor_id,3650);
// Lead convertido, rstk_local actualizado
}}).catch(function(){})}}))
.catch((function(e){
// Error silencioso, reintentar con beacon
if(navigator.sendBeacon){var n=new Blob([JSON.stringify(o)],{type:"application/json"});
navigator.sendBeacon(x,n)}}))};
var lastUrl=location.href,debounceTimer=null;
var trackIfChanged=function(){
if(location.href!==lastUrl){
lastUrl=location.href;
clearTimeout(debounceTimer);
debounceTimer=setTimeout(function(){f("navigation")},500)}};
f();
var p=history.pushState;history.pushState=function(){p.apply(history,arguments),trackIfChanged()};
var h=history.replaceState;history.replaceState=function(){h.apply(history,arguments),trackIfChanged()};
addEventListener("popstate",trackIfChanged)}();`;

  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.send(script);
});

// =============================================================================
// POST /collect - Recibir datos de tracking con TODOS los campos
// =============================================================================
router.post('/collect', async (req, res) => {
  try {
    const data = req.body || {};

    // NUEVO: Leer cookies como fallback para visitor_id y contact_id
    const cookies = req.headers.cookie || '';
    const getCookieValue = (name) => {
      const match = cookies.match(new RegExp(`${name}=([^;]+)`));
      return match ? match[1] : null;
    };

    // Si no viene visitor_id en data, intentar recuperarlo de cookies
    if (!data.vid && cookies) {
      const cookieVid = getCookieValue('rstk_vid') || getCookieValue('rstk_visitor');
      if (cookieVid) {
        console.log('🍪 [COOKIE] Visitor_id recuperado de cookie:', cookieVid);
        data.vid = cookieVid; // Usar el de la cookie como fallback
      }
    }

    // Si no viene contact_id en data, intentar recuperarlo de cookies
    if (!data.contact_id && cookies) {
      const cookieContactId = getCookieValue('rstk_contact_id') || getCookieValue('rstk_cid'); // Soportar ambos nombres por compatibilidad
      if (cookieContactId) {
        console.log('🍪 [COOKIE] Contact_id recuperado de cookie:', cookieContactId);
        data.contact_id = cookieContactId; // Usar el de la cookie como fallback
      }
    }

    const trackingHostname = extractTrackingHostname(req);
    const forwardedHostHeader = req.headers['x-forwarded-host'] || null;
    const originalHostHeader = req.headers['x-original-host'] || null;
    let trackingDomainRecord = null;

    if (trackingHostname) {
      try {
        const domainResult = await databasePool.query(
          `SELECT id, hostname, status, ssl_status, is_active
             FROM public.tracking_domains
            WHERE hostname = $1
            LIMIT 1`,
          [trackingHostname]
        );
        trackingDomainRecord = domainResult.rows[0] || null;
      } catch (lookupError) {
        console.error('Error looking up tracking domain by hostname:', lookupError.message);
      }
    }

    // LOG DE DEBUG - Ver qué llega
    console.log('\n========== TRACKING COLLECT REQUEST ==========');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log('🌐 Origin:', req.headers.origin || 'no-origin');
    console.log('📍 Referrer:', req.headers.referer || 'no-referrer');
    console.log('🏷 Tracking Host:', trackingHostname || 'unknown');
    console.log('🔍 Domain from data:', data.url ? new URL(data.url).hostname : 'no-url');
    console.log('📦 Data received:', JSON.stringify(data, null, 2));
    console.log('==============================================\n');

    // IDs básicos - REQUERIDOS del frontend
    let visitorId = data.vid;
    const sessionId = data.sess;
    // Ya no necesitamos session_number

    // Validación básica - AMBOS IDs son requeridos
    if (!visitorId || !sessionId) {
      console.log('❌ ERROR: Missing IDs - vid:', visitorId, 'sess:', sessionId);
      return res.status(400).json({ error: 'Missing required tracking IDs (vid and sess)' });
    }

    // =============================================================================
    // FUNCIÓN UNIVERSAL: VisitorContactLink
    // Vincula visitor_id con contact_id EN CUALQUIER MOMENTO que se detecte
    // =============================================================================
    const VisitorContactLink = async (visitorId, contactId) => {
      try {
        console.log(`🔗 [VisitorContactLink] Intentando vincular visitor ${visitorId} con contact ${contactId}`);

        // PASO 1: Obtener los datos del contacto (email y phone)
        const contactDataQuery = `
          SELECT email, phone
          FROM contacts
          WHERE contact_id = $1
          LIMIT 1
        `;
        const contactData = await databasePool.query(contactDataQuery, [contactId]);

        let contactEmail = null;
        let contactPhone = null;

        if (contactData.rows.length > 0) {
          contactEmail = contactData.rows[0].email;
          contactPhone = contactData.rows[0].phone;
          console.log(`📧 [VisitorContactLink] Datos del contacto - Email: ${contactEmail ? '✓' : '✗'}, Phone: ${contactPhone ? '✓' : '✗'}`);
        }

        // PASO 2: Buscar TODOS los visitor_ids que ya están asociados a este contact_id
        const relatedVisitorsQuery = `
          SELECT DISTINCT visitor_id
          FROM tracking.sessions
          WHERE contact_id = $1
          UNION
          SELECT visitor_id
          FROM contacts
          WHERE contact_id = $1 AND visitor_id IS NOT NULL
          UNION
          SELECT $2 as visitor_id  -- Incluir el visitor_id actual
        `;
        const relatedVisitors = await databasePool.query(relatedVisitorsQuery, [contactId, visitorId]);

        const allVisitorIds = relatedVisitors.rows.map(r => r.visitor_id).filter(v => v);
        console.log(`🔍 [VisitorContactLink] Encontrados ${allVisitorIds.length} visitor_ids relacionados:`, allVisitorIds);

        // PASO 3: Contar cuántas sesiones hay que vincular
        const countAllQuery = `
          SELECT COUNT(*) as total,
                 COUNT(CASE WHEN contact_id IS NULL THEN 1 END) as sin_contact,
                 COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as con_contact
          FROM tracking.sessions
          WHERE visitor_id = ANY($1::text[])
        `;
        const countResult = await databasePool.query(countAllQuery, [allVisitorIds]);
        console.log(`📊 [VisitorContactLink] Total sesiones: ${countResult.rows[0].total}, Sin contact: ${countResult.rows[0].sin_contact}, Con contact: ${countResult.rows[0].con_contact}`);

        // Si no hay sesiones sin contact_id, no hay nada que vincular
        if (countResult.rows[0].sin_contact === '0') {
          console.log('✓ [VisitorContactLink] Todas las sesiones ya tienen contact_id asignado');

          // Pero aún así actualizar email/phone si faltan
          if (contactEmail || contactPhone) {
            const updateEmailPhoneResult = await databasePool.query(
              `UPDATE tracking.sessions
               SET email = COALESCE(email, $2),
                   phone = COALESCE(phone, $3)
               WHERE visitor_id = ANY($4::text[])
                 AND (email IS NULL OR phone IS NULL)
                 AND ($2 IS NOT NULL OR $3 IS NOT NULL)`,
              [contactId, contactEmail, contactPhone, allVisitorIds]
            );

            if (updateEmailPhoneResult.rowCount > 0) {
              console.log(`📝 [VisitorContactLink] Actualizado email/phone en ${updateEmailPhoneResult.rowCount} sesiones`);
            }
          }

          return { linked: true, count: 0 };
        }

        // PASO 4: Vincular TODAS las sesiones con contact_id, email y phone
        const updateResult = await databasePool.query(
          `UPDATE tracking.sessions
           SET contact_id = $1,
               email = COALESCE(email, $2),
               phone = COALESCE(phone, $3)
           WHERE visitor_id = ANY($4::text[]) AND contact_id IS NULL`,
          [contactId, contactEmail, contactPhone, allVisitorIds]
        );

        if (updateResult.rowCount > 0) {
          console.log(`✅ [VisitorContactLink] ${updateResult.rowCount} sesiones vinculadas con datos completos`);
        } else {
          console.log('⚠️ [VisitorContactLink] UPDATE no afectó ninguna fila');
        }

        // También actualizar el visitor_id en contacts si no lo tiene
        await databasePool.query(
          `UPDATE contacts
           SET visitor_id = COALESCE(visitor_id, $2), updated_at = NOW()
           WHERE contact_id = $1`,
          [contactId, visitorId]
        );

        return { linked: true, count: updateResult.rowCount };
      } catch (error) {
        console.error('❌ [VisitorContactLink] Error:', error);
        return { linked: false, error: error.message };
      }
    };

    // =============================================================================
    // DETECCIÓN DE CONTACT_ID DESDE CUALQUIER FUENTE
    // =============================================================================
    let detectedContactId = null;

    // 1. Si viene ghl_contact_id, buscar el contact_id interno
    if (data.ghl_contact_id) {
      console.log('🔍 Detectado ghl_contact_id:', data.ghl_contact_id);
      const contactQuery = `
        SELECT contact_id FROM contacts
        WHERE ext_crm_id = $1
        LIMIT 1
      `;
      const contactResult = await databasePool.query(contactQuery, [data.ghl_contact_id]);
      if (contactResult.rows.length > 0) {
        detectedContactId = contactResult.rows[0].contact_id;
        console.log('✅ Contact encontrado:', detectedContactId);
      }
    }

    // 2. Si viene contact_id directo (nuestro sistema interno)
    if (data.contact_id && data.contact_id.startsWith('cntct_')) {
      detectedContactId = data.contact_id;
      console.log('✅ Contact_id interno detectado:', detectedContactId);
    }

    // 3. Si NO detectamos contact_id, buscar si este visitor ya tiene uno asignado
    // ADEMÁS: Buscar TODOS los visitor_ids relacionados a través de cualquier contact_id
    if (!detectedContactId && visitorId) {
      // Primero buscar si este visitor ya tiene un contact asignado
      const existingContactQuery = `
        SELECT DISTINCT contact_id
        FROM tracking.sessions
        WHERE visitor_id = $1 AND contact_id IS NOT NULL
        LIMIT 1
      `;
      const existingContact = await databasePool.query(existingContactQuery, [visitorId]);
      if (existingContact.rows.length > 0) {
        detectedContactId = existingContact.rows[0].contact_id;
        console.log('🔄 Contact heredado de sesiones anteriores:', detectedContactId);
      } else {
        // Si no tiene contact directo, buscar si hay otros visitor_ids relacionados
        // Esto encuentra contactos a través de visitor_ids compartidos
        const relatedContactQuery = `
          WITH related_visitors AS (
            -- Buscar todos los visitor_ids que comparten sesiones con nuestro visitor
            SELECT DISTINCT s2.visitor_id
            FROM tracking.sessions s1
            JOIN tracking.sessions s2 ON s1.session_id = s2.session_id
            WHERE s1.visitor_id = $1
          )
          SELECT DISTINCT contact_id
          FROM tracking.sessions
          WHERE visitor_id IN (SELECT visitor_id FROM related_visitors)
            AND contact_id IS NOT NULL
          LIMIT 1
        `;
        const relatedContact = await databasePool.query(relatedContactQuery, [visitorId]);
        if (relatedContact.rows.length > 0) {
          detectedContactId = relatedContact.rows[0].contact_id;
          console.log('🔗 Contact encontrado a través de visitor_ids relacionados:', detectedContactId);
        }
      }
    }

    // 4. SIEMPRE que tengamos un contact_id y un visitor_id, VINCULAR
    if (detectedContactId && visitorId) {
      await VisitorContactLink(visitorId, detectedContactId);
    }

    // =============================================================================
    // MANEJO ESPECIAL DE EVENTO ghl_update - CREAR CONTACTO SI NO EXISTE
    // =============================================================================
    if (data.event === 'ghl_update') {
      // Si NO encontramos un contacto existente, CREARLO desde el _ud
      if (!detectedContactId && data.ghl_contact_id) {
        console.log('🆕 [GHL_UPDATE] Creando nuevo contacto desde _ud:', data.ghl_contact_id);

        // Generar ID único para el contacto (mismo formato que webhook.service)
        const crypto = require('crypto');
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomId = '';
        const randomBytes = crypto.randomBytes(16);
        for (let i = 0; i < 16; i++) {
          randomId += characters[randomBytes[i] % characters.length];
        }
        const newContactId = `cntct_${randomId}`;

        try {
          // Crear el contacto con los datos del _ud
          const insertQuery = `
            INSERT INTO contacts (
              contact_id,
              ext_crm_id,
              email,
              phone,
              visitor_id,
              status,
              source,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (ext_crm_id) DO UPDATE SET
              email = COALESCE(EXCLUDED.email, contacts.email),
              phone = COALESCE(EXCLUDED.phone, contacts.phone),
              visitor_id = COALESCE(EXCLUDED.visitor_id, contacts.visitor_id),
              updated_at = NOW()
            RETURNING contact_id
          `;

          const result = await databasePool.query(insertQuery, [
            newContactId,
            data.ghl_contact_id,  // ext_crm_id = GHL contact ID
            data.email || null,
            data.phone || null,
            visitorId,  // Guardar el visitor_id directamente
            'lead',
            'ghl_ud',  // Fuente específica para tracking desde _ud
          ]);

          detectedContactId = result.rows[0].contact_id;
          console.log('✅ [GHL_UPDATE] Contacto creado desde _ud:', detectedContactId);

          // Vincular INMEDIATAMENTE todas las sesiones de este visitor
          if (visitorId) {
            await VisitorContactLink(visitorId, detectedContactId);
          }

        } catch (error) {
          console.error('❌ [GHL_UPDATE] Error creando contacto:', error);
        }
      } else if (detectedContactId && visitorId) {
        // Si ya existe el contacto, solo vincular las sesiones
        console.log('🔄 [GHL_UPDATE] Contacto ya existe, vinculando sesiones:', detectedContactId);
        await VisitorContactLink(visitorId, detectedContactId);
      }

      return res.json({
        success: true,
        contact_id: detectedContactId,
        message: detectedContactId ? 'Contact created/linked via _ud' : 'No contact data to process'
      });
    }

    // =============================================================================
    // VISITOR ID SIMPLE - MATCHING TEMPORALMENTE DESHABILITADO
    // =============================================================================
    // TODO: Reimplementar matching de manera más segura y conservadora
    // Por ahora solo usar el visitor_id que viene del cliente
    // La vinculación con contact_id mediante _ud y webhooks sigue funcionando

    // Obtener IP real para logging y análisis
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress;

    const userAgent = data.user_agent || req.headers['user-agent'];

    // MATCHING DESHABILITADO - Usar visitor_id original
    // visitorId ya fue declarado arriba en la línea 463
    console.log(`📍 [VISITOR] Usando visitor_id original: ${visitorId}`);

    // TODO ELIMINADO: Sistema de matching de 22 niveles que causaba falsos positivos
    // Próxima implementación debe ser más conservadora y evitar falsos positivos

    // Código de matching eliminado - líneas 492-1262 del archivo original
    // Se eliminaron los 22 niveles de matching que causaban unificación incorrecta
    // de usuarios diferentes (ej: Samuel y Francisco)

    // IMPORTANTE: La vinculación con contact_id mediante _ud y webhooks
    // sigue funcionando normalmente más abajo en el código
    // Parsear URL
    let urlData = {};
    try {
      const parsedUrl = new URL(data.url);
      urlData = {
        host: parsedUrl.hostname,
        path: parsedUrl.pathname,
        query: parsedUrl.search,
        fragment: parsedUrl.hash
      };
    } catch (e) {
      urlData = { host: 'unknown', path: '/', query: '', fragment: '' };
    }

    // Parsear referrer
    let referrerData = {};
    if (data.ref) {
      try {
        const parsedRef = new URL(data.ref);
        referrerData.domain = parsedRef.hostname;
      } catch (e) {
        referrerData.domain = null;
      }
    }

    // Parsear User Agent
    const parser = new UAParser(data.user_agent || req.headers['user-agent']);
    const uaResult = parser.getResult();

    // IP ya fue obtenida arriba para el matching inteligente

    // =============================================================================
    // PROCESAMIENTO ADICIONAL DE DATOS
    // =============================================================================

    // 1. Hashear email y teléfono si existen
    const crypto = require('crypto');
    let emailSha256 = null;
    let phoneSha256 = null;
    let phoneE164 = null;

    if (data.email) {
      // Normalizar y hashear email
      const normalizedEmail = data.email.toLowerCase().trim();
      emailSha256 = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    }

    if (data.phone) {
      // Normalizar teléfono (quitar espacios y caracteres especiales)
      const cleanPhone = data.phone.replace(/[^\d+]/g, '');
      // Si no empieza con +, asumir México (+52)
      phoneE164 = cleanPhone.startsWith('+') ? cleanPhone : `+52${cleanPhone}`;
      phoneSha256 = crypto.createHash('sha256').update(phoneE164).digest('hex');
    }

    // 2. Procesar los 3 niveles de fingerprints
    let deviceFingerprint = data.device_fp || null;
    let browserFingerprint = data.browser_fp || null;
    let combinedFingerprint = data.combined_fp || null;
    let deviceConfidence = data.device_confidence || 0;
    let browserConfidence = data.browser_confidence || 0;

    // Si no vienen del cliente, intentar generarlos en el servidor
    if (!deviceFingerprint && data.webgl_fp) {
      // Fallback: generar device fingerprint básico
      const deviceComponents = [
        data.screen_width + 'x' + data.screen_height,
        data.color_depth,
        data.pixel_ratio,
        data.hardware_concurrency,
        data.device_memory,
        data.webgl_fp,
        data.audio_fp
      ].filter(Boolean).join('|');

      if (deviceComponents) {
        deviceFingerprint = crypto.createHash('sha256').update(deviceComponents).digest('hex').substring(0, 16);
        deviceConfidence = 50; // Confianza media si lo generamos server-side
      }
    }

    if (!browserFingerprint && data.canvas_fp) {
      // Fallback: generar browser fingerprint básico
      const browserComponents = [
        data.user_agent,
        data.language,
        data.timezone,
        data.canvas_fp,
        data.fonts_fp
      ].filter(Boolean).join('|');

      if (browserComponents) {
        browserFingerprint = crypto.createHash('sha256').update(browserComponents).digest('hex').substring(0, 16);
        browserConfidence = 50;
      }
    }

    if (!combinedFingerprint && (deviceFingerprint || browserFingerprint)) {
      // Generar combined si tenemos al menos uno
      combinedFingerprint = crypto.createHash('sha256')
        .update((deviceFingerprint || '') + '+' + (browserFingerprint || ''))
        .digest('hex')
        .substring(0, 16);
    }

    // 3. Detección básica de bots
    let botDetected = false;
    let botProvider = null;
    let botScore = 0;

    const botUserAgents = [
      'bot', 'crawl', 'spider', 'scrape', 'fetch', 'slurp', 'archiv',
      'index', 'scan', 'ping', 'monitor', 'check', 'test'
    ];

    const userAgentLower = (data.user_agent || '').toLowerCase();
    for (const botPattern of botUserAgents) {
      if (userAgentLower.includes(botPattern)) {
        botDetected = true;
        botProvider = botPattern;
        botScore = 90;
        break;
      }
    }

    // Si no hay user agent o es muy corto, probablemente es bot
    if (!data.user_agent || data.user_agent.length < 20) {
      botDetected = true;
      botProvider = 'suspicious';
      botScore = 70;
    }

    // 4. Geolocalización IP (preparar para llamada async)
    let geoData = {
      country: data.country || null,
      region: data.region || null,
      city: data.city || null,
      ip_asn: null,
      ip_isp: null,
      ip_is_proxy: false,
      ip_is_vpn: false,
      ip_is_tor: false
    };

    // Intentar geolocalización IP con API gratuita (ipapi.co)
    // NOTA: Se hace async pero no bloqueamos el tracking
    if (ip && !ip.includes('127.0.0.1') && !ip.includes('::1')) {
      // Hacer la llamada async sin bloquear
      fetch(`https://ipapi.co/${ip}/json/`)
        .then(res => res.json())
        .then(async ipInfo => {
          if (ipInfo && !ipInfo.error) {
            // Actualizar la sesión con datos de geolocalización
            try {
              await databasePool.query(`
                UPDATE tracking.sessions
                SET
                  geo_country = COALESCE(geo_country, $1),
                  geo_region = COALESCE(geo_region, $2),
                  geo_city = COALESCE(geo_city, $3),
                  ip_asn = $4,
                  ip_isp = $5
                WHERE session_id = $6
              `, [
                ipInfo.country_name || null,
                ipInfo.region || null,
                ipInfo.city || null,
                ipInfo.asn || null,
                ipInfo.org || null,
                sessionId
              ]);
            } catch (err) {
              console.error('Error actualizando geo IP:', err);
            }
          }
        })
        .catch(err => {
          // Silenciar error de geo IP, no es crítico
        });
    }

    // Determinar canal basado en los datos
    let channel = data.channel;
    if (!channel) {
      if (data.gclid || data.gbraid || data.wbraid) channel = 'google_paid';
      else if (data.fbclid) channel = 'facebook_paid';
      else if (data.msclkid) channel = 'bing_paid';
      else if (data.ttclid) channel = 'tiktok_paid';
      else if (data.utm_source) channel = data.utm_source;
      else if (!data.ref) channel = 'direct';
      else if (referrerData.domain?.includes('google')) channel = 'google_organic';
      else if (referrerData.domain?.includes('facebook') || referrerData.domain?.includes('fb')) channel = 'facebook_organic';
      else channel = 'referral';
    }

    // Construir objeto source_meta con todos los datos extra
    const sourceMeta = {
      screen: {
        width: data.screen_width,
        height: data.screen_height
      },
      viewport: {
        width: data.viewport_width,
        height: data.viewport_height
      },
      tracking: {
        requestHostname: trackingHostname || null,
        forwardedHost: forwardedHostHeader,
        originalHost: originalHostHeader,
        targetHostname: process.env.TRACKING_HOST || null,
        isCustomHostname: Boolean(trackingDomainRecord),
        trackingDomainId: trackingDomainRecord?.id || null,
        trackingDomainStatus: trackingDomainRecord?.status || null,
        trackingDomainSslStatus: trackingDomainRecord?.ssl_status || null,
        trackingDomainIsActive: trackingDomainRecord?.is_active ?? null
      }
    };

    // Client hints (capacidades del navegador)
    const clientHints = {
      cookies_enabled: data.cookies_enabled,
      local_storage_enabled: data.local_storage_enabled,
      do_not_track: data.do_not_track
    };

    // CAMBIADO: Cada pageview es una nueva fila con session_id único
    // session_id ahora es el ID único para cada evento/pageview

    // Query modificado - session_id es ahora la llave primaria
    const query = `
      INSERT INTO tracking.sessions (
        session_id,          -- ID único para cada evento/pageview
        visitor_id,
        contact_id,
        event_name,
        started_at,
        ended_at,
        last_event_at,
        created_at,
        duration_seconds,
        landing_url,         -- Ahora es la URL actual, no la inicial
        landing_host,
        landing_path,
        landing_query,
        landing_fragment,
        referrer_url,
        referrer_domain,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        utm_id,
        fbclid,
        fbc,
        fbp,
        gclid,
        wbraid,
        gbraid,
        msclkid,
        ttclid,
        twclid,
        li_fat_id,
        epik,
        pclid,
        sc_click_id,
        rdt_cid,
        qclid,
        yclid,
        channel,
        source_platform,
        campaign_id,
        adset_id,
        ad_group_id,
        ad_id,
        campaign_name,
        adset_name,
        ad_group_name,
        ad_name,
        placement,
        site_source_name,
        network,
        device,
        match_type,
        keyword,
        search_query,
        target_id,
        creative_id,
        ad_position,
        loc_physical_ms,
        loc_interest_ms,
        gclsrc,
        source_meta,
        ip,
        user_agent,
        device_type,
        os,
        browser,
        browser_version,
        language,
        timezone,
        fp_vendor,
        combined_fingerprint,    -- El fingerprint combinado original (renombrado)
        fingerprint_confidence,
        client_hints,
        fp_signals,
        cookies_enabled,
        local_storage_enabled,
        ad_blocker,
        bot_detected,
        bot_provider,
        bot_score,
        ip_asn,
        ip_isp,
        ip_is_proxy,
        ip_is_vpn,
        ip_is_tor,
        geo_country,
        geo_region,
        geo_city,
        ga_client_id,
        ga_session_id,
        pageviews_count,     -- Será 1 para cada fila individual
        events_count,
        is_bounce,
        orders_count,
        revenue_value,
        currency,
        last_order_id,
        email,
        email_sha256,
        phone,
        phone_e164,
        phone_sha256,
        external_ids,
        consent_marketing,
        consent_ads,
        consent_ts,
        consent_string_tcf,
        gpc,
        do_not_track,
        properties,
        -- NUEVAS COLUMNAS DE FINGERPRINTING SEPARADAS
        canvas_fingerprint,
        webgl_fingerprint,
        audio_fingerprint,
        fonts_fingerprint,
        device_fingerprint,    -- Hardware only (cross-browser)
        browser_fingerprint,   -- Software only
        device_confidence,     -- Confianza del device fingerprint
        browser_confidence     -- Confianza del browser fingerprint
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
        $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81, $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92, $93, $94, $95, $96, $97,
        $98, $99, $100, $101, $102, $103, $104, $105, $106, $107, $108, $109, $110, $111,
        $112, $113, $114, $115, $116, $117, $118, $119
      )
      ON CONFLICT (session_id) DO UPDATE SET
        last_event_at = NOW(),
        events_count = tracking.sessions.events_count + 1,
        duration_seconds = EXCLUDED.duration_seconds
    `;

    // Preparar valores para TODOS los campos (ahora 111 parámetros sin id, session_number y ga_session_number)
    await databasePool.query(query, [
      sessionId,                          // $1 session_id (ahora es el ID único para cada evento)
      visitorId,                          // $2 visitor_id
      null,                               // $3 contact_id (se actualiza después)
      data.event || 'page_view',         // $4 event_name
      new Date().toISOString(),          // $5 started_at (UTC)
      null,                               // $6 ended_at
      new Date().toISOString(),          // $7 last_event_at (UTC)
      new Date().toISOString(),          // $8 created_at (UTC)
      data.duration_seconds || 0,         // $9 duration_seconds (tiempo real de sesión)
      data.url || null,                   // $10 landing_url (ahora es la URL actual)
      urlData.host,                       // $11 landing_host
      urlData.path,                       // $12 landing_path
      urlData.query,                      // $13 landing_query
      urlData.fragment || data.landing_fragment || null,  // $14 landing_fragment (mejorado)
      data.ref || null,                   // $15 referrer_url
      referrerData.domain || null,        // $16 referrer_domain
      data.utm_source || null,            // $17 utm_source
      data.utm_medium || null,            // $18 utm_medium
      data.utm_campaign || null,          // $19 utm_campaign
      data.utm_term || null,              // $20 utm_term
      data.utm_content || null,           // $21 utm_content
      data.utm_id || null,                // $22 utm_id
      data.fbclid || null,                // $23 fbclid
      data.fbc || null,                   // $24 fbc
      data.fbp || null,                   // $25 fbp
      data.gclid || null,                 // $26 gclid
      data.wbraid || null,                // $27 wbraid
      data.gbraid || null,                // $28 gbraid
      data.msclkid || null,               // $29 msclkid
      data.ttclid || null,                // $30 ttclid
      data.twclid || null,                // $31 twclid
      data.li_fat_id || null,             // $32 li_fat_id
      data.epik || null,                  // $33 epik
      data.pclid || null,                 // $34 pclid
      data.sc_click_id || null,           // $35 sc_click_id
      data.rdt_cid || null,               // $36 rdt_cid
      data.qclid || null,                 // $37 qclid
      data.yclid || null,                 // $38 yclid
      channel,                            // $39 channel
      data.source || data.utm_source || null,     // $40 source_platform
      data.campaign_id || null,           // $41 campaign_id
      data.adset_id || data.ad_group_id || null,  // $42 adset_id
      data.ad_group_id || null,           // $43 ad_group_id
      data.ad_id || null,                 // $44 ad_id
      data.campaign_name || null,         // $45 campaign_name
      data.adset_name || data.ad_group_name || null,  // $46 adset_name
      data.ad_group_name || null,         // $47 ad_group_name
      data.ad_name || null,               // $48 ad_name
      data.placement || null,             // $49 placement
      data.site_source_name || null,      // $50 site_source_name
      data.network_type || data.network || null,       // $51 network (mejorado con tipo de red)
      data.device || uaResult.device.type || null,     // $52 device
      data.match_type || data.matchtype || null,       // $53 match_type
      data.keyword || null,               // $54 keyword
      data.search_query || null,          // $55 search_query
      data.target_id || data.targetid || null,         // $56 target_id
      data.creative_id || data.creative || null,       // $57 creative_id
      data.ad_position || data.adposition || null,     // $58 ad_position
      data.loc_physical_ms || null,       // $59 loc_physical_ms
      data.loc_interest_ms || null,       // $60 loc_interest_ms
      data.gclsrc || null,                // $61 gclsrc
      JSON.stringify(sourceMeta),         // $62 source_meta
      ip,                                 // $63 ip
      data.user_agent || req.headers['user-agent'],    // $64 user_agent
      uaResult.device.type || null,       // $65 device_type
      uaResult.os.name || null,           // $66 os
      uaResult.browser.name || null,      // $67 browser
      uaResult.browser.version || null,   // $68 browser_version
      data.language || null,              // $69 language
      data.timezone || null,              // $70 timezone
      null,                               // $71 fp_vendor
      combinedFingerprint,                 // $72 combined_fingerprint (device + browser)
      Math.max(deviceConfidence, browserConfidence), // $73 fingerprint_confidence (máximo de ambos)
      JSON.stringify(clientHints),        // $74 client_hints
      JSON.stringify({}),                 // $75 fp_signals
      data.cookies_enabled ?? false,      // $76 cookies_enabled
      data.local_storage_enabled ?? false,// $77 local_storage_enabled
      data.ad_blocker || null,            // $78 ad_blocker (detectado en cliente)
      botDetected,                        // $79 bot_detected (detectado en servidor)
      botProvider,                        // $80 bot_provider (tipo de bot)
      botScore,                           // $81 bot_score (probabilidad)
      geoData.ip_asn,                     // $82 ip_asn (se actualiza async después)
      geoData.ip_isp,                     // $83 ip_isp (se actualiza async después)
      geoData.ip_is_proxy,                // $84 ip_is_proxy
      geoData.ip_is_vpn,                  // $85 ip_is_vpn
      geoData.ip_is_tor,                  // $86 ip_is_tor
      data.country || geoData.country,    // $87 geo_country
      data.region || geoData.region,      // $88 geo_region
      data.city || geoData.city,          // $89 geo_city
      data.ga_client_id || null,          // $90 ga_client_id
      data.ga_session_id ? BigInt(data.ga_session_id) : null,  // $91 ga_session_id
      1,                                  // $92 pageviews_count (siempre 1 por fila)
      1,                                  // $93 events_count
      false,                              // $94 is_bounce
      0,                                  // $95 orders_count
      0.00,                               // $96 revenue_value
      null,                               // $97 currency
      null,                               // $98 last_order_id
      data.email || null,                 // $99 email
      emailSha256,                        // $100 email_sha256 (hash calculado)
      data.phone || null,                 // $101 phone
      phoneE164,                          // $102 phone_e164 (formato internacional)
      phoneSha256,                        // $103 phone_sha256 (hash calculado)
      JSON.stringify({                    // $104 external_ids
        ghl_contact_id: data.ghl_contact_id || null,
        ghl_location_id: data.ghl_location_id || null
      }),
      null,                               // $105 consent_marketing
      null,                               // $106 consent_ads
      null,                               // $107 consent_ts
      null,                               // $108 consent_string_tcf
      Boolean(data.gpc),                  // $109 gpc (Global Privacy Control)
      Boolean(data.do_not_track),         // $110 do_not_track
      JSON.stringify({                    // $111 properties (extendido)
        screen: data.screen_width && data.screen_height ?
          `${data.screen_width}x${data.screen_height}` : null,
        viewport: data.viewport_width && data.viewport_height ?
          `${data.viewport_width}x${data.viewport_height}` : null,
        timestamp: data.ts || new Date().toISOString(),
        ghl_source: data.ghl_source || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        full_name: data.full_name || null,
        // Nuevos campos agregados
        color_depth: data.color_depth || null,
        pixel_ratio: data.pixel_ratio || null,
        timezone_offset: data.timezone_offset || null,
        hardware_concurrency: data.hardware_concurrency || null,
        device_memory: data.device_memory || null,
        network_type: data.network_type || null,
        network_downlink: data.network_downlink || null,
        network_rtt: data.network_rtt || null,
        network_save_data: data.network_save_data || false
      }),
      // NUEVOS PARÁMETROS DE FINGERPRINTING SEPARADOS
      // Truncar fingerprints largos para evitar error de índice PostgreSQL (máximo 8191 bytes)
      data.canvas_fp ? data.canvas_fp.substring(0, 1000) : null,  // $112 canvas_fingerprint (truncado)
      data.webgl_fp ? data.webgl_fp.substring(0, 500) : null,     // $113 webgl_fingerprint (truncado)
      data.audio_fp ? data.audio_fp.substring(0, 500) : null,     // $114 audio_fingerprint (truncado)
      data.fonts_fp ? data.fonts_fp.substring(0, 500) : null,     // $115 fonts_fingerprint (truncado)
      deviceFingerprint,                  // $116 device_fingerprint (hardware only)
      browserFingerprint,                 // $117 browser_fingerprint (software only)
      deviceConfidence,                   // $118 device_confidence
      browserConfidence                   // $119 browser_confidence
    ]);

    // =============================================================================
    // LINK VISITOR FINGERPRINT - Unificar visitors con mismo device fingerprint
    // =============================================================================

    // Si tenemos un device fingerprint con buena confianza, buscar otros visitors
    if (deviceFingerprint && deviceConfidence >= 70) {
      try {
        // Buscar TODAS las sesiones con el mismo device fingerprint (sin límite de tiempo)
        const fingerprintQuery = `
          SELECT DISTINCT visitor_id, contact_id, created_at
          FROM tracking.sessions
          WHERE device_fingerprint = $1
          AND visitor_id != $2
          ORDER BY created_at ASC
        `;

        const fingerprintMatches = await databasePool.query(fingerprintQuery, [
          deviceFingerprint,
          visitorId
        ]);

        if (fingerprintMatches.rows.length > 0) {
          console.log(`🔗 [FINGERPRINT] Encontrados ${fingerprintMatches.rows.length} visitors con mismo device fingerprint`);

          // Obtener el visitor_id más antiguo (el primero)
          const oldestVisitor = fingerprintMatches.rows[0].visitor_id;
          const hasContact = fingerprintMatches.rows.some(row => row.contact_id);

          // Si alguno tiene contact_id, usar ese
          const targetVisitor = hasContact ?
            fingerprintMatches.rows.find(row => row.contact_id)?.visitor_id :
            oldestVisitor;

          // Unificar todos los visitor_ids al más antiguo o al que tiene contact
          const updateQuery = `
            UPDATE tracking.sessions
            SET visitor_id = $1
            WHERE device_fingerprint = $2
            AND visitor_id != $1
          `;

          const updateResult = await databasePool.query(updateQuery, [
            targetVisitor,
            deviceFingerprint
          ]);

          console.log(`✅ [FINGERPRINT] Unificados ${updateResult.rowCount} sesiones al visitor_id: ${targetVisitor}`);

          // Si el visitor actual fue cambiado, actualizar la variable
          if (visitorId !== targetVisitor) {
            console.log(`🔄 [FINGERPRINT] Cambiando visitor_id de ${visitorId} a ${targetVisitor}`);
            // No actualizamos la variable visitorId aquí porque ya se insertó
            // Pero en el próximo evento ya tendrá el visitor unificado
          }
        }
      } catch (error) {
        console.error('❌ [FINGERPRINT] Error unificando visitors:', error);
        // No fallar el tracking por esto
      }
    }

    // =============================================================================
    // MATCHING ELIMINADO - SOLO SE HACE VIA _UD DE GHL
    // =============================================================================
    // El matching now solo se hace cuando GHL detecta el _ud y envía ghl_update
    // Esto es más confiable que depender de formularios que pueden ser bloqueados

    // Devolver el contact_id si se creó/unificó uno
    // Esto permite al cliente guardarlo en rstk_local
    const responseData = { success: true };

    // Buscar si esta sesión ya tiene un contact_id asignado
    try {
      const contactResult = await databasePool.query(
        'SELECT contact_id FROM tracking.sessions WHERE session_id = $1 AND contact_id IS NOT NULL LIMIT 1',
        [sessionId]
      );
      if (contactResult.rows.length > 0 && contactResult.rows[0].contact_id) {
        responseData.contact_id = contactResult.rows[0].contact_id;
      }
    } catch (e) {
      // No pasa nada, solo no devolvemos contact_id
    }

    res.json(responseData);

  } catch (error) {
    console.error('Error in /collect:', error);
    res.status(500).json({ error: 'Failed to track', details: error.message });
  }
});

// =============================================================================
// DEBUG: Verificar sesiones de un visitor
// =============================================================================
router.get('/debug/visitor/:visitorId', async (req, res) => {
  try {
    const { visitorId } = req.params;

    // Contar todas las sesiones
    const result = await databasePool.query(
      `SELECT
        visitor_id,
        COUNT(*) as total_sesiones,
        COUNT(DISTINCT session_id) as sesiones_unicas,
        COUNT(contact_id) as con_contact,
        COUNT(CASE WHEN contact_id IS NULL THEN 1 END) as sin_contact,
        MIN(created_at) as primera_sesion,
        MAX(created_at) as ultima_sesion
      FROM tracking.sessions
      WHERE visitor_id = $1
      GROUP BY visitor_id`,
      [visitorId]
    );

    // Listar las sesiones
    const sessions = await databasePool.query(
      `SELECT session_id, contact_id, created_at, event_name
       FROM tracking.sessions
       WHERE visitor_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [visitorId]
    );

    res.json({
      summary: result.rows[0] || { message: 'No sessions found' },
      sessions: sessions.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// RUTAS ADICIONALES PARA LA UI DE CONFIGURACIÓN
// =============================================================================

// GET /tracking/config - Configuración de tracking
router.get('/config', (req, res) => {
  res.json({
    success: true,
    trackingHost: process.env.TRACKING_HOST || 'ilove.hollytrack.com',
    config: {
      snippetVersion: '1.0.0',
      features: {
        pageViews: true,
        clicks: true,
        forms: true,
        scrollDepth: true
      }
    }
  });
});

// GET /tracking/domains - Listar dominios de tracking
router.get('/domains', async (req, res) => {
  try {
    const trackingService = require('../services/tracking.service');
    const domains = await trackingService.getTrackingDomains();
    res.json({
      success: true,
      domains
    });
  } catch (error) {
    console.error('Error getting tracking domains:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /tracking/snippet - Obtener snippet de tracking
router.get('/snippet', (req, res) => {

  const trackingHost = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const snippetHost = extractTrackingHostname(req) || trackingHost;
  const snippet = `<!-- HollyTrack Analytics -->
<script defer src="${protocol}://${snippetHost}/api/tracking/snip.js?s=default" data-account="default"></script>
<!-- End HollyTrack Analytics -->`;

  res.json({
    success: true,
    snippet,
    trackingHost: snippetHost
  });
});

// POST /tracking/domains - Crear nuevo dominio
router.post('/domains', async (req, res) => {
  const { hostname } = req.body;

  if (!hostname) {
    return res.status(400).json({
      success: false,
      error: 'Hostname is required'
    });
  }

  try {
    const trackingService = require('../services/tracking.service');
    const result = await trackingService.createTrackingDomain(hostname);
    res.json(result);
  } catch (error) {
    console.error('Error creating tracking domain:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /tracking/domains/:id - Eliminar dominio
router.delete('/domains/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const trackingService = require('../services/tracking.service');
    const result = await trackingService.deleteTrackingDomain(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting tracking domain:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /tracking/domains/:id/status-stream - SSE para monitoreo de status
router.get('/domains/:id/status-stream', async (req, res) => {
  const { id } = req.params;

  // Configurar headers para SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Enviar evento inicial
  res.write(`data: ${JSON.stringify({ status: 'monitoring', message: 'Iniciando monitoreo...' })}\n\n`);

  let attempts = 0;
  const maxAttempts = 30; // 30 intentos = ~90 segundos

  const checkStatus = async () => {
    attempts++;

    try {
      const trackingService = require('../services/tracking.service');
      const result = await trackingService.verifyDomainStatus(id);

      if (result.success) {
        const status = result.domain.status;
        const sslStatus = result.domain.ssl_status;

        // Enviar actualización
        res.write(`data: ${JSON.stringify({
          status: status === 'active' ? 'completed' : 'checking',
          domain: result.domain,
          isActive: result.isActive,
          sslStatus: sslStatus,
          attempt: attempts
        })}\n\n`);

        // Si está activo o alcanzamos máximo de intentos, cerrar
        if (status === 'active' || attempts >= maxAttempts) {
          res.write(`data: ${JSON.stringify({
            status: 'completed',
            domain: result.domain,
            message: status === 'active' ? 'Dominio verificado exitosamente' : 'Verificación en proceso, puede tomar hasta 24 horas'
          })}\n\n`);
          res.end();
          clearInterval(interval);
        }
      }
    } catch (error) {
      console.error('Error in SSE status check:', error);
      res.write(`data: ${JSON.stringify({
        status: 'error',
        message: 'Error verificando estado'
      })}\n\n`);
    }
  };

  // Verificar cada 3 segundos
  const interval = setInterval(checkStatus, 3000);

  // Verificación inicial inmediata
  checkStatus();

  // Limpiar si el cliente se desconecta
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// POST /tracking/verify-cname - Verificar CNAME
router.post('/verify-cname', async (req, res) => {
  try {
    const { hostname } = req.body || {};
    const trackingHost = process.env.TRACKING_HOST;

    if (!hostname || typeof hostname !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Hostname is required'
      });
    }

    if (!trackingHost) {
      return res.status(500).json({
        success: false,
        error: 'TRACKING_HOST is not configured. Define TRACKING_HOST in your environment.'
      });
    }

    const normalizedHostname = normalizeDomain(hostname);

    if (!normalizedHostname) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hostname'
      });
    }

    const expectedTarget = normalizeDomain(trackingHost);
    const resolvedTarget = await verifyCname(normalizedHostname, expectedTarget);
    const isValid = Boolean(resolvedTarget);

    return res.json({
      success: true,
      isValid,
      hostname: normalizedHostname,
      expectedTarget,
      resolvedTarget: resolvedTarget || null
    });
  } catch (error) {
    console.error('Error verifying CNAME:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify CNAME'
    });
  }
});

// Sincronizar con Cloudflare (manual o via cron)
router.post('/sync-cloudflare', async (req, res) => {
  const trackingService = require('../services/tracking.service');

  try {
    console.log('📡 Starting manual sync with Cloudflare...');
    const result = await trackingService.syncWithCloudflare();

    res.json({
      success: true,
      message: 'Sincronización completada',
      ...result
    });
  } catch (error) {
    console.error('Error syncing with Cloudflare:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
