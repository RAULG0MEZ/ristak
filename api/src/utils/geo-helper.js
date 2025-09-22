const geoip = require('geoip-lite');

/**
 * Helper para obtener información geográfica desde IP
 * Usa la librería geoip-lite para obtener ubicación sin hacer llamadas externas
 */

/**
 * Obtiene la información geográfica desde una IP
 * @param {string} ip - Dirección IP a geolocalizar
 * @returns {object} Objeto con country, region y city o valores por defecto
 */
function getGeoFromIP(ip) {
  try {
    // Si no hay IP, devolver valores por defecto
    if (!ip) {
      return {
        country: null,
        region: null,
        city: null
      };
    }

    // Limpiar la IP (quitar puerto si viene con él)
    const cleanIP = ip.split(':')[0];

    // IPs especiales de Facebook/Meta (empiezan con 2a03:2880 o similar)
    // Estas son IPs de los proxies de Facebook, no del usuario real
    if (cleanIP.startsWith('2a03:2880') || cleanIP.startsWith('2600:') ||
        cleanIP.startsWith('2a03:') || cleanIP === '::1' ||
        cleanIP.includes('::')) {
      // Para IPs de Facebook/Meta o IPv6 especiales, no podemos obtener ubicación real
      return {
        country: 'Via Facebook/Proxy',
        region: null,
        city: null
      };
    }

    // IPs locales
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.')) {
      return {
        country: 'Local',
        region: null,
        city: null
      };
    }

    // Intentar obtener geolocalización
    const geo = geoip.lookup(cleanIP);

    if (!geo) {
      // Si no se encuentra información, devolver null pero no error
      return {
        country: null,
        region: null,
        city: null
      };
    }

    // Mapeo de códigos de país a nombres legibles (los más comunes en México)
    const countryNames = {
      'MX': 'México',
      'US': 'Estados Unidos',
      'CA': 'Canadá',
      'ES': 'España',
      'AR': 'Argentina',
      'CO': 'Colombia',
      'CL': 'Chile',
      'PE': 'Perú',
      'VE': 'Venezuela',
      'BR': 'Brasil',
      'EC': 'Ecuador',
      'GT': 'Guatemala',
      'CR': 'Costa Rica',
      'PA': 'Panamá',
      'DO': 'República Dominicana',
      'HN': 'Honduras',
      'SV': 'El Salvador',
      'NI': 'Nicaragua',
      'BO': 'Bolivia',
      'PY': 'Paraguay',
      'UY': 'Uruguay'
    };

    // Mapeo de códigos de estado/región para México
    const mexicoStates = {
      'AGU': 'Aguascalientes',
      'BCN': 'Baja California',
      'BCS': 'Baja California Sur',
      'CAM': 'Campeche',
      'CHP': 'Chiapas',
      'CHH': 'Chihuahua',
      'CMX': 'Ciudad de México',
      'COA': 'Coahuila',
      'COL': 'Colima',
      'DUR': 'Durango',
      'GUA': 'Guanajuato',
      'GRO': 'Guerrero',
      'HID': 'Hidalgo',
      'JAL': 'Jalisco',
      'MEX': 'Estado de México',
      'MIC': 'Michoacán',
      'MOR': 'Morelos',
      'NAY': 'Nayarit',
      'NLE': 'Nuevo León',
      'OAX': 'Oaxaca',
      'PUE': 'Puebla',
      'QUE': 'Querétaro',
      'ROO': 'Quintana Roo',
      'SLP': 'San Luis Potosí',
      'SIN': 'Sinaloa',
      'SON': 'Sonora',
      'TAB': 'Tabasco',
      'TAM': 'Tamaulipas',
      'TLA': 'Tlaxcala',
      'VER': 'Veracruz',
      'YUC': 'Yucatán',
      'ZAC': 'Zacatecas'
    };

    // Si es México, traducir el estado
    let regionName = geo.region || null;
    if (geo.country === 'MX' && geo.region) {
      regionName = mexicoStates[geo.region] || geo.region;
    }

    return {
      country: countryNames[geo.country] || geo.country || null,
      region: regionName,
      city: geo.city || null,
      // Información adicional útil
      timezone: geo.timezone || null,
      ll: geo.ll || null, // latitud y longitud [lat, lon]
      countryCode: geo.country || null,
      // Para México, agregar coordenadas del estado
      stateCoordinates: geo.country === 'MX' && geo.ll ? geo.ll : null
    };

  } catch (error) {
    console.error('[GeoHelper] Error al obtener geo de IP:', error);
    return {
      country: null,
      region: null,
      city: null
    };
  }
}

/**
 * Procesa un array de visitantes agregando información geográfica
 * @param {Array} visitors - Array de visitantes con IPs
 * @returns {Array} Visitantes con información geo agregada
 */
function enrichVisitorsWithGeo(visitors) {
  return visitors.map(visitor => {
    // Si ya tiene datos geo válidos, no procesar
    if (visitor.location && visitor.location.country && visitor.location.country !== 'No disponible') {
      return visitor;
    }

    // Obtener geo desde IP
    const geoData = getGeoFromIP(visitor.ip);

    // Mezclar con datos existentes (priorizar datos de BD si existen)
    return {
      ...visitor,
      location: {
        country: visitor.location?.country || geoData.country || 'No disponible',
        region: visitor.location?.region || geoData.region || null,
        city: visitor.location?.city || geoData.city || 'No disponible',
        timezone: geoData.timezone || null
      }
    };
  });
}

module.exports = {
  getGeoFromIP,
  enrichVisitorsWithGeo
};