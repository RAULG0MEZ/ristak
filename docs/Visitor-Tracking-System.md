# 🎯 Sistema de Visitor Tracking - Documentación Completa

## Resumen Ejecutivo

El sistema de tracking de Ristak Pro utiliza un identificador único llamado `rstk_vid` (Ristak Visitor ID) que permite rastrear a los visitantes a través de todo su journey, desde la primera visita hasta la conversión en cliente. Este ID se mantiene consistente y se vincula automáticamente con contactos y pagos.

## 🔑 Componentes Clave

### 1. Visitor ID (`rstk_vid`)
- **Formato**: `v{timestamp}_{random}` (ej: `v1734567890_abc123`)
- **Almacenamiento**: localStorage con key `rstk_vid`
- **Propagación**: URL parameter `?rstk_vid=xxx`
- **Persistencia**: Permanente hasta limpiar localStorage

### 2. Session ID
- **Formato**: `s{timestamp}_{random}`
- **Almacenamiento**: sessionStorage con key `rstk_session`
- **Timeout**: 30 minutos de inactividad
- **Renovación**: Nueva sesión después del timeout

### 3. Keys de localStorage/sessionStorage
| Key | Tipo | Descripción | Ejemplo |
|-----|------|-------------|---------|
| `rstk_vid` | localStorage | Visitor ID único | `v1234567_abc123` |
| `rstk_session` | sessionStorage | Session ID actual | `s1234567_xyz789` |
| `rstk_session_num` | localStorage | Número de sesión | `1`, `2`, `3`... |
| `rstk_last_activity` | localStorage | Timestamp última actividad | `1734567890000` |
| `_ud` | localStorage | Datos de usuario (GHL) | `{customer_id: "ghl_123"}` |

## 🔄 Flujos de Emparejamiento

### Flujo 1: Generación y Propagación del Visitor ID

```javascript
// 1. Primera visita - Generación del ID
if (!visitor_id) {
  visitor_id = "v" + Date.now() + "_" + Math.random().toString(36).substring(2,9);
  localStorage.setItem("rstk_vid", visitor_id);
}

// 2. Propagación automática en URLs
// El snip.js automáticamente agrega ?rstk_vid=xxx a todos los links internos
```

**Ubicación en código**: `/api/src/routes/tracking.routes.js` (líneas 60-68)

### Flujo 2: Captura desde localStorage con datos de GHL

El sistema busca automáticamente en localStorage un objeto `_ud` (User Data) que puede contener información de GoHighLevel:

```javascript
// Búsqueda automática en localStorage
var userData = localStorage.getItem("_ud");
if (userData) {
  var data = JSON.parse(userData);
  // Extrae datos de GHL
  ghl_contact_id = data.customer_id || data.id;
  ghl_location_id = data.location_id;
  email = data.email;
  phone = data.phone;
}
```

**Campos capturados del localStorage `_ud`**:
- `customer_id` o `id` → `ghl_contact_id`
- `location_id` → `ghl_location_id`
- `email` → Email del contacto
- `phone` → Teléfono del contacto
- `first_name` o `firstName` → Nombre
- `last_name` o `lastName` → Apellido
- `full_name` o `name` → Nombre completo
- `country` → País
- `source` → Fuente de origen

**Ubicación en código**: `/api/src/routes/tracking.routes.js` (líneas 230-239)

### Flujo 3: Emparejamiento vía Webhook de Contactos

Cuando se recibe un webhook de contacto con `rstk_vid`:

```javascript
// POST /webhook/contacts
{
  "contact_id": "ghl_123",
  "email": "juan@example.com",
  "rstk_vid": "v1234567_abc123"  // <-- Visitor ID
}

// El sistema automáticamente:
// 1. Crea/actualiza el contacto
// 2. Vincula TODAS las sesiones con ese visitor_id al contact_id
UPDATE tracking.sessions
SET contact_id = 'ghl_123'
WHERE visitor_id = 'v1234567_abc123'
```

**Ubicación en código**: `/api/src/services/webhook.service.js` (líneas 54-66)

### Flujo 4: Emparejamiento vía Webhook de Pagos

Cuando se recibe un webhook de pago con `rstk_vid`:

