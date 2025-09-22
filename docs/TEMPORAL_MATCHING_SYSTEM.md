# 🎯 Sistema de Matching Temporal - Ristak

## Problema Identificado

Cuando un usuario se registra a través de GHL (GoHighLevel), existe una **race condition** entre:
1. GHL guardando `_ud` en localStorage
2. El script de tracking (`snip.js`) ejecutándose en la página de thank you

Si el snip.js ejecuta ANTES de que GHL termine de guardar `_ud`, el visitante no se vincula automáticamente con el contacto creado.

## Solución: Matching Temporal Probabilístico

Sistema de vinculación basado en **proximidad temporal** y **señales contextuales**, similar a plataformas como Hyros y ClickMagick.

## 🔄 Flujo del Sistema

```
Usuario llena form → Webhook crea contacto → Sistema busca sesiones recientes
                           ↓
                    Calcula score de matching
                           ↓
                 Score > umbral? → Vincula visitor_id
```

## 📊 Niveles de Confianza

| Nivel | Score | Descripción | Acción |
|-------|-------|-------------|---------|
| PERFECT | 100 | `_ud` o `rstk_local` presente | Vincular inmediato |
| HIGH | 85+ | Múltiples señales + <5 seg | Vincular + marcar lead |
| MEDIUM | 70-84 | Algunas señales + <2 min | Vincular con revisión |
| LOW | 50-69 | Pocas señales + <5 min | Vincular provisional |
| MINIMAL | 30-49 | Solo temporal + <15 min | Requiere validación manual |

## 🎯 Señales de Matching

### Señales Fuertes (25-35 puntos)
- **Click IDs** (35 pts): fbclid, gclid coinciden
- **Ad IDs** (30 pts): ad_id, campaign_id coinciden
- **UTM Parameters** (25 pts): utm_source + utm_campaign
- **Device Fingerprint** (25 pts): Mismo device signature

### Señales Medias (10-20 puntos)
- **IP Address** (20 pts): Misma IP
- **User Agent** (15 pts): Mismo navegador/OS
- **Screen Size** (10 pts): Misma resolución
- **Timezone** (10 pts): Mismo timezone

### Señales Débiles (5 puntos)
- **Language** (5 pts): Mismo idioma
- **Referrer** (5 pts): Mismo referrer
- **Landing Page** (5 pts): Misma página

## ⏱️ Ventanas Temporales

```javascript
IMMEDIATE: 5 segundos    // +40 puntos base
SHORT: 30 segundos       // +30 puntos base
MEDIUM: 2 minutos        // +20 puntos base
LONG: 5 minutos          // +10 puntos base
EXTENDED: 15 minutos     // +5 puntos base
```

## 💾 Algoritmo de Matching

```javascript
function calculateMatchScore(webhook, session) {
  let score = 0;
  let signals = [];

  // 1. Proximidad temporal
  const timeDiff = Math.abs(webhook.created_at - session.created_at);

  if (timeDiff <= 5) {
    score += 40;
    signals.push('IMMEDIATE_WINDOW');
  }
  // ... más ventanas

  // 2. Comparar señales
  if (webhook.utm_source === session.utm_source) {
    score += 25;
    signals.push('UTM_MATCH');
  }

  if (webhook.fbclid === session.fbclid) {
    score += 35;
    signals.push('FBCLID_MATCH');
  }

  // ... más señales

  return { score, signals };
}
```

## 🗄️ Estructura de Base de Datos

### Tabla de Auditoría
```sql
CREATE TABLE tracking.matching_audit (
  id SERIAL PRIMARY KEY,
  contact_id VARCHAR(50),
  visitor_id VARCHAR(50),
  matching_method VARCHAR(20), -- 'direct', 'temporal', 'manual'
  confidence_level VARCHAR(10), -- 'PERFECT', 'HIGH', 'MEDIUM', 'LOW'
  score INTEGER,
  time_diff_seconds INTEGER,
  matched_signals TEXT[], -- Señales que coincidieron
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

## 📈 Casos de Uso

### Caso 1: Match Perfecto (Score 95)
```
- Diferencia temporal: 3 segundos
- UTM params coinciden: +25
- fbclid coincide: +35
- Misma IP: +20
- Device fingerprint: +25
Total: 95/100 → HIGH confidence → Vincular automático
```

### Caso 2: Match Medio (Score 65)
```
- Diferencia temporal: 90 segundos
- UTM source coincide: +15
- Misma IP: +20
- User agent: +15
Total: 65/100 → MEDIUM confidence → Vincular con flag de revisión
```

### Caso 3: Match Débil (Score 35)
```
- Diferencia temporal: 10 minutos
- Solo timezone coincide: +10
- Mismo idioma: +5
Total: 35/100 → MINIMAL confidence → Requiere revisión manual
```

## 🔍 Debugging y Logs

### Log de Matching Exitoso
```bash
🎯 [TEMPORAL MATCHING] Match encontrado!
  Contact: cntct_abc123
  Visitor: v1234567_xyz
  Score: 85/100
  Confianza: HIGH
  Diferencia temporal: 4s
  Señales: IMMEDIATE_WINDOW, UTM_MATCH, FBCLID_MATCH, IP_MATCH
```

### Log de Sin Match
```bash
⚠️ [TEMPORAL MATCHING] No se encontró match confiable
  Contact: cntct_def456
  Mejor candidato: Score 45/100 (muy bajo)
  Acción: Pendiente revisión manual
```

## ⚙️ Configuración Recomendada

```javascript
const MATCHING_CONFIG = {
  // Umbrales de confianza
  thresholds: {
    auto_link: 70,      // Score mínimo para vincular automático
    mark_lead: 85,      // Score mínimo para marcar como lead
    require_review: 50  // Por debajo requiere revisión
  },

  // Ventana máxima de búsqueda
  max_time_window: 900, // 15 minutos

  // Señales requeridas mínimas
  min_signals: 2, // Al menos 2 señales deben coincidir

  // Retroactivo
  backfill_enabled: true,
  backfill_days: 7
};
```

## 🚀 Implementación Futura

### Fase 1: Testing (NO implementado aún)
1. Correr algoritmo en modo "dry-run" sobre datos históricos
2. Analizar falsos positivos y negativos
3. Ajustar scores según resultados

### Fase 2: Implementación Gradual
1. Activar solo para HIGH confidence (85+)
2. Dashboard de revisión para MEDIUM (70-84)
3. Alertas para casos ambiguos

### Fase 3: Machine Learning
1. Entrenar modelo con matchings confirmados
2. Ajuste automático de pesos
3. Detección de anomalías

## ⚠️ Consideraciones Importantes

1. **Privacy**: El matching respeta GDPR/CCPA al no usar PII directamente
2. **Performance**: Usar índices en campos de matching
3. **Escalabilidad**: Implementar cache para sesiones recientes
4. **Auditoría**: Todos los matchings se registran para análisis
5. **Reversibilidad**: Los matchings pueden deshacerse si son incorrectos

## 📊 Métricas de Éxito

- **Match Rate**: % de contactos vinculados vs sin vincular
- **Accuracy**: % de matchings correctos (validados manualmente)
- **Time to Match**: Tiempo promedio para encontrar match
- **Confidence Distribution**: Distribución de niveles de confianza

## 🔧 Troubleshooting

### Problema: Muchos matchings de baja confianza
**Solución**: Ajustar ventanas temporales o aumentar umbral mínimo

### Problema: Contactos sin match
**Solución**: Revisar si llegan todas las señales en el webhook

### Problema: Falsos positivos
**Solución**: Aumentar peso de señales fuertes, reducir ventanas temporales

## 🎯 Beneficios del Sistema

1. **Resiliente**: No depende de una sola señal (_ud)
2. **Transparente**: Todo queda registrado en auditoría
3. **Configurable**: Ajustable según necesidades
4. **Retroactivo**: Puede procesar datos históricos
5. **Inteligente**: Aprende de patrones con el tiempo

---

**Estado**: DISEÑADO - No implementado
**Última actualización**: 2025-01-21
**Autor**: Sistema de Tracking - Ristak