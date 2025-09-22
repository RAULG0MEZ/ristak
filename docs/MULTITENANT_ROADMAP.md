# 🏢 MULTITENANT ROADMAP - Ristak PRO

**Fecha de Análisis:** 2025-01-21
**Status:** PROPUESTA - Pendiente de Aprobación
**Complejidad Estimada:** MEDIA-ALTA (2-3 semanas)

## 📋 RESUMEN EJECUTIVO

Propuesta para convertir Ristak PRO de single-tenant a multitenant usando **URL-based filtering** como método principal de seguridad y filtrado de datos. La URL será el único mecanismo de autorización para determinar qué datos puede ver cada usuario.

### 🎯 OBJETIVO PRINCIPAL
- **URL como filtro:** `example.com/t/[tenant-slug]/dashboard`
- **Fallback automático:** Si no tiene permisos → redirect a su tenant por defecto
- **Zero data leakage:** Un tenant nunca ve datos de otro
- **Permisos granulares:** Admin, User, Viewer por tenant

---

## 🔍 ANÁLISIS DEL ESTADO ACTUAL

### ❌ LIMITACIONES ACTUALES
- **Frontend:** React Router sin tenant awareness
- **Backend:** API sin separación de datos por tenant
- **Database:** Estructura 100% single-tenant
- **Auth:** JWT básico sin información de tenant

### ✅ VENTAJAS EXISTENTES
- **Arquitectura limpia:** Fácil de extender
- **Express modular:** Middleware system robusto
- **React Router:** Ya preparado para rutas dinámicas
- **PostgreSQL:** Soporta multitenancy nativo

---

## 🏗️ ARQUITECTURA PROPUESTA

### 📱 FRONTEND MULTITENANT

#### Estructura de URLs
```
ANTES:
/dashboard
/contacts
/payments

DESPUÉS:
/t/[tenant-slug]/dashboard
/t/[tenant-slug]/contacts
/t/[tenant-slug]/payments
```

#### Auth Context Actualizado
```typescript
interface AuthContextValue {
  user: User
  currentTenant: Tenant
  tenants: Tenant[]           // Tenants donde el usuario tiene acceso
  switchTenant: (slug: string) => void
  hasPermission: (permission: string) => boolean
}

interface Tenant {
  id: string
  slug: string               // URL-friendly identifier
  name: string
  role: 'admin' | 'user' | 'viewer'
}
```

#### Router Protection
```typescript
// Middleware de tenant en cada ruta
<Route path="/t/:tenantSlug/*" element={<TenantProtectedRoute />}>
  <Route path="dashboard" element={<Dashboard />} />
  <Route path="contacts" element={<Contacts />} />
  <Route path="payments" element={<Payments />} />
</Route>
```

### ⚙️ BACKEND MULTITENANT

#### Middleware de Tenant
```javascript
// Extrae tenant de URL y valida permisos
const tenantMiddleware = async (req, res, next) => {
  const tenantSlug = req.params.tenantSlug
  const userId = req.user.userId

  // Validar que el usuario tiene acceso a este tenant
  const userTenant = await getUserTenant(userId, tenantSlug)

  if (!userTenant) {
    // Redirect a su tenant por defecto
    const defaultTenant = await getUserDefaultTenant(userId)
    return res.redirect(`/t/${defaultTenant.slug}/dashboard`)
  }

  // Agregar tenant info al request
  req.tenant = {
    id: userTenant.tenant_id,
    slug: tenantSlug,
    role: userTenant.role
  }

  next()
}
```

#### Services con Tenant Filtering
```javascript
// ANTES - Sin filtro de tenant
async getContacts(startDate, endDate) {
  const query = `
    SELECT * FROM contacts
    WHERE created_at >= $1 AND created_at <= $2
  `
  return await db.query(query, [startDate, endDate])
}

// DESPUÉS - Con filtro de tenant obligatorio
async getContacts(tenantId, startDate, endDate) {
  const query = `
    SELECT * FROM contacts
    WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
  `
  return await db.query(query, [tenantId, startDate, endDate])
}
```