```javascript
// POST /webhook/payments
{
  "transaction_id": "TXN-123",
  "monto": 1500.00,
  "contact_id": "ghl_123",
  "rstk_vid": "v1234567_abc123"  // <-- Visitor ID
}

// El sistema automáticamente:
// 1. Crea el registro de pago
// 2. Actualiza las métricas de tracking
UPDATE tracking.sessions
SET
  contact_id = 'ghl_123',
  orders_count = orders_count + 1,
  revenue_value = revenue_value + 1500.00,
  last_order_id = 'TXN-123'
WHERE visitor_id = 'v1234567_abc123'
```

**Ubicación en código**: `/api/src/services/webhook.service.js` (líneas 149-164)

### Flujo 5: Emparejamiento durante la sesión de tracking

Durante cada página vista (`/collect`), si el sistema detecta datos de GHL:

```javascript
// En cada pageview, si hay email, phone o ghl_contact_id
if (data.ghl_contact_id || data.email || data.phone) {
  // Usa el servicio de unificación inteligente
  const unifiedContact = await contactUnificationService.findOrCreateUnified({
    ghl_contact_id: data.ghl_contact_id,
    email: data.email,
    phone: data.phone
  });

  // Vincula todas las sesiones con ese visitor
  UPDATE tracking.sessions
  SET contact_id = unifiedContact.contact_id
  WHERE session_id = current_session_id
}
```

**Ubicación en código**: `/api/src/routes/tracking.routes.js` (líneas 668-708)

## 📊 Matriz de Emparejamiento

| Fuente de Datos | Campo Clave | Se empareja con | Prioridad | Ubicación |
|-----------------|------------|-----------------|-----------|-----------|
| URL Parameter | `rstk_vid` o `vid` | visitor_id en tracking.sessions | 1 (Alta) | snip.js línea 61 |
| localStorage | `rstk_vid` | visitor_id en tracking.sessions | 2 | snip.js línea 62 |
| localStorage `_ud` | `customer_id` o `id` | contact_id vía ghl_contact_id | 3 | tracking.routes.js línea 231 |
| Webhook Contact | `rstk_vid` | visitor_id → contact_id | 4 | webhook.service.js línea 54 |
| Webhook Payment | `rstk_vid` | visitor_id → contact_id + revenue | 5 | webhook.service.js línea 149 |
| Email/Phone | `email` o `phone` | contact_id vía unificación | 6 (Baja) | contact-unification.service.js |

## 🔗 Casos de Uso de Emparejamiento

### Caso 1: Usuario llega desde campaña de Facebook

1. **Entrada**: `site.com?fbclid=abc123`
2. **Generación**: Se crea `rstk_vid=v1234567_xyz`
3. **Tracking**: Se guarda fbclid + rstk_vid en tracking.sessions
4. **Formulario**: Usuario llena form, se envía webhook con rstk_vid
5. **Emparejamiento**: Se vincula visitor con contact_id
6. **Resultado**: Todo el journey queda vinculado

### Caso 2: Usuario con sesión de GoHighLevel

1. **Entrada**: Usuario logueado en GHL visita el sitio
2. **Detección**: snip.js encuentra `_ud` en localStorage
3. **Extracción**: Se obtiene `customer_id` de GHL
4. **Tracking**: Se guarda ghl_contact_id + rstk_vid
5. **Emparejamiento**: Automático al contact_id
6. **Resultado**: Sesiones vinculadas sin necesidad de formulario

### Caso 3: Referral compartido

1. **Usuario A**: Visita `site.com`, obtiene `rstk_vid=v111_aaa`
2. **Comparte**: Envía link `site.com?rstk_vid=v111_aaa`
3. **Usuario B**: Abre el link compartido
4. **Herencia**: Usuario B hereda el mismo `rstk_vid`
5. **Tracking**: Ambos usuarios comparten el mismo visitor_id
6. **Resultado**: Se puede trackear el referral completo

### Caso 4: Compra después de múltiples sesiones

1. **Sesión 1**: Usuario visita desde Google Ads (gclid)
2. **Sesión 2**: Regresa directo (mismo rstk_vid)
3. **Sesión 3**: Llena formulario (se crea contact_id)
4. **Sesión 4**: Realiza pago
5. **Emparejamiento**: Webhook de pago con rstk_vid
6. **Resultado**: Todas las sesiones se vinculan con revenue

## 🛠 Implementación en Formularios

### Ejemplo de formulario HTML con tracking

