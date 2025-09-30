# ESPECIFICACIÓN PÁGINA DE REPORTES - AGNÓSTICA

## RESUMEN EJECUTIVO
Página principal para visualizar métricas financieras y de performance del negocio. Muestra datos agregados por período (día/mes/año) con múltiples opciones de filtrado y visualización. La página combina tablas históricas con tarjetas de métricas clave.

## 1. ESTRUCTURA PRINCIPAL

### 1.1 Layout General
```
┌─────────────────────────────────────────────────────┐
│ TÍTULO: "Reportes"                                 │
├─────────────────────────────────────────────────────┤
│ CONTROLES PRINCIPALES (En fila horizontal)         │
│ [Selector Fechas] [Vista] [Tipo] [Modo] [Exportar] │
├─────────────────────────────────────────────────────┤
│ TARJETAS KPI (4 métricas principales)              │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│ │ KPI │ │ KPI │ │ KPI │ │ KPI │                  │
│ └─────┘ └─────┘ └─────┘ └─────┘                  │
├─────────────────────────────────────────────────────┤
│ ÁREA DE DATOS (Tabla o Métricas según modo)       │
│ ┌─────────────────────────────────────────────┐   │
│ │ Tabla con controles de búsqueda y columnas   │   │
│ │ O                                             │   │
│ │ Grid de tarjetas con métricas agrupadas      │   │
│ └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 2. ELEMENTOS DE CONTROL

### 2.1 Selector de Fechas (Componente Compuesto)
**Función:** Define el período de datos a mostrar
**Comportamiento:** Cambia según el tipo de vista seleccionado

#### Para Vista DÍA:
- Selector de rango de fechas (fecha inicio - fecha fin)
- Formato: "DD MMM YYYY"
- Presets rápidos: Últimos 7 días, 30 días, Este mes

#### Para Vista MES:
- Opciones predefinidas:
  - "Últimos 12 meses" (default)
  - "Este año"
  - "Personalizado" → Despliega selectores año + mes inicio/fin

#### Para Vista AÑO:
- Selector de rango de años (año inicio - año fin)
- Por defecto: últimos 3 años

### 2.2 Selector de Vista (TabList)
**Opciones:**
- Día → Muestra datos diarios
- Mes → Muestra datos agregados por mes
- Año → Muestra datos agregados por año

### 2.3 Selector Tipo de Reporte (TabList)
**Opciones:**
- "Todos" → Muestra todas las transacciones
- "Última atribución" → Solo transacciones con atribución de campañas

### 2.4 Selector Modo Visualización (Toggle Button Group)
**Opciones:**
- Histórico (icono: gráfica lineal) → Muestra tabla temporal
- Métricas (icono: barras) → Muestra grid de tarjetas métricas

### 2.5 Botón Exportar
**Función:** Descarga los datos en formato CSV
**Contenido:** Incluye todas las métricas visibles del período seleccionado

## 3. TARJETAS KPI (Key Performance Indicators)

### 3.1 Estructura de cada KPI Card
```
┌──────────────────────────────┐
│ TÍTULO (texto secundario)    │
│ VALOR PRINCIPAL (grande)     │
│ [↑/↓] CAMBIO % (vs período)  │
│ ícono (esquina superior der) │
└──────────────────────────────┘
```

### 3.2 Las 4 KPIs Principales
1. **Ingresos**
   - Suma total de revenue del período
   - Ícono: símbolo de dólar
   - Trend: % cambio vs período anterior

2. **Ganancia**
   - Revenue - Spend (utilidad neta)
   - Ícono: flecha trending arriba
   - Trend: margen de ganancia %

3. **Clientes Nuevos**
   - Conteo de nuevos clientes en el período
   - Ícono: usuarios
   - Trend: % cambio vs período anterior

4. **Gastos**
   - Total de inversión publicitaria
   - Ícono: target/objetivo
   - Trend: % del revenue (inverso, down es bueno)

## 4. TABLA HISTÓRICA (Modo: Histórico)

### 4.1 Controles de Tabla
- **Búsqueda:** Filtro por texto en fechas
- **Selector de columnas:** Mostrar/ocultar columnas
- **Reordenar columnas:** Drag & drop
- **Ordenamiento:** Click en headers para ordenar

### 4.2 Columnas Disponibles

#### Columnas Principales (visibles por defecto):
1. **Fecha/Período**
   - Formato según vista: "21 sep 2025" / "Septiembre 2025" / "2025"
   - SIEMPRE primera columna, no movible

2. **ROAS** (Return on Ad Spend)
   - Cálculo: revenue / spend
   - Formato: "2.50x"
   - Centrado

3. **Ganancias**
   - Cálculo: revenue - spend
   - Formato: moneda
   - Color: verde si positivo, rojo si negativo

4. **Recolectado** (Revenue)
   - Total de ingresos
   - Formato: moneda

5. **Invertido** (Spend)
   - Total gastado en publicidad
   - Formato: moneda

6. **Transacciones/Ventas**
   - Número de operaciones completadas
   - CLICKEABLE → abre modal con detalle

7. **Clientes Nuevos**
   - Conteo de nuevos clientes
   - CLICKEABLE → abre modal con listado

#### Columnas Secundarias (ocultas por defecto):
- **Leads:** Cantidad de prospectos
- **Citas:** Número de appointments
- **Clicks:** Total de clics en ads
- **CPC:** Costo por clic
- **CPL:** Costo por lead
- **CAC:** Costo de adquisición de cliente
- **Visitantes Web:** Usuarios únicos
- **Tasas de conversión:** Web→Leads%, Leads→Citas%, Citas→Ventas%

### 4.3 Comportamiento de Datos
- Ordenamiento default: Fecha descendente (más reciente primero)
- Datos se actualizan al cambiar período/vista/tipo
- Totales NO se muestran en la tabla (están en KPIs)

## 5. VISTA DE MÉTRICAS (Modo: Métricas)

### 5.1 Estructura Grid
4 columnas de tarjetas agrupadas por categoría:

#### Columna 1: TRÁFICO
- Clicks (total clics)
- CPC (costo por clic)
- EPC (ganancia por clic)
- Engaged (usuarios activos)
- ECR (tasa de interacción)
- CPE (costo por interacción)
- EPE (ganancia por interacción)

#### Columna 2: CONVERSIÓN
- Actions (leads generados)
- ACR (tasa de acciones)
- CPA (costo por acción)
- EPA (ganancia por acción)
- Sales (ventas/transacciones)
- SCR (tasa de ventas)
- Appointments (citas)

#### Columna 3: FINANCIERO
- Revenue (ingresos totales) → destacado
- Cost (gasto total)
- Profit (utilidad) → color según signo
- ROAS (retorno) → color según valor >1
- ROI (% retorno inversión)
- AOV (ticket promedio)
- CAC (costo adquisición)

#### Columna 4: CLIENTES
- New (nuevos clientes)
- Repeat (clientes recurrentes)
- Refunds (devoluciones)
- LTV (valor de vida del cliente)
- ROAS 1 Day (retorno día 1)

### 5.2 Formato de cada métrica
```
┌─────────────────────┐
│ LABEL (pequeño)     │
│ VALOR (grande bold) │
│ descripción (gris)  │
└─────────────────────┘
```

## 6. MODALES DE DETALLE

### 6.1 Modal de Transacciones/Ventas
**Trigger:** Click en valor de columna Sales
**Contenido:**
- Título: "Transacciones del [período]"
- Tabla con columnas:
  - Fecha/hora
  - Cliente (nombre)
  - Monto
  - Método de pago
  - Estado
- Paginación si hay muchos registros
- Total al pie

### 6.2 Modal de Clientes Nuevos
**Trigger:** Click en valor de columna New Customers
**Contenido:**
- Título: "Nuevos clientes del [período]"
- Tabla con:
  - Nombre
  - Email
  - Teléfono
  - Fecha registro
  - Primera compra
  - Monto total

### 6.3 Modal de Leads
**Trigger:** Click en valor de columna Leads
**Contenido:**
- Lista de prospectos del período
- Información de contacto
- Fuente/origen
- Estado del lead

### 6.4 Modal de Citas
**Trigger:** Click en valor de columna Appointments
**Contenido:**
- Calendario de citas del período
- Cliente, fecha, hora
- Estado (completada/pendiente/cancelada)

## 7. LÓGICA DE NEGOCIO

### 7.1 Cálculos de Métricas
```javascript
// Métricas básicas (vienen del backend)
spend = suma de inversión publicitaria
revenue = suma de ingresos
leads = conteo de prospectos
sales = conteo de transacciones
clicks = suma de clics en anuncios
visitors = usuarios únicos del sitio
appointments = citas agendadas
new_customers = clientes sin compras previas