### 🗄️ DATABASE SCHEMA

#### Nuevas Tablas
```sql
-- Tabla de tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  domain VARCHAR(100), -- Para subdominios opcionales
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Relación usuario-tenant con roles
CREATE TABLE user_tenants (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  is_default BOOLEAN DEFAULT FALSE, -- Tenant por defecto del usuario
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);
```

#### Migración de Tablas Existentes
```sql
-- Agregar tenant_id a todas las tablas de datos
ALTER TABLE contacts ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payments ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE tracking.sessions ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE meta.meta_ads ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Índices para performance
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_sessions_tenant_id ON tracking.sessions(tenant_id);

-- Row Level Security (RLS) - Seguridad a nivel de fila
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### 📅 FASE 1: PREPARACIÓN (2-3 días)
**Objetivo:** Setup básico sin romper nada

- [ ] **Database Schema**
  - Crear tablas `tenants` y `user_tenants`
  - Crear tenant "default" para datos actuales
  - Agregar columna `tenant_id` a tablas principales

- [ ] **Data Migration**
  - Migrar todos los datos existentes al tenant "default"
  - Asignar usuario actual al tenant "default" como admin
  - Verificar integridad de datos post-migración

- [ ] **Backend Prep**
  - Crear middleware de tenant (sin activar)
  - Crear services de tenant management
  - Tests unitarios de tenant isolation

### 📅 FASE 2: BACKEND MULTITENANT (3-5 días)
**Objetivo:** API completamente multitenant

- [ ] **Services Update**
  - Actualizar TODOS los services con tenant filtering
  - Modificar middleware de auth para incluir tenant
  - Implementar fallback de tenant por defecto

- [ ] **API Endpoints**
  - Nuevas rutas: `/api/t/:tenantSlug/contacts`
  - Mantener rutas legacy temporalmente
  - Endpoints de tenant management (`/api/tenants`)

- [ ] **Security & Testing**
  - Testing exhaustivo de data isolation
  - Verificar que no hay data leakage entre tenants
  - Performance testing de queries con tenant filtering

### 📅 FASE 3: FRONTEND MULTITENANT (3-4 días)
**Objetivo:** UI completamente multitenant

- [ ] **Router Update**
  - Actualizar React Router para URLs con tenant
  - Componente `TenantProtectedRoute`
  - Manejar redirects y fallbacks automáticos

- [ ] **Auth Context**
  - Actualizar AuthContext con tenant awareness
  - Hook `useTenant()` para componentes
  - Tenant switching UI (dropdown en header)

- [ ] **API Integration**
  - Actualizar todos los API calls con tenant slug
  - Config de axios con tenant base URL
  - Error handling para permisos de tenant

### 📅 FASE 4: POLISH & TESTING (2-3 días)
**Objetivo:** Todo funcionando perfectamente

- [ ] **User Experience**
  - URL pretty y SEO-friendly
  - Loading states durante tenant switching
  - Error pages para tenant no encontrado

- [ ] **Testing & Security**
  - Testing de integración completo
  - Security audit de data isolation
  - Performance testing bajo carga

- [ ] **Documentation**
  - Documentar nuevas APIs
  - Guía de setup de tenant
  - Troubleshooting guide

---

## ⚡ OPCIONES DE COMPLEJIDAD

### 🟢 VERSIÓN BÁSICA (1 semana)
**Dificultad:** ⭐⭐⭐☆☆

- URL filtering simple: `/t/[tenant-id]/dashboard`
- Tenant middleware básico
- Query filtering con `WHERE tenant_id = $1`
- Fallback redirect simple

**PROS:** Rápido, menos riesgoso
**CONTRAS:** URLs feas, menos features

### 🟡 VERSIÓN ESTÁNDAR (2 semanas)
**Dificultad:** ⭐⭐⭐⭐☆

- URL con slug: `/t/[tenant-slug]/dashboard`
- Permisos por tenant (admin/user/viewer)
- Tenant switching UI
- Row Level Security

**PROS:** Balance perfecto funcionalidad/tiempo
**CONTRAS:** Requiere más testing

### 🔴 VERSIÓN ENTERPRISE (3+ semanas)
**Dificultad:** ⭐⭐⭐⭐⭐

- Subdomain support: `tenant.ristak.com`
- Multi-tenant auth (usuario en múltiples tenants)
- Tenant customization (themes, settings)
- Advanced analytics por tenant

**PROS:** Súper completo y escalable
**CONTRAS:** Muy complejo, alto riesgo

---

## 🚨 RIESGOS Y MITIGACIONES

### ⚠️ RIESGOS TÉCNICOS

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Data Leakage** | Media | Crítico | Row Level Security + Testing exhaustivo |
| **Performance Degradation** | Alta | Medio | Índices optimizados + Query optimization |
| **Migration Data Loss** | Baja | Crítico | Backup completo + Rollback plan |
| **Breaking Changes** | Alta | Alto | Mantener API legacy durante transición |

### 🛡️ ESTRATEGIAS DE MITIGACIÓN

1. **Zero Downtime Migration**
   - Implementar feature flags
   - Mantener APIs legacy temporalmente
   - Blue-green deployment

2. **Data Security**
   - Row Level Security en PostgreSQL
   - Query auditing durante desarrollo
   - Automated testing de data isolation

3. **Performance**
   - Índices específicos para tenant filtering
   - Query optimization con EXPLAIN ANALYZE
   - Caching por tenant

---

## 🎯 CRITERIOS DE ÉXITO

### ✅ FUNCIONALES
- [ ] Usuario puede acceder solo a datos de SU tenant
- [ ] URL determina qué tenant está viendo
- [ ] Fallback automático si no tiene permisos
- [ ] Tenant switching fluido sin pérdida de estado

### ✅ TÉCNICOS
- [ ] Cero data leakage entre tenants (verificado con tests)
- [ ] Performance <= 20% degradation vs single-tenant
- [ ] 100% backward compatibility durante transición
- [ ] Rollback plan funcional y probado

### ✅ BUSINESS
- [ ] Setup de nuevo tenant en < 5 minutos
- [ ] Onboarding de usuario a tenant existente < 2 minutos
- [ ] Admin puede gestionar permisos por tenant
- [ ] Métricas y analytics separadas por tenant

---

## 📊 ESTIMACIÓN FINAL

| Versión | Tiempo | Recursos | Riesgo | Recomendación |
|---------|--------|----------|--------|---------------|
| **Básica** | 1 semana | 1 dev | Bajo | ✅ Para MVP rápido |
| **Estándar** | 2 semanas | 1 dev | Medio | ⭐ **RECOMENDADA** |
| **Enterprise** | 3+ semanas | 2 devs | Alto | ⚠️ Solo si hay tiempo |

---

## 📝 NOTAS ADICIONALES

### 🔄 PLAN DE ROLLBACK
1. **Database:** Backup completo antes de migration
2. **API:** Feature flags para activar/desactivar multitenant
3. **Frontend:** Mantener build single-tenant como fallback
4. **Timeline:** Rollback debe ser posible en < 30 minutos

### 🚀 FUTURAS MEJORAS
- **Subdomain routing:** `tenant.ristak.com`
- **Custom domains:** `analytics.clienteempresa.com`
- **White labeling:** Themes y branding por tenant
- **Advanced billing:** Billing por tenant y usage

### 👥 STAKEHOLDERS
- **Técnico:** Implementación y arquitectura
- **Producto:** UX y flujos de usuario
- **Business:** Modelo de pricing y onboarding
- **QA:** Testing de seguridad y data isolation

---

**🔥 DECISIÓN FINAL:** Pendiente de aprobación del team lead
**📅 PRÓXIMOS PASOS:** Review técnico y estimación final de recursos

---

*Documento generado automáticamente por Claude Code - 2025-01-21*
*Última actualización: Análisis inicial completo*