```html
<form id="contact-form">
  <input type="hidden" id="rstk_vid" name="rstk_vid">
  <input type="text" name="first_name" required>
  <input type="email" name="email" required>
  <input type="tel" name="phone" required>
  <button type="submit">Enviar</button>
</form>

<script>
// Capturar rstk_vid de la URL
const urlParams = new URLSearchParams(window.location.search);
const rstkVid = urlParams.get('rstk_vid');
if (rstkVid) {
  document.getElementById('rstk_vid').value = rstkVid;
}

// Enviar al webhook
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  await fetch('/webhook/contacts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
});
</script>
```

### Ejemplo con GoHighLevel

```javascript
// Si estás usando GHL Forms o Custom Forms
function setupGHLTracking() {
  // 1. Obtener visitor ID de la URL
  const urlParams = new URLSearchParams(window.location.search);
  const rstkVid = urlParams.get('rstk_vid');

  // 2. Agregar a todos los forms de GHL
  document.querySelectorAll('form').forEach(form => {
    if (rstkVid) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'rstk_vid';
      input.value = rstkVid;
      form.appendChild(input);
    }
  });

  // 3. Guardar datos de GHL en localStorage para tracking
  if (window.ghlUser) {
    localStorage.setItem('_ud', JSON.stringify({
      customer_id: window.ghlUser.contact_id,
      location_id: window.ghlUser.location_id,
      email: window.ghlUser.email,
      phone: window.ghlUser.phone,
      first_name: window.ghlUser.first_name,
      last_name: window.ghlUser.last_name
    }));
  }
}

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', setupGHLTracking);
```

## 📈 Métricas y Reportes

### Queries útiles para análisis

```sql
-- Ver todo el journey de un visitor
SELECT * FROM tracking.sessions
WHERE visitor_id = 'v1234567_abc123'
ORDER BY created_at;

-- Visitors que se convirtieron en contactos
SELECT
  visitor_id,
  contact_id,
  MIN(created_at) as first_visit,
  MAX(created_at) as last_visit,
  COUNT(*) as total_pageviews,
  SUM(revenue_value) as total_revenue
FROM tracking.sessions
WHERE contact_id IS NOT NULL
GROUP BY visitor_id, contact_id;

-- Attribution por canal
SELECT
  channel,
  COUNT(DISTINCT visitor_id) as visitors,
  COUNT(DISTINCT contact_id) as contacts,
  SUM(revenue_value) as revenue
FROM tracking.sessions
GROUP BY channel
ORDER BY revenue DESC;

-- Visitors con múltiples dispositivos/sesiones
SELECT
  visitor_id,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT device_type) as devices,
  COUNT(DISTINCT ip) as ips,
  ARRAY_AGG(DISTINCT channel) as channels
FROM tracking.sessions
GROUP BY visitor_id
HAVING COUNT(DISTINCT session_id) > 1;
```

## 🔐 Consideraciones de Privacidad

1. **GDPR Compliance**: El visitor_id es un identificador pseudónimo, no PII
2. **Opt-out**: Respetar header `Do-Not-Track`
3. **Limpieza**: Los IDs expiran con localStorage (usuario puede limpiar)
4. **Transparencia**: Informar en política de privacidad sobre tracking

## 🚀 Mejores Prácticas

1. **Siempre incluir rstk_vid** en formularios y webhooks
2. **Validar el formato** del visitor_id antes de procesar
3. **No exponer** visitor_ids en logs públicos
4. **Implementar retry** en webhooks por si falla el emparejamiento
5. **Monitorear** sesiones huérfanas (sin contact_id después de conversión)

## 📝 Troubleshooting

### Problema: Visitor ID no se propaga en links
**Solución**: Verificar que snip.js esté cargado antes de renderizar links dinámicos

### Problema: Sesiones no se vinculan con contactos
**Solución**: Verificar que el webhook incluya el campo `rstk_vid`

### Problema: Datos de GHL no se capturan
**Solución**: Verificar que el objeto `_ud` existe en localStorage y tiene el formato correcto

### Problema: Múltiples visitor_ids para un mismo usuario
**Solución**: Puede ocurrir si el usuario usa modo incógnito o limpia cookies. Usar email/phone como fallback para unificación.

---

**Última actualización**: 2025-09-20
**Versión**: 1.0.0
**Autor**: Sistema de documentación automática