// Métricas calculadas (frontend)
profit = revenue - spend
roas = revenue / spend
roi = ((revenue - spend) / spend) * 100
cpc = spend / clicks
cpl = spend / leads
cac = spend / sales
aov = revenue / sales

// Tasas de conversión
click_to_lead = (leads / clicks) * 100
lead_to_sale = (sales / leads) * 100
visitor_to_lead = (leads / visitors) * 100
```

### 7.2 Agrupación de Datos
- **Por DÍA:** Cada fila = 1 día calendario
- **Por MES:** Cada fila = 1 mes completo
- **Por AÑO:** Cada fila = 1 año completo

### 7.3 Filtrado por Tipo
- **"Todos":** Incluye TODAS las transacciones
- **"Última atribución":** Solo transacciones que tienen campaña_id asociado

### 7.4 Comparación de Períodos (para trends)
- Día: Compara con día anterior
- Mes: Compara con mes anterior
- Año: Compara con año anterior

## 8. ESTADOS Y COMPORTAMIENTOS

### 8.1 Estados de Carga
- Skeleton loaders en KPIs mientras carga
- Skeleton en tabla/métricas durante fetch
- Indicador si hay sincronización en proceso

### 8.2 Estado Vacío
- Mensaje: "No hay datos para el período seleccionado"
- Sugerir cambiar fechas o verificar sincronización

### 8.3 Persistencia
- Configuración de columnas se guarda en localStorage
- Diferente configuración para cada tipo de reporte
- Vista y período se resetean al recargar

### 8.4 Actualización de Datos
- Polling cada 5 segundos para verificar sincronización
- Refetch automático cuando termina sincronización
- Refetch al cambiar cualquier filtro/selector

## 9. RESPONSIVIDAD

### Mobile (< 768px)
- Controles se apilan verticalmente
- KPIs en grid 2x2
- Tabla con scroll horizontal
- Métricas en 1 columna

### Tablet (768px - 1024px)
- Controles en 2 filas
- KPIs en grid 2x2
- Tabla completa
- Métricas en 2 columnas

### Desktop (> 1024px)
- Todo en layout horizontal
- KPIs en fila de 4
- Tabla sin scroll
- Métricas en 4 columnas

## 10. INTERACCIONES CLAVE

### 10.1 Flujo Principal
1. Usuario selecciona período (fechas)
2. Elige vista (día/mes/año)
3. Selecciona tipo de datos (todos/atribuidos)
4. Decide modo visualización (tabla/métricas)
5. Puede hacer click en valores para ver detalle
6. Puede exportar datos a CSV

### 10.2 Atajos y Optimizaciones
- Presets de fecha para selección rápida
- Doble click en header ordena descendente
- ESC cierra modales
- Búsqueda es instantánea (sin delay)

## 11. INTEGRACIÓN CON BACKEND

### 11.1 Endpoints Principales
```
GET /api/reports/metrics
  ?start={fecha}
  &end={fecha}
  &groupBy={day|month|year}
  &type={all|attributed}

