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
    const { start, end } = req.query;

    // Validar fechas
    const startDate = start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end || new Date().toISOString().split('T')[0];

    // IMPORTANTE: Las fechas en DB están en UTC
    // El frontend envía fechas en formato YYYY-MM-DD del timezone configurado
    // Usar el timezone del usuario desde el middleware o el header
    const timezone = req.userTimezone || req.headers['x-user-timezone'] || 'America/Mexico_City';

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
      WHERE DATE(created_at) >= $1
        AND DATE(created_at) <= $2
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const result = await databasePool.query(query, [startDate, endDate]);

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
var e="${sid}",t="${protocol}://${host}",a=localStorage,s=sessionStorage,i=Date.now(),
c=function(e){var t=RegExp("[?&]"+e+"=([^&]*)").exec(location.search);return t&&decodeURIComponent(t[1].replace(/\\+/g," "))},
l=function(e){var t="; "+document.cookie,n=t.split("; "+e+"=");return 2===n.length?n.pop().split(";").shift():null};
// NUEVO SISTEMA: Todo en una sola key "rstk_local" como _ud
var rstkLocal=null;
try{rstkLocal=JSON.parse(a.getItem("rstk_local")||"{}")}catch(e){rstkLocal={}}
// Inicializar estructura si no existe
if(!rstkLocal.visitor_id){
  // Checar si viene en URL
  var urlVid=c("rstk_vid")||c("vid");
  rstkLocal.visitor_id=urlVid||"v"+i+"_"+Math.random().toString(36).substring(2,9);
  rstkLocal.first_visit=new Date().toISOString();
  rstkLocal.session_count=1;
}
// Manejar sesiones
var lastActivity=rstkLocal.last_activity?new Date(rstkLocal.last_activity).getTime():0;
var sessionId=s.getItem("rstk_session_id");
// Nueva sesión si: no hay sesión actual O han pasado más de 30 minutos
if(!sessionId||!lastActivity||i-lastActivity>18e5){
  sessionId="s"+i+"_"+Math.random().toString(36).substring(2,9);
  s.setItem("rstk_session_id",sessionId);
  if(lastActivity){rstkLocal.session_count=(rstkLocal.session_count||1)+1}
}
// Actualizar última actividad
rstkLocal.last_activity=new Date().toISOString();
rstkLocal.current_session=sessionId;
// Guardar todo en rstk_local
a.setItem("rstk_local",JSON.stringify(rstkLocal));
// Variables para el resto del script
var u=rstkLocal.visitor_id,g=sessionId,m=rstkLocal.session_count;
var y=document.currentScript||document.querySelector('script[src*="snip.js"]'),w=((y?y.src:t+"/snip.js").split("?")[0]||"").replace(/\\/snip\\.js$/,""),x=(w||t)+"/collect";
console.group("[HT] 🚀 Tracking Inicializado");
console.log("📍 Domain:",location.hostname);
console.log("🆔 Visitor ID:",u);
console.log("🔗 Session ID:",g);
console.log("#️⃣ Session Number:",m);
console.log("🎯 Subaccount:",e);
console.log("🌐 Tracking Host:",t);
console.log("🛰 Endpoint:",x);
console.groupEnd();
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
console.log("[HT] 📍 URL actual actualizada con rstk_vid:",u);
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
console.log("[HT] 🔗 Link actualizado con rstk_vid:",link.href.substring(0,50)+'...');
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
console.log("[HT] 📦 Iframe actualizado con rstk_vid");
}
}catch(e){}
});
};
// INTELIGENTE: Reintentos espaciados para páginas lentas
var urlAttempts=0;
var urlInterval=setInterval(function(){
urlAttempts++;
injectRstkVidToUrls();
console.log("[HT] 🔄 Intento",urlAttempts,"de inyección en URLs");
if(urlAttempts>=15){// 15 intentos = 45 segundos total
clearInterval(urlInterval);
console.log("[HT] ✅ Finalizados intentos de inyección en URLs (45 segundos cubiertos)");
}
},3000);// Cada 3 segundos
// Ejecutar inmediatamente
injectRstkVidToUrls();
// MEJORADO: Inyectar rstk_vid en TODOS los formularios (incluso GHL)
var injectRstkVidToForms=function(){
console.log("[HT] 🔍 Buscando formularios para inyectar rstk_vid:",u);
// 1. Buscar TODOS los forms en la página
var allForms=document.querySelectorAll('form');
allForms.forEach(function(form){
// Verificar si ya tiene rstk_vid
var existingInput=form.querySelector('input[name="rstk_vid"]');
if(!existingInput){
// Crear input hidden con rstk_vid
var hiddenInput=document.createElement('input');
hiddenInput.type='hidden';
hiddenInput.name='rstk_vid';
hiddenInput.value=u;
form.appendChild(hiddenInput);
console.log("[HT] 💉 Inyectado rstk_vid en formulario:",form.id||form.className||'sin-id');
}
});
// 2. Buscar inputs específicos de GHL y popular
var ghlInputs=document.querySelectorAll('input[name*="custom_fields"], input[name*="customField"], input[placeholder*="rstk"], input[data-custom-field]');
ghlInputs.forEach(function(input){
// Si el input parece ser para tracking, popular con visitor_id
var name=(input.name||'').toLowerCase();
var placeholder=(input.placeholder||'').toLowerCase();
var dataField=(input.getAttribute('data-custom-field')||'').toLowerCase();
if(name.includes('rstk')||name.includes('visitor')||name.includes('tracking')||
   placeholder.includes('rstk')||placeholder.includes('visitor')||
   dataField.includes('rstk')||dataField.includes('visitor')){
if(!input.value||input.value===''){
input.value=u;
console.log("[HT] 🎯 Input GHL populado:",input.name||input.id);
// Disparar eventos para que GHL detecte el cambio
input.dispatchEvent(new Event('input',{bubbles:true}));
input.dispatchEvent(new Event('change',{bubbles:true}));
input.dispatchEvent(new Event('blur',{bubbles:true}));
}
}
});
// 3. Buscar inputs con name="rstk_vid" exacto (mantener compatibilidad)
var rstkInputs=document.querySelectorAll('input[name="rstk_vid"], input[data-name="rstk_vid"], input[id*="rstk_vid"]');
rstkInputs.forEach(function(input){
if(!input.value||input.value===''){
input.value=u;
console.log("[HT] 🎯 Input rstk_vid directo populado");
input.dispatchEvent(new Event('input',{bubbles:true}));
input.dispatchEvent(new Event('change',{bubbles:true}));
}
});
// 4. NUEVO: También agregar rstk_vid a la action URL de los forms
allForms.forEach(function(form){
if(form.action&&!form.action.includes('rstk_vid')){
try{
var actionUrl=new URL(form.action,location.href);
actionUrl.searchParams.set('rstk_vid',u);
form.action=actionUrl.toString();
console.log("[HT] 🔗 Action URL actualizada con rstk_vid");
}catch(e){}
}
});
};
// INTELIGENTE: Reintentos espaciados para formularios dinámicos
var attemptCount=0;
var maxAttempts=15;
var injectInterval=setInterval(function(){
attemptCount++;
injectRstkVidToForms();
console.log("[HT] 📝 Intento",attemptCount,"de inyección en formularios");
if(attemptCount>=maxAttempts){
clearInterval(injectInterval);
console.log("[HT] ✅ Finalizados intentos de inyección en formularios (45 segundos cubiertos)");
}
},3000); // Cada 3 segundos por 15 veces = 45 segundos
// También ejecutar inmediatamente
injectRstkVidToForms();
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
console.log("[HT] 🆕 Detectados nuevos elementos dinámicos, inyectando rstk_vid");
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
var ctx=canvas.getContext('2d');
ctx.textBaseline='top';
ctx.font='14px Arial';
ctx.textAlign='left';
ctx.fillStyle='#f60';
ctx.fillRect(125,1,62,20);
ctx.fillStyle='#069';
ctx.fillText('Ristak🔥👀',2,15);
ctx.fillStyle='rgba(102,204,0,0.7)';
ctx.fillText('Ristak🔥👀',4,17);
return canvas.toDataURL().substring(0,100);
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
// Audio fingerprinting simplificado - no requiere permisos
var AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext)return 'no_audio_context';
// Solo verificar capacidades, no crear audio real
var testData={
sampleRate:new AudioContext().sampleRate||44100,
channelCount:new AudioContext().destination.channelCount||2,
maxChannels:new AudioContext().destination.maxChannelCount||2
};
// Crear fingerprint basado en capacidades del audio
return 'audio_'+testData.sampleRate+'_'+testData.channelCount+'_'+testData.maxChannels;
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
// Generar device signature combinando todos los fingerprints
var genDeviceSig=function(fps){
var sig=[fps.canvas,fps.webgl,fps.screen,fps.audio,fps.fonts].filter(Boolean).join('|');
if(!sig)return null;
// Simple hash function para crear signature más corta
var hash=0;
for(var i=0;i<sig.length;i++){
var char=sig.charCodeAt(i);
hash=((hash<<5)-hash)+char;
hash=hash&hash;
}
return 'dev_'+Math.abs(hash).toString(36);
};
// Capturar fingerprints
var fps={
canvas:getCanvasFp(),
webgl:getWebGLFp(),
screen:screen.width+'x'+screen.height+'x'+screen.colorDepth,
audio:getAudioFp(),
fonts:getFontsFp()
};
var deviceSig=genDeviceSig(fps);
console.group('[HT] 🔐 Device Fingerprints');
console.log('🎨 Canvas:',fps.canvas?fps.canvas.substring(0,30)+'...':'null');
console.log('🎮 WebGL:',fps.webgl||'null');
console.log('📺 Screen:',fps.screen);
console.log('🔊 Audio:',fps.audio?'captured':'null');
console.log('📝 Fonts:',fps.fonts?fps.fonts.split(',').length+' fonts detected':'null');
console.log('🔑 Device Signature:',deviceSig||'null');
console.groupEnd();
var f=function(n){
var o={
// Identificadores principales
sid:e,vid:u,sess:g,session_num:m,
// FINGERPRINTS AGREGADOS
canvas_fp:fps.canvas,
webgl_fp:fps.webgl,
screen_fp:fps.screen,
audio_fp:fps.audio,
fonts_fp:fps.fonts,
device_sig:deviceSig,
// Información de la página
url:location.href,
title:document.title,
ref:document.referrer||"",
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
screen_width:screen.width,
screen_height:screen.height,
viewport_width:innerWidth,
viewport_height:innerHeight,
// Capacidades del navegador
cookies_enabled:navigator.cookieEnabled,
local_storage_enabled:"undefined"!=typeof Storage,
do_not_track:"1"===navigator.doNotTrack||"1"===window.doNotTrack||"1"===navigator.msDoNotTrack||"yes"===navigator.doNotTrack,
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
console.log("[HT] 🔑 rstk_local detectado:",rstkLocal);
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
console.log("[HT] 🔐 _ud de GHL detectado:",ghlUserData);
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
console.log("[HT] ⏳ Buscando _ud de GHL con reintentos...");
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
rstkLocal.contact_id=ghlUserData.customer_id||ghlUserData.id;
rstkLocal.email=ghlUserData.email||rstkLocal.email;
rstkLocal.phone=ghlUserData.phone||rstkLocal.phone;
rstkLocal.ghl_detected=true;
rstkLocal.ghl_detected_at=new Date().toISOString();
a.setItem("rstk_local",JSON.stringify(rstkLocal));
console.log("[HT] 💾 rstk_local actualizado con datos de GHL detectados");
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
.then(function(r){console.log("[HT] ✅ Datos GHL actualizados en backend")})
.catch(function(e){console.log("[HT] ⚠️ Error actualizando GHL:",e)});
}
clearInterval(udInterval);
}
if(udAttempts>=20&&!udDetected){// 20 intentos = 40 segundos
clearInterval(udInterval);
console.log("[HT] ℹ️ _ud no detectado después de",udAttempts,"intentos (es normal si no es usuario GHL)");
}
},2000);// Cada 2 segundos
}
Object.keys(o).forEach((function(e){null!=o[e]&&""!==o[e]||delete o[e]}));
var cleanData={};Object.keys(o).forEach(function(k){if(o[k]!==null&&o[k]!==undefined&&o[k]!==""){cleanData[k]=o[k]}});
console.group("[HT] 📤 Enviando: "+(n||"page_view"));
console.log("🌐 URL:",cleanData.url);
cleanData.ref&&console.log("⬅️ Referrer:",cleanData.ref);
cleanData.utm_source&&console.log("📊 UTM Source:",cleanData.utm_source);
cleanData.utm_campaign&&console.log("📢 UTM Campaign:",cleanData.utm_campaign);
cleanData.gclid&&console.log("🔍 Google Click ID:",cleanData.gclid);
cleanData.fbclid&&console.log("📘 Facebook Click ID:",cleanData.fbclid);
cleanData.email&&console.log("📧 Email:",cleanData.email);
cleanData.phone&&console.log("📱 Phone:",cleanData.phone);
cleanData.ghl_contact_id&&console.log("👤 GHL Contact:",cleanData.ghl_contact_id);
var paramCount=Object.keys(cleanData).length;
console.log("📦 Total parámetros enviados:",paramCount);
console.log("📋 Datos completos:",cleanData);
console.groupEnd();
fetch(x,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o),keepalive:!0})
.then((function(r){
console.log("[HT] ✅ Evento enviado exitosamente (Status: "+r.status+")");
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
console.log("[HT] 💾 rstk_local actualizado (LEAD CONVERTIDO):",rstkLocal)
}}).catch(function(){})}}))
.catch((function(e){console.warn("[HT] ⚠️ Error, reintentando con beacon:",e.message);
if(navigator.sendBeacon){var n=new Blob([JSON.stringify(o)],{type:"application/json"});
navigator.sendBeacon(x,n)&&console.log("[HT] 📡 Beacon enviado como fallback")}}))};
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
    // MANEJO ESPECIAL DE EVENTO ghl_update - NO CREAR NUEVA SESIÓN
    // =============================================================================
    if (data.event === 'ghl_update') {
      console.log('🔄 [GHL UPDATE] Actualizando datos de GHL sin crear nueva sesión');

      // Solo actualizar si viene contact_id de GHL
      if (data.ghl_contact_id) {
        try {
          // Primero intentar crear/unificar el contacto
          const contactData = {
            id: data.ghl_contact_id,
            email: data.email,
            phone: data.phone
          };

          const contactUnificationService = require('../services/contact-unification.service');
          const unifiedContact = await contactUnificationService.findOrCreateUnified(contactData);

          if (unifiedContact && unifiedContact.contact_id) {
            // Actualizar TODAS las sesiones del visitor con el contact_id
            const updateResult = await databasePool.query(
              `UPDATE tracking.sessions
               SET contact_id = $1
               WHERE visitor_id = $2 AND contact_id IS NULL`,
              [unifiedContact.contact_id, visitorId]
            );

            console.log(`✅ [GHL UPDATE] ${updateResult.rowCount} sesiones actualizadas con contact_id: ${unifiedContact.contact_id}`);

            // IMPORTANTE: También obtener datos de atribución de la primera sesión con UTMs
            const attributionQuery = `
              SELECT
                utm_source,
                utm_campaign,
                utm_medium,
                fbclid,
                gclid,
                ad_id,
                campaign_id
              FROM tracking.sessions
              WHERE visitor_id = $1
                AND (utm_source IS NOT NULL
                     OR fbclid IS NOT NULL
                     OR gclid IS NOT NULL
                     OR ad_id IS NOT NULL)
              ORDER BY created_at ASC
              LIMIT 1
            `;

            const attrResult = await databasePool.query(attributionQuery, [visitorId]);

            if (attrResult.rows.length > 0) {
              const attr = attrResult.rows[0];
              // Determinar rstk_adid (prioridad: ad_id > fbclid > gclid > campaign_id)
              const rstk_adid = attr.ad_id || attr.fbclid || attr.gclid || attr.campaign_id;
              const rstk_source = attr.utm_source;

              if (rstk_adid || rstk_source) {
                // Actualizar el contacto con datos de atribución
                const updateContactQuery = `
                  UPDATE contacts
                  SET
                    rstk_adid = COALESCE(rstk_adid, $2),
                    rstk_source = COALESCE(rstk_source, $3),
                    visitor_id = COALESCE(visitor_id, $4),
                    updated_at = NOW()
                  WHERE contact_id = $1
                  RETURNING contact_id, rstk_adid, rstk_source
                `;

                const contactUpdateResult = await databasePool.query(
                  updateContactQuery,
                  [unifiedContact.contact_id, rstk_adid, rstk_source, visitorId]
                );

                if (contactUpdateResult.rows.length > 0) {
                  const updated = contactUpdateResult.rows[0];
                  console.log(`📊 [GHL UPDATE] Contacto actualizado con atribución first-touch:`, {
                    contact_id: updated.contact_id,
                    rstk_adid: updated.rstk_adid,
                    rstk_source: updated.rstk_source
                  });
                }
              }
            }

            // Si había rstk_vid en el _ud, también verificar si necesitamos hacer matching
            if (data.rstk_vid && data.rstk_vid !== visitorId) {
              console.log(`🔄 [GHL UPDATE] Detectado rstk_vid diferente: ${data.rstk_vid} vs ${visitorId}`);
              // Aquí podríamos hacer matching adicional si es necesario
            }
          }
        } catch (updateError) {
          console.error('❌ [GHL UPDATE] Error actualizando contact_id:', updateError);
        }
      }

      // Devolver OK sin crear nueva sesión
      return res.json({
        success: true,
        message: 'GHL data updated',
        visitor_id: visitorId
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
        device_fingerprint,
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
        -- NUEVAS COLUMNAS DE FINGERPRINTING
        canvas_fingerprint,
        webgl_fingerprint,
        screen_fingerprint,
        audio_fingerprint,
        fonts_fingerprint,
        device_signature,
        fingerprint_probability
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
        $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81, $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92, $93, $94, $95, $96, $97,
        $98, $99, $100, $101, $102, $103, $104, $105, $106, $107, $108, $109, $110, $111,
        $112, $113, $114, $115, $116, $117, $118
      )
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
      0,                                  // $9 duration_seconds
      data.url || null,                   // $10 landing_url (ahora es la URL actual)
      urlData.host,                       // $11 landing_host
      urlData.path,                       // $12 landing_path
      urlData.query,                      // $13 landing_query
      urlData.fragment,                   // $14 landing_fragment
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
      data.network || null,               // $51 network
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
      null,                               // $72 device_fingerprint
      null,                               // $73 fingerprint_confidence
      JSON.stringify(clientHints),        // $74 client_hints
      JSON.stringify({}),                 // $75 fp_signals
      data.cookies_enabled ?? false,      // $76 cookies_enabled
      data.local_storage_enabled ?? false,// $77 local_storage_enabled
      null,                               // $78 ad_blocker
      null,                               // $79 bot_detected
      null,                               // $80 bot_provider
      null,                               // $81 bot_score
      null,                               // $82 ip_asn
      null,                               // $83 ip_isp
      null,                               // $84 ip_is_proxy
      null,                               // $85 ip_is_vpn
      null,                               // $86 ip_is_tor
      data.country || null,               // $87 geo_country
      data.region || null,                // $88 geo_region
      data.city || null,                  // $89 geo_city
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
      null,                               // $100 email_sha256
      data.phone || null,                 // $101 phone
      null,                               // $102 phone_e164
      null,                               // $103 phone_sha256
      JSON.stringify({                    // $104 external_ids
        ghl_contact_id: data.ghl_contact_id || null,
        ghl_location_id: data.ghl_location_id || null
      }),
      null,                               // $105 consent_marketing
      null,                               // $106 consent_ads
      null,                               // $107 consent_ts
      null,                               // $108 consent_string_tcf
      null,                               // $109 gpc
      Boolean(data.do_not_track),         // $110 do_not_track
      JSON.stringify({                    // $111 properties
        screen: data.screen_width && data.screen_height ?
          `${data.screen_width}x${data.screen_height}` : null,
        viewport: data.viewport_width && data.viewport_height ?
          `${data.viewport_width}x${data.viewport_height}` : null,
        timestamp: data.ts || new Date().toISOString(),
        ghl_source: data.ghl_source || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        full_name: data.full_name || null
      }),
      // NUEVOS PARÁMETROS DE FINGERPRINTING
      data.canvas_fp || null,             // $112 canvas_fingerprint
      data.webgl_fp || null,              // $113 webgl_fingerprint
      data.screen_fp || null,             // $114 screen_fingerprint
      data.audio_fp || null,              // $115 audio_fingerprint
      data.fonts_fp || null,              // $116 fonts_fingerprint
      data.device_sig || null,            // $117 device_signature
      // Calcular calidad de fingerprinting (qué tan confiable es)
      (() => {
        let quality = 0;
        if (data.canvas_fp) quality += 30;
        if (data.webgl_fp) quality += 25;
        if (data.screen_fp) quality += 10;
        if (data.audio_fp) quality += 15;
        if (data.fonts_fp) quality += 20;
        return quality > 0 ? quality : null;
      })()                                 // $118 fingerprint_probability (calidad del fingerprint)
    ]);

    // =============================================================================
    // MATCHING CONTACT CON UNIFICACIÓN INTELIGENTE
    // =============================================================================
    // PRIORIDAD:
    // 1. Si viene contact_id de rstk_local (nuestro sistema)
    // 2. Si viene ghl_contact_id de _ud (fallback de GHL)
    // 3. Si viene email o phone (cualquier fuente)
    const hasRstkLocalData = data.contact_id && !data.ghl_contact_id; // contact_id sin ghl_contact_id = viene de rstk_local
    const hasGhlData = data.ghl_contact_id; // viene de _ud
    const hasContactData = data.email || data.phone;

    if (hasRstkLocalData || hasGhlData || hasContactData) {
      try {
        const contactUnificationService = require('../services/contact-unification.service');
        const fingerprintUnificationService = require('../services/fingerprint-unification.service');

        // IMPORTANTE: Los datos de attribution están en la SESIÓN ACTUAL
        // El flujo es:
        // 1. Usuario llega con parámetros de campaña a página de conversión
        // 2. Llena formulario (aquí están los datos de attribution)
        // 3. Es redirigido a thank you page (aquí aparece el _ud pero SIN parámetros)
        // Por eso usamos los datos de la sesión ACTUAL que tiene los parámetros

        // Preparar datos para unificación inteligente
        const contactData = {
          // IDs
          ghl_contact_id: data.ghl_contact_id || null,
          ext_crm_id: data.ghl_contact_id || null,

          // VISITOR ID - MUY IMPORTANTE PARA TRACKING
          visitor_id: visitorId,

          // Datos personales
          first_name: data.first_name || data.firstName || null,
          last_name: data.last_name || data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,

          // Attribution - USAR DATOS DE LA SESIÓN ACTUAL (donde convierte)
          // Estos vienen de la URL con parámetros de campaña
          rstk_adid: data.ad_id || data.fbclid || data.gclid ||
                     data.campaign_id || null,
          // rstk_source debe ser específicamente el utm_source (fb_ad, google_ads, etc)
          rstk_source: data.utm_source || data.site_source_name || null,

          // Metadata
          source: data.ghl_source || data.utm_source || channel || 'Tracking',
          status: 'lead', // El tracking siempre es lead inicial

          // Datos extra que podrían venir
          company: data.company || null,
          full_name: data.full_name || data.name || null
        };

        console.log('[Tracking → Contact] Procesando con unificación inteligente:', {
          email: contactData.email,
          phone: contactData.phone,
          ghl_id: contactData.ghl_contact_id
        });

        // USAR SERVICIO DE UNIFICACIÓN INTELIGENTE
        // Este servicio:
        // 1. Busca duplicados por email, phone, ext_crm_id, contact_id
        // 2. Si encuentra duplicados, los unifica sin perder información
        // 3. Si no encuentra, crea uno nuevo
        // 4. Migra todas las referencias (pagos, citas, sesiones) al contacto maestro
        const unifiedContact = await contactUnificationService.findOrCreateUnified(contactData);

        if (unifiedContact && unifiedContact.contact_id) {
          // ACTUALIZACIÓN CRÍTICA: Vinculamos TODAS las sesiones históricas del mismo visitor_id
          // Esto permite hacer match retroactivo cuando el usuario convierte
          const updateResult = await databasePool.query(
            `UPDATE tracking.sessions
             SET contact_id = $1
             WHERE visitor_id = $2 AND contact_id IS NULL`,
            [unifiedContact.contact_id, visitorId]
          );

          console.log(`[Tracking → Contact] ✅ ${updateResult.rowCount} sesiones históricas del visitor ${visitorId} vinculadas a contacto ${unifiedContact.contact_id}`);

          // NUEVO: También actualizar el contacto con datos de atribución si no los tenía
          // Esto es importante para que el contacto tenga rstk_adid y rstk_source
          if (contactData.rstk_adid || contactData.rstk_source) {
            const updateContactQuery = `
              UPDATE contacts
              SET
                rstk_adid = COALESCE(rstk_adid, $2),
                rstk_source = COALESCE(rstk_source, $3),
                visitor_id = COALESCE(visitor_id, $4),
                updated_at = NOW()
              WHERE contact_id = $1
              RETURNING contact_id, rstk_adid, rstk_source
            `;

            const contactUpdateResult = await databasePool.query(
              updateContactQuery,
              [
                unifiedContact.contact_id,
                contactData.rstk_adid,
                contactData.rstk_source,
                visitorId
              ]
            );

            if (contactUpdateResult.rows.length > 0) {
              const updated = contactUpdateResult.rows[0];
              console.log(`[Tracking → Contact] 📊 Contacto actualizado con atribución:`, {
                contact_id: updated.contact_id,
                rstk_adid: updated.rstk_adid,
                rstk_source: updated.rstk_source
              });
            }
          }

          // Ya no marcamos pages como "lead" - todas quedan como page_view

          // También guardar en nuestro propio localStorage (rstk_local)
          // Esto se hace en el cliente, no en el servidor

          // NUEVO: Unificación probabilística por fingerprints
          // Buscar y vincular sesiones con fingerprints similares
          const currentSessionData = {
            visitor_id: visitorId,
            canvas_fingerprint: data.canvas_fp,
            webgl_fingerprint: data.webgl_fp,
            screen_fingerprint: data.screen_fp,
            audio_fingerprint: data.audio_fp,
            fonts_fingerprint: data.fonts_fp,
            device_signature: data.device_sig,
            ip: ip,
            timezone: data.timezone,
            user_agent: data.user_agent
          };

          const unificationResult = await fingerprintUnificationService.unifySessionsOnConversion(
            unifiedContact.contact_id,
            currentSessionData
          );

          if (unificationResult.unified > 0) {
            console.log(`[Fingerprint Unification] ✅ ${unificationResult.unified} sesiones unificadas por fingerprint`);
            console.log(`[Fingerprint Unification] Visitor IDs unificados: ${unificationResult.visitorIds.join(', ')}`);
            console.log(`[Fingerprint Unification] Probabilidad: ${unificationResult.probability}%`);
          }
        }

      } catch (matchingError) {
        console.error('Error en matching GHL → Contact con unificación:', matchingError);
        // No fallar el tracking si falla el matching
      }
    }

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
