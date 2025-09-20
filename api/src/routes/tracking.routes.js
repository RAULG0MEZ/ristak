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
// GET /snip.js - Servir el script de tracking minificado
// =============================================================================
router.get('/snip.js', (req, res) => {
  const sid = req.query.s || DEFAULT_TRACKING_ID;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = extractTrackingHostname(req) || req.get('host');

  // Script MEJORADO con auto-append de visitor_id a URLs
  const script = `!function(){
var e="${sid}",t="${protocol}://${host}",n="rstk_vid",o="rstk_session",r="rstk_session_num",a=localStorage,s=sessionStorage,i=Date.now(),
c=function(e){var t=RegExp("[?&]"+e+"=([^&]*)").exec(location.search);return t&&decodeURIComponent(t[1].replace(/\\+/g," "))},
l=function(e){var t="; "+document.cookie,n=t.split("; "+e+"=");return 2===n.length?n.pop().split(";").shift():null},
// MODIFICADO: Primero checamos si viene rstk_vid en la URL
urlVid=c("rstk_vid")||c("vid"),
u=urlVid||a.getItem(n);
// Si no existe rstk_vid, lo creamos
if(!u){u="v"+i+"_"+Math.random().toString(36).substring(2,9)}
// Siempre guardamos en localStorage
a.setItem(n,u);
// Si no existía antes, es primera visita
if(!urlVid&&!a.getItem(r)){a.setItem(r,"1")}
var d=a.getItem("rstk_last_activity"),g=s.getItem(o),m=parseInt(a.getItem(r)||"1");
(!g||!d||i-parseInt(d)>18e5)&&(g="s"+i+"_"+Math.random().toString(36).substring(2,9),s.setItem(o,g),d&&(m++,a.setItem(r,m.toString()))),
a.setItem("rstk_last_activity",i.toString());
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
// NUEVO: También actualizar la URL actual si no tiene rstk_vid
if(!c("rstk_vid")&&!c("vid")){
try{
var currentUrl=new URL(location.href);
currentUrl.searchParams.set('rstk_vid',u);
history.replaceState(null,'',currentUrl.toString());
console.log("[HT] 📍 URL actual actualizada con rstk_vid");
}catch(e){}
}
var f=function(n){
var o={
// Identificadores principales
sid:e,vid:u,sess:g,session_num:m,
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
ga_session_number:c("ga_session_number"),
// Geolocalización (si viene en params)
country:c("country"),
region:c("region"),
city:c("city"),
// Source y channel
source:c("source"),
channel:c("channel")
};
// Intentar obtener datos del usuario guardados
try{var r=a.getItem("_ud");if(r){var userData=JSON.parse(r);
o.ghl_contact_id=userData.customer_id||userData.id,
o.ghl_location_id=userData.location_id,
!o.email&&userData.email&&(o.email=userData.email),
!o.phone&&userData.phone&&(o.phone=userData.phone),
o.first_name=userData.first_name||userData.firstName,
o.last_name=userData.last_name||userData.lastName,
o.full_name=userData.full_name||userData.name,
o.country=o.country||userData.country,
userData.source&&(o.ghl_source=userData.source)}}catch(e){}
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
.then((function(r){console.log("[HT] ✅ Evento enviado exitosamente (Status: "+r.status+")")}))
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
    const visitorId = data.vid;
    const sessionId = data.sess;
    const sessionNumber = data.session_num || 1;

    // Validación básica - AMBOS IDs son requeridos
    if (!visitorId || !sessionId) {
      console.log('❌ ERROR: Missing IDs - vid:', visitorId, 'sess:', sessionId);
      return res.status(400).json({ error: 'Missing required tracking IDs (vid and sess)' });
    }

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

    // Obtener IP real
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress;

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

    // CAMBIADO: Cada pageview es una nueva fila, no un UPDATE
    // Agregamos un ID único para cada pageview manteniendo el session_id para agrupar
    const pageviewId = `${sessionId}_${Date.now()}`; // ID único para cada pageview

    // Query modificado - ahora SIEMPRE inserta nueva fila
    const query = `
      INSERT INTO tracking.sessions (
        id,                  -- ID único para cada pageview
        session_id,          -- ID compartido de la sesión
        visitor_id,
        contact_id,
        session_number,
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
        ga_session_number,
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
        properties
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39,
        $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62,
        $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80, $81, $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92, $93, $94, $95, $96, $97, $98, $99,
        $100, $101, $102, $103, $104, $105, $106, $107, $108, $109, $110, $111, $112, $113, $114
      )
    `;

    // Preparar valores para TODOS los campos (114 parámetros ahora con el ID)
    await databasePool.query(query, [
      pageviewId,                         // $1 id (único para cada pageview)
      sessionId,                          // $2 session_id (compartido en la sesión)
      visitorId,                          // $3 visitor_id
      null,                               // $4 contact_id (se actualiza después)
      sessionNumber,                      // $5 session_number
      data.event || 'page_view',         // $6 event_name
      new Date().toISOString(),          // $7 started_at (UTC)
      null,                               // $8 ended_at
      new Date().toISOString(),          // $9 last_event_at (UTC)
      new Date().toISOString(),          // $10 created_at (UTC)
      0,                                  // $11 duration_seconds
      data.url || null,                   // $12 landing_url (ahora es la URL actual)
      urlData.host,                       // $13 landing_host
      urlData.path,                       // $14 landing_path
      urlData.query,                      // $15 landing_query
      urlData.fragment,                   // $16 landing_fragment
      data.ref || null,                   // $17 referrer_url
      referrerData.domain || null,        // $18 referrer_domain
      data.utm_source || null,            // $19 utm_source
      data.utm_medium || null,            // $20 utm_medium
      data.utm_campaign || null,          // $21 utm_campaign
      data.utm_term || null,              // $22 utm_term
      data.utm_content || null,           // $23 utm_content
      data.utm_id || null,                // $24 utm_id
      data.fbclid || null,                // $25 fbclid
      data.fbc || null,                   // $26 fbc
      data.fbp || null,                   // $27 fbp
      data.gclid || null,                 // $28 gclid
      data.wbraid || null,                // $29 wbraid
      data.gbraid || null,                // $30 gbraid
      data.msclkid || null,               // $31 msclkid
      data.ttclid || null,                // $32 ttclid
      data.twclid || null,                // $33 twclid
      data.li_fat_id || null,             // $34 li_fat_id
      data.epik || null,                  // $35 epik
      data.pclid || null,                 // $36 pclid
      data.sc_click_id || null,           // $37 sc_click_id
      data.rdt_cid || null,               // $38 rdt_cid
      data.qclid || null,                 // $39 qclid
      data.yclid || null,                 // $40 yclid
      channel,                            // $41 channel
      data.source || data.utm_source || null,     // $42 source_platform
      data.campaign_id || null,           // $43 campaign_id
      data.adset_id || data.ad_group_id || null,  // $44 adset_id
      data.ad_group_id || null,           // $45 ad_group_id
      data.ad_id || null,                 // $46 ad_id
      data.campaign_name || null,         // $47 campaign_name
      data.adset_name || data.ad_group_name || null,  // $48 adset_name
      data.ad_group_name || null,         // $49 ad_group_name
      data.ad_name || null,               // $50 ad_name
      data.placement || null,             // $51 placement
      data.site_source_name || null,      // $52 site_source_name
      data.network || null,               // $53 network
      data.device || uaResult.device.type || null,     // $54 device
      data.match_type || data.matchtype || null,       // $55 match_type
      data.keyword || null,               // $56 keyword
      data.search_query || null,          // $57 search_query
      data.target_id || data.targetid || null,         // $58 target_id
      data.creative_id || data.creative || null,       // $59 creative_id
      data.ad_position || data.adposition || null,     // $60 ad_position
      data.loc_physical_ms || null,       // $61 loc_physical_ms
      data.loc_interest_ms || null,       // $62 loc_interest_ms
      data.gclsrc || null,                // $63 gclsrc
      JSON.stringify(sourceMeta),         // $64 source_meta
      ip,                                 // $65 ip
      data.user_agent || req.headers['user-agent'],    // $66 user_agent
      uaResult.device.type || null,       // $67 device_type
      uaResult.os.name || null,           // $68 os
      uaResult.browser.name || null,      // $69 browser
      uaResult.browser.version || null,   // $70 browser_version
      data.language || null,              // $71 language
      data.timezone || null,              // $72 timezone
      null,                               // $73 fp_vendor
      null,                               // $74 device_fingerprint
      null,                               // $75 fingerprint_confidence
      JSON.stringify(clientHints),        // $76 client_hints
      JSON.stringify({}),                 // $77 fp_signals
      data.cookies_enabled ?? false,      // $78 cookies_enabled
      data.local_storage_enabled ?? false,// $79 local_storage_enabled
      null,                               // $80 ad_blocker
      null,                               // $81 bot_detected
      null,                               // $82 bot_provider
      null,                               // $83 bot_score
      null,                               // $84 ip_asn
      null,                               // $85 ip_isp
      null,                               // $86 ip_is_proxy
      null,                               // $87 ip_is_vpn
      null,                               // $88 ip_is_tor
      data.country || null,               // $89 geo_country
      data.region || null,                // $90 geo_region
      data.city || null,                  // $91 geo_city
      data.ga_client_id || null,          // $92 ga_client_id
      data.ga_session_id ? BigInt(data.ga_session_id) : null,  // $93 ga_session_id
      data.ga_session_number || null,     // $94 ga_session_number
      1,                                  // $95 pageviews_count (siempre 1 por fila)
      1,                                  // $96 events_count
      false,                              // $97 is_bounce
      0,                                  // $98 orders_count
      0.00,                               // $99 revenue_value
      null,                               // $100 currency
      null,                               // $101 last_order_id
      data.email || null,                 // $102 email
      null,                               // $103 email_sha256
      data.phone || null,                 // $104 phone
      null,                               // $105 phone_e164
      null,                               // $106 phone_sha256
      JSON.stringify({                    // $107 external_ids
        ghl_contact_id: data.ghl_contact_id || null,
        ghl_location_id: data.ghl_location_id || null
      }),
      null,                               // $108 consent_marketing
      null,                               // $109 consent_ads
      null,                               // $110 consent_ts
      null,                               // $111 consent_string_tcf
      null,                               // $112 gpc
      Boolean(data.do_not_track),         // $113 do_not_track
      JSON.stringify({                    // $114 properties
        screen: data.screen_width && data.screen_height ?
          `${data.screen_width}x${data.screen_height}` : null,
        viewport: data.viewport_width && data.viewport_height ?
          `${data.viewport_width}x${data.viewport_height}` : null,
        timestamp: data.ts || new Date().toISOString(),
        ghl_source: data.ghl_source || null,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        full_name: data.full_name || null
      })  // $114 (último parámetro)
    ]);

    // =============================================================================
    // MATCHING GHL → CONTACT CON UNIFICACIÓN INTELIGENTE
    // =============================================================================
    // Si viene con datos de GHL, email o phone, usar el servicio de unificación
    if (data.ghl_contact_id || data.email || data.phone) {
      try {
        const contactUnificationService = require('../services/contact-unification.service');

        // Preparar datos para unificación inteligente
        const contactData = {
          // IDs
          ghl_contact_id: data.ghl_contact_id || null,
          ext_crm_id: data.ghl_contact_id || null,

          // Datos personales
          first_name: data.first_name || data.firstName || null,
          last_name: data.last_name || data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,

          // Attribution
          attribution_ad_id: data.ad_id || data.fbclid || data.gclid ||
                            data.utm_campaign || data.campaign_id || null,

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
          // CAMBIADO: Ahora actualizamos TODAS las filas de esta sesión
          // Ya que cada pageview es una fila separada
          const updateResult = await databasePool.query(
            'UPDATE tracking.sessions SET contact_id = $1 WHERE session_id = $2',
            [unifiedContact.contact_id, sessionId]
          );

          console.log(`[Tracking → Contact] ${updateResult.rowCount} pageviews de sesión ${sessionId} vinculados a contacto ${unifiedContact.contact_id}`);
        }

      } catch (matchingError) {
        console.error('Error en matching GHL → Contact con unificación:', matchingError);
        // No fallar el tracking si falla el matching
      }
    }

    res.json({ success: true });

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