GET /api/reports/summary-metrics
  ?start={fecha}
  &end={fecha}
  → Retorna KPIs con trends

GET /api/meta/sync/status
  → Verifica si hay sincronización activa
```

### 11.2 Endpoints de Detalle (para modales)
```
GET /api/payments
  ?start={fecha}
  &end={fecha}
  &status=completed

GET /api/contacts
  ?created_after={fecha}
  &created_before={fecha}
  &is_client=true

GET /api/leads
  ?start={fecha}
  &end={fecha}

GET /api/appointments
  ?start={fecha}
  &end={fecha}
```

## 12. VALIDACIONES Y REGLAS

### 12.1 Validaciones de Fecha
- Fecha fin no puede ser menor a fecha inicio
- No permitir fechas futuras
- Rango máximo: 5 años

### 12.2 Reglas de Negocio
- Cliente nuevo = primera compra en el período
- ROAS mínimo mostrado: 0.00x (nunca negativo)
- Montos negativos en rojo, positivos en verde/negro
- Porcentajes con 1 decimal máximo

### 12.3 Límites de Performance
- Máximo 1000 filas en tabla sin paginación
- Exportación CSV limitada a 10,000 registros
- Cache de datos por 5 minutos

## 13. MENSAJES Y FEEDBACK

### 13.1 Durante Sincronización
"Sincronizando datos con Meta... Los datos pueden estar incompletos"

### 13.2 Error de Carga
"Error al cargar los datos. Por favor intenta de nuevo"

### 13.3 Sin Datos
"No se encontraron datos para el período seleccionado"

### 13.4 Exportación Exitosa
Toast: "Datos exportados correctamente"

## NOTAS PARA IMPLEMENTACIÓN

### Prioridades
1. **CRÍTICO:** Cálculos correctos de métricas financieras
2. **IMPORTANTE:** Performance con grandes volúmenes de datos
3. **NICE TO HAVE:** Animaciones y transiciones suaves

### Consideraciones Técnicas
- Usar memorización para cálculos pesados
- Implementar virtualización en tabla si >100 filas
- Debounce en búsqueda si hay lag
- Lazy loading para modales

### Testing Requerido
- Verificar cálculos con datos reales
- Probar todos los rangos de fecha posibles
- Validar exportación CSV con Excel/Sheets
- Test de performance con 1000+ registros

---

Este documento es agnóstico a la tecnología. La implementación debe seguir los patrones y componentes globales definidos en el sistema de diseño del proyecto.