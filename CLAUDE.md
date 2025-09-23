Hablame al chile y coloquial siempre y con groserias y con legunaje sencillo y nunca tecnico. Todo agnostico:

"Puta madreee, háblame como yo, cabrón. Hazme sentir que neta me entiendes y no salgas con mamadas, usa mi mismo pinche lenguaje agnóstico.""

En el codigo siempre tienes que hacer anotaciones o descripcioens agnosticas para dejarle contexto al programador.

⚠️ CONFIGURACIÓN DE REPOSITORIOS GIT:

TENEMOS 2 REPOS DIFERENTES CON REGLAS DISTINTAS:

1. **REPO DE RAÚL** (https://github.com/RAULG0MEZ/ristak.git)
   - Remote: `raul`
   - ✅ SÍ SE SUBEN TODAS LAS VARIABLES Y CREDENCIALES
   - ✅ Incluir .env.local, .env.production, DATABASE_URL, todo
   - Este es tu repo personal donde guardas TODO

2. **REPO DE RISTAK** (https://github.com/RistakApp/ristak-MVP.git)
   - Remote: `ristak`
   - ❌ NO SE SUBE DATABASE_URL NI CONTRASEÑAS DE NEON
   - ✅ SÍ se suben otras variables (META, CLOUDFLARE, dominios, etc)
   - Solo código limpio sin credenciales sensibles

COMANDOS PARA PUSH:
```bash
# Para pushear a TU repo personal (CON contraseñas):
git push raul main

# Para pushear al repo de Ristak (SIN contraseñas):
git push ristak main

# Ver a qué repos está conectado:
git remote -v
```

IMPORTANTE:
- Antes de hacer push al repo `ristak`, asegúrate que .gitignore excluya .env.local y api/.env
- Antes de hacer push al repo `raul`, puedes incluir TODO

PROMPT ÚNICO PARA IA PROGRAMADORA — FRONT NUEVO + BACKEND PROPIO ORDENADO (SIN ROMPER NADA)

RESUMEN (LEE PRIMERO)
- Hay una app previa (“Ristak - App”) que sirve como REFERENCIA DE FUNCIONALIDAD, NO para copiar. Quiero algo más simple, limpio y eficiente.
- El FRONT debe replicar EXACTAMENTE el estilo de la imagen: /Users/raulgomez/Desktop/Ristak PRO/ESTILO APP.webp
  *Si la ruta no existe en tu entorno, DETENTE y pídela. No inventes.*
- Dos modos de trabajo:
  A) FRONT con backend EXISTENTE → no toques backend.
  B) FRONT + BACKEND PROPIO (nuevo/limpieza) → diseña una API mínima, clara y sin redundancias.

OBJETIVO
- Misma funcionalidad que la anterior, pero con mejor arquitectura y diseño consistente.
- Un cambio en tema/preset global se refleja en TODAS las pantallas y módulos.

DISEÑO (FUENTE ÚNICA DE VERDAD)
- Todo estilo sale de tokens/tema o componentes globales. Prohibidos estilos sueltos/inline.
- Light/Dark y efectos “glass” viven en el tema, no en cada componente.

ESTRUCTURA DE REPO (AGNÓSTICA)
Opción simple (carpetas hermanas):
- frontend/
  - src/ui/            → Componentes globales (Card, Table, Input, Button, Modal, etc.)
  - src/theme/         → Tokens/tema (colores, tipografías, radios, sombras, opacidades, etc.)
  - src/icons/         → Íconos centralizados
  - src/pages/         → Páginas que ensamblan módulos y componentes globales
  - src/modules/       → Módulos de negocio (pagos, contactos, campañas…) usando SOLO componentes de ui
- backend/
  - src/app/           → Entradas (controladores/handlers)
  - src/domain/        → Entidades y reglas de negocio por bounded context
  - src/services/      → Casos de uso (orquestación/validaciones)
  - src/repositories/  → Acceso a datos (ORM/queries) con interfaces claras
  - src/jobs/          → Tareas asíncronas/colas
  - src/shared/        → Utilidades comunes (auth, errores, logger, config)
- docs/
  - AI_CONTEXT.md, reglas.md, decisiones.md, rfc.md
  - api/ (OpenAPI/JSON Schema): openapi.yaml ES LA FUENTE DE VERDAD DE LA API

REGLAS DE ORO (OBLIGATORIAS)
1) NO crees archivos nuevos si ya existe uno equivalente. Reutiliza y refactoriza.
2) CERO estilos locales/inline. Todo va a tokens del tema o al componente global correspondiente.
3) Un solo preset por tipo (Card/Table/Input/Modal/etc.). Variantes vía props/slots, NO clonando componentes.
4) CERO huérfanos: registra exports, actualiza índices/imports, elimina lo obsoleto y documenta.
5) Cambios idempotentes: lee, planea, aplica, limpia. Cada PR debe ser repetible sin romper.
6) Documenta decisiones en docs/Decisiones.md (1–3 líneas con fecha y motivo).
7) Consistencia > ocurrencias locales. Si rompe el patrón, NO va.
8) LÓGICA DE CLIENTES: Un contacto es "client" SI Y SOLO SI tiene al menos 1 pago con status 'completed'. No importa el campo status de la tabla contacts.

COMPONENTES GLOBALES (MÍNIMO VIABLE EN FRONT)
- Layout · Card (info/métrica/advertencia) · Table (preset único) · Pagination
- Input/Select/DateRangePicker · Button · Modal/Drawer · Tabs
- Toast/Alert (incluye tarjetas de advertencia) · ChartContainer (tooltip con offset)
- Icon (siempre desde src/icons)

PRESETS CRÍTICOS (DONDE MÁS TRUENAN)
- Tabla: un solo preset para TODAS; sorting con cursor/ícono sin resaltar todo el header; column picker/reordenamiento con el mismo patrón; cero CSS local.
- Card: variantes por props; colores solo desde tokens.
- ChartContainer: tooltip con OFFSET; ejes/grid/formatos centralizados.
- DateRangePicker: estilo único. Cambia datos, NO labels fijos (ej. “Promedio diario”).
- Íconos: sólo desde src/icons.

— MODO A: FRONT SOBRE BACKEND EXISTENTE (NO TOCAR BACKEND) —
Se aplican todas las reglas de front. Si falta dato/endpoint, levanta un RFC en docs/Rfc.md y NO rompas nada.

— MODO B: CUANDO TOQUE DISEÑAR/ORDENAR BACKEND PROPIO —
OBJETIVO DE BACKEND
- API mínima, clara y estable. Sin “chorro” de endpoints ni duplicados.
- Cada endpoint responde a un caso de uso real. Nada de caprichos.

API-FIRST (FUENTE ÚNICA: /docs/api/openapi.yaml)
- Diseña/actualiza OpenAPI ANTES de codar. El contrato manda.
- Versiona la API (v1) en ruta o header; plan de deprecación con fechas.

ESTILO DE API (AGNÓSTICO)
- Recursos con nombres claros (plurales) y semántica constante.
- Verbo/semántica:
  - GET /recurso            (listar con paginación cursor)  ?cursor=&limit=&filter[...]=&sort=
  - GET /recurso/{id}
  - POST /recurso           (idempotency-key cuando aplique: pagos/altas)
  - PATCH /recurso/{id}     (parcial, con validación)
  - DELETE /recurso/{id}    (duro o soft-delete con deleted_at documentado)
- Evita endpoints “uno por filtro”. Usa filtros composables (filter[status], filter[date_from], etc.).
- Campos seleccionables (fields=) y expansiones controladas (include=) sólo si justifican performance.
- Paginación cursor-based por defecto. Devuelve next_cursor/prev_cursor.

MODELAJE DE DOMINIO Y DATOS
- Entidades con IDs estables (UUID/ULID), timestamps (created_at, updated_at), y (opcional) deleted_at.
- Índices y UNIQUE (incluyendo parciales) para evitar duplicados (ej. pagos).
- Idempotencia: cabecera Idempotency-Key en escrituras sensibles; locks si hace falta.
- Migraciones: aditivas, reversibles, cero downtime; nombres claros; seeds mínimas para smoke tests.

CAPAS Y RESPONSABILIDADES
- app/handlers: validan input, mapean HTTP ↔ DTOs. Sin lógica de negocio.
- services/: casos de uso, transacciones, reglas. Sin SQL/ORM directo.
- repositories/: queries/ORM. Sin reglas de negocio.
- domain/: entidades/valores/reglas puras.
- shared/: auth, config, errores, logging, tracing.

VALIDACIÓN, ERRORES Y CÓDIGOS
- Toda entrada validada (tipos/rangos/referencias). No confíes en el cliente.
- Error shape estable:
  { "error": { "code": "string_estable", "message": "humano", "details": [{ "field": "x", "issue": "y"}], "request_id": "..." } }
- Mapea bien 400/401/403/404/409/422/429 y 5xx. No escondas 409/422.

AUTENTICACIÓN Y AUTORIZACIÓN
- Tokens (sesión o JWT) con expiración/refresh. Roles y permisos por recurso/acción.
- Rate limit por IP/usuario y protección CSRF si aplica. Secretos en config segura.

OBSERVABILIDAD Y CONFIABILIDAD
- request_id y trace_id en cada request. Logs estructurados (JSON) con nivel y contexto.
- Métricas (latencia, tasa de error, colas, DB timing). Health/ready endpoints.
- Retries con backoff SOLO donde tenga sentido (lecturas idempotentes).

JOBS ASÍNCRONOS
- Tareas largas a cola (emails, imports, sincronizaciones). Reintentos y DLQ.
- Idempotencia/locks para evitar duplicados.

PERFORMANCE Y N+1
- Revisa explain/plans, índices, y N+1 (usa batch/fetch joins o loaders).
- Campos derivados en vistas/materializations si está justificado.

PRUEBAS (LÍNEA BASE)
- Contract tests (OpenAPI) + integración happy-path por módulo.
- Smoke test post-deploy: 1 GET, 1 POST, 1 PATCH, 1 DELETE representativos.
- Fixtures/seeds mínimas y limpias por entorno.

DEPRECACIÓN
- Marca en OpenAPI (deprecated: true), agrega header Deprecation y fecha EOL, loguea uso y provee alternativa.

CHECKLISTS

Frontend — Checklist Anti-Huérfanos
[ ] Reutilicé componentes globales (sin clones)
[ ] Variantes por props/slots
[ ] Estilos sólo en tokens/tema o ui/
[ ] Limpié duplicados y actualicé exports/imports
[ ] decisiones.md actualizado
[ ] Tooltips con offset, headers de tabla correctos
[ ] Light/Dark/“glass” desde el tema
[ ] Validación manual documentada

Backend — Checklist Anti-Redundancias
[ ] Caso de uso ↔ endpoint (uno que sirva a varios filtros)
[ ] Filtros composables; sin endpoints “uno por filtro”
[ ] Paginación cursor y shape consistente
[ ] Idempotency-Key donde aplique
[ ] Reglas en services/, datos en repositories/
[ ] Únicos/índices/migraciones aditivas
[ ] Errores con code estable y request_id
[ ] OpenAPI actualizado (fuente de verdad)
[ ] Logs/metrics/health listos
[ ] Tests mínimos pasan

FLUJO DE TRABAJO (SIEMPRE)

ANTES (obligatorio):
- Lee docs/AI_CONTEXT.md y openapi.yaml (si toca backend).
- Responde con “Plan en 5 bullets”:
  1) Qué vas a cambiar
  2) Dónde (rutas exactas)
  3) Qué vas a reutilizar
  4) Qué vas a eliminar/limpiar
  5) Riesgos y mitigación

HACER:
- FRONT: Reutiliza presets globales; mueve estilos a tokens; NO labels dinámicos por rango si el label es fijo.
- BACKEND: Diseña/ajusta contrato en OpenAPI, luego implementa; evita endpoints duplicados; valida entradas; errores consistentes.

DESPUÉS:
- Pasa ambos checklists (front y backend si aplica).
- Entrega rutas tocadas + breve diff mental + pasos de validación.
- Actualiza docs/Decisiones.md (1–3 líneas).

ENTREGABLES MÍNIMOS POR PR
- Archivos tocados/creados/eliminados.
- Resumen de cambios (3–7 bullets).
- Validación manual (pasos + resultado esperado).
- (Si backend) OpenAPI actualizado + pruebas contract/integración.
- Sin TODOs ni console.logs permanentes.

ESCENARIOS TÍPICOS Y CÓMO EVITARLOS
- “Hay 20 endpoints para lo mismo”: combina en uno con filtros y sorting.
- “Se duplican pagos/acciones”: usa Idempotency-Key + constraints únicos/índices parciales.
- “N+1”: usa batch/loaders o joins; mide latencias.
- “Tooltip tapa datos”: offset global en ChartContainer (NO local).
- “No se refleja el color”: el color está hardcodeado; mover a tokens del tema.
- “Se creó otro Button/Card”: prohibido; agrega props en el global.
- “El botón de deploy sale en prod”: condicionar por entorno y ocultar en producción.
- “Cambiaste labels por rango de fechas”: NO; sólo cambian los valores.
- “Rompiste contrato”: prohibido; propone RFC y sigue sin romper.

AMBIGÜEDAD / FALTA DE CONTEXTO
- NO inventes. Resume la duda (1–3 bullets), sugiere opción conservadora y pausa ese punto. Continúa con lo claro.

MODO DE RESPUESTA (OBLIGATORIO)
- Antes de tocar, dame el “Plan en 5 bullets”.
- Luego indica archivos a tocar, qué se reutiliza y qué se elimina.
- Al terminar, pasa checklists y entrega validación manual.

PROBLEMAS COMUNES Y SOLUCIONES RÁPIDAS

PROBLEMA: Frontend no muestra datos reales de la DB
SÍNTOMAS:
- La página carga pero muestra datos vacíos o de prueba
- Error "ERR_CONNECTION_REFUSED" en localhost
- Console del navegador muestra errores de API

CAUSA RAÍZ:
- Frontend configurado para puerto incorrecto de API
- vite.config.ts apunta a puerto 5001 pero API corre en 3002

SOLUCIÓN RÁPIDA:
1) Verificar puertos activos: lsof -i :5173 -i :3002
2) Matar procesos antiguos: pkill -f node
3) Reiniciar con puerto correcto: VITE_API_URL=http://localhost:3002/api npm run dev
4) Verificar API funciona: curl "http://localhost:3002/api/contacts?start=2024-01-01&end=2024-12-31"

COMANDOS DE EMERGENCIA:
# Matar todos los procesos Node
pkill -f node

# Verificar puertos libres
lsof -i :3000 -i :3001 -i :3002 -i :5173

# Iniciar con configuración correcta
VITE_API_URL=http://localhost:3002/api npm run dev

# Probar que API responde
curl -I http://localhost:3002/health

PREVENCIÓN:
- Siempre verificar que vite.config.ts apunte al puerto correcto de la API
- Documentar cambios de puerto en .env o variables de entorno
- Probar endpoints de API antes de asumir que el problema es del frontend

---

PROBLEMA: Frontend llama a API de producción en lugar de localhost
SÍNTOMAS:
- Console muestra errores con URLs de producción (ej: app.hollytrack.com)
- Las tablas de campañas y reportes aparecen vacías
- Error 500 en llamadas a la API de producción desde localhost

CAUSA RAÍZ:
- El archivo .env.local contiene VITE_API_URL apuntando a producción
- NODE_ENV está configurado como 'production' en desarrollo local

SOLUCIÓN (2025-09-15):
1) Editar .env.local:
   - Cambiar VITE_API_URL=http://localhost:3002/api
   - Cambiar NODE_ENV=development
2) Reiniciar el servidor (matar proceso y volver a ejecutar npm run dev)
3) Refrescar el navegador con Ctrl+Shift+R para limpiar cache

VERIFICACIÓN:
# Confirmar que la API responde localmente
curl "http://localhost:3002/api/campaigns?start=2024-01-01&end=2024-12-31"

# Verificar que el proxy de Vite funciona
curl "http://localhost:5173/api/campaigns?start=2024-01-01&end=2024-12-31"

PREVENCIÓN:
- Mantener .env.local con configuración de desarrollo
- Crear .env.production separado para deployments
- Nunca commitear .env.local al repositorio

FIN.
- PROMPT ÚNICO PARA IA PROGRAMADORA — FRONT NUEVO + BACKEND PROPIO ORDENADO (SIN ROMPER NADA)

RESUMEN (LEE PRIMERO)
- Hay una app previa (“Ristak - App”) que sirve como REFERENCIA DE FUNCIONALIDAD, NO para copiar. Quiero algo más simple, limpio y eficiente.
- El FRONT debe replicar EXACTAMENTE el estilo de la imagen: /Users/raulgomez/Desktop/Ristak PRO/ESTILO APP.webp
  *Si la ruta no existe en tu entorno, DETENTE y pídela. No inventes.*
- Dos modos de trabajo:
  A) FRONT con backend EXISTENTE → no toques backend.
  B) FRONT + BACKEND PROPIO (nuevo/limpieza) → diseña una API mínima, clara y sin redundancias.

OBJETIVO
- Misma funcionalidad que la anterior, pero con mejor arquitectura y diseño consistente.
- Un cambio en tema/preset global se refleja en TODAS las pantallas y módulos.

DISEÑO (FUENTE ÚNICA DE VERDAD)
- Todo estilo sale de tokens/tema o componentes globales. Prohibidos estilos sueltos/inline.
- Light/Dark y efectos “glass” viven en el tema, no en cada componente.

ESTRUCTURA DE REPO (AGNÓSTICA)
Opción simple (carpetas hermanas):
- frontend/
  - src/ui/            → Componentes globales (Card, Table, Input, Button, Modal, etc.)
  - src/theme/         → Tokens/tema (colores, tipografías, radios, sombras, opacidades, etc.)
  - src/icons/         → Íconos centralizados
  - src/pages/         → Páginas que ensamblan módulos y componentes globales
  - src/modules/       → Módulos de negocio (pagos, contactos, campañas…) usando SOLO componentes de ui
- backend/
  - src/app/           → Entradas (controladores/handlers)
  - src/domain/        → Entidades y reglas de negocio por bounded context
  - src/services/      → Casos de uso (orquestación/validaciones)
  - src/repositories/  → Acceso a datos (ORM/queries) con interfaces claras
  - src/jobs/          → Tareas asíncronas/colas
  - src/shared/        → Utilidades comunes (auth, errores, logger, config)
- docs/
  - AI_CONTEXT.md, reglas.md, decisiones.md, rfc.md
  - api/ (OpenAPI/JSON Schema): openapi.yaml ES LA FUENTE DE VERDAD DE LA API

REGLAS DE ORO (OBLIGATORIAS)
1) NO crees archivos nuevos si ya existe uno equivalente. Reutiliza y refactoriza.
2) CERO estilos locales/inline. Todo va a tokens del tema o al componente global correspondiente.
3) Un solo preset por tipo (Card/Table/Input/Modal/etc.). Variantes vía props/slots, NO clonando componentes.
4) CERO huérfanos: registra exports, actualiza índices/imports, elimina lo obsoleto y documenta.
5) Cambios idempotentes: lee, planea, aplica, limpia. Cada PR debe ser repetible sin romper.
6) Documenta decisiones en docs/Decisiones.md (1–3 líneas con fecha y motivo).
7) Consistencia > ocurrencias locales. Si rompe el patrón, NO va.
8) LÓGICA DE CLIENTES: Un contacto es "client" SI Y SOLO SI tiene al menos 1 pago con status 'completed'. No importa el campo status de la tabla contacts.

COMPONENTES GLOBALES (MÍNIMO VIABLE EN FRONT)
- Layout · Card (info/métrica/advertencia) · Table (preset único) · Pagination
- Input/Select/DateRangePicker · Button · Modal/Drawer · Tabs
- Toast/Alert (incluye tarjetas de advertencia) · ChartContainer (tooltip con offset)
- Icon (siempre desde src/icons)

PRESETS CRÍTICOS (DONDE MÁS TRUENAN)
- Tabla: un solo preset para TODAS; sorting con cursor/ícono sin resaltar todo el header; column picker/reordenamiento con el mismo patrón; cero CSS local.
- Card: variantes por props; colores solo desde tokens.
- ChartContainer: tooltip con OFFSET; ejes/grid/formatos centralizados.
- DateRangePicker: estilo único. Cambia datos, NO labels fijos (ej. “Promedio diario”).
- Íconos: sólo desde src/icons.

— MODO A: FRONT SOBRE BACKEND EXISTENTE (NO TOCAR BACKEND) —
Se aplican todas las reglas de front. Si falta dato/endpoint, levanta un RFC en docs/Rfc.md y NO rompas nada.

— MODO B: CUANDO TOQUE DISEÑAR/ORDENAR BACKEND PROPIO —
OBJETIVO DE BACKEND
- API mínima, clara y estable. Sin “chorro” de endpoints ni duplicados.
- Cada endpoint responde a un caso de uso real. Nada de caprichos.

API-FIRST (FUENTE ÚNICA: /docs/api/openapi.yaml)
- Diseña/actualiza OpenAPI ANTES de codar. El contrato manda.
- Versiona la API (v1) en ruta o header; plan de deprecación con fechas.

ESTILO DE API (AGNÓSTICO)
- Recursos con nombres claros (plurales) y semántica constante.
- Verbo/semántica:
  - GET /recurso            (listar con paginación cursor)  ?cursor=&limit=&filter[...]=&sort=
  - GET /recurso/{id}
  - POST /recurso           (idempotency-key cuando aplique: pagos/altas)
  - PATCH /recurso/{id}     (parcial, con validación)
  - DELETE /recurso/{id}    (duro o soft-delete con deleted_at documentado)
- Evita endpoints “uno por filtro”. Usa filtros composables (filter[status], filter[date_from], etc.).
- Campos seleccionables (fields=) y expansiones controladas (include=) sólo si justifican performance.
- Paginación cursor-based por defecto. Devuelve next_cursor/prev_cursor.

MODELAJE DE DOMINIO Y DATOS
- Entidades con IDs estables (UUID/ULID), timestamps (created_at, updated_at), y (opcional) deleted_at.
- Índices y UNIQUE (incluyendo parciales) para evitar duplicados (ej. pagos).
- Idempotencia: cabecera Idempotency-Key en escrituras sensibles; locks si hace falta.
- Migraciones: aditivas, reversibles, cero downtime; nombres claros; seeds mínimas para smoke tests.

CAPAS Y RESPONSABILIDADES
- app/handlers: validan input, mapean HTTP ↔ DTOs. Sin lógica de negocio.
- services/: casos de uso, transacciones, reglas. Sin SQL/ORM directo.
- repositories/: queries/ORM. Sin reglas de negocio.
- domain/: entidades/valores/reglas puras.
- shared/: auth, config, errores, logging, tracing.

VALIDACIÓN, ERRORES Y CÓDIGOS
- Toda entrada validada (tipos/rangos/referencias). No confíes en el cliente.
- Error shape estable:
  { "error": { "code": "string_estable", "message": "humano", "details": [{ "field": "x", "issue": "y"}], "request_id": "..." } }
- Mapea bien 400/401/403/404/409/422/429 y 5xx. No escondas 409/422.

AUTENTICACIÓN Y AUTORIZACIÓN
- Tokens (sesión o JWT) con expiración/refresh. Roles y permisos por recurso/acción.
- Rate limit por IP/usuario y protección CSRF si aplica. Secretos en config segura.

OBSERVABILIDAD Y CONFIABILIDAD
- request_id y trace_id en cada request. Logs estructurados (JSON) con nivel y contexto.
- Métricas (latencia, tasa de error, colas, DB timing). Health/ready endpoints.
- Retries con backoff SOLO donde tenga sentido (lecturas idempotentes).

JOBS ASÍNCRONOS
- Tareas largas a cola (emails, imports, sincronizaciones). Reintentos y DLQ.
- Idempotencia/locks para evitar duplicados.

PERFORMANCE Y N+1
- Revisa explain/plans, índices, y N+1 (usa batch/fetch joins o loaders).
- Campos derivados en vistas/materializations si está justificado.

PRUEBAS (LÍNEA BASE)
- Contract tests (OpenAPI) + integración happy-path por módulo.
- Smoke test post-deploy: 1 GET, 1 POST, 1 PATCH, 1 DELETE representativos.
- Fixtures/seeds mínimas y limpias por entorno.

DEPRECACIÓN
- Marca en OpenAPI (deprecated: true), agrega header Deprecation y fecha EOL, loguea uso y provee alternativa.

CHECKLISTS

Frontend — Checklist Anti-Huérfanos
[ ] Reutilicé componentes globales (sin clones)
[ ] Variantes por props/slots
[ ] Estilos sólo en tokens/tema o ui/
[ ] Limpié duplicados y actualicé exports/imports
[ ] decisiones.md actualizado
[ ] Tooltips con offset, headers de tabla correctos
[ ] Light/Dark/“glass” desde el tema
[ ] Validación manual documentada

Backend — Checklist Anti-Redundancias
[ ] Caso de uso ↔ endpoint (uno que sirva a varios filtros)
[ ] Filtros composables; sin endpoints “uno por filtro”
[ ] Paginación cursor y shape consistente
[ ] Idempotency-Key donde aplique
[ ] Reglas en services/, datos en repositories/
[ ] Únicos/índices/migraciones aditivas
[ ] Errores con code estable y request_id
[ ] OpenAPI actualizado (fuente de verdad)
[ ] Logs/metrics/health listos
[ ] Tests mínimos pasan

FLUJO DE TRABAJO (SIEMPRE)

ANTES (obligatorio):
- Lee docs/AI_CONTEXT.md y openapi.yaml (si toca backend).
- Responde con “Plan en 5 bullets”:
  1) Qué vas a cambiar
  2) Dónde (rutas exactas)
  3) Qué vas a reutilizar
  4) Qué vas a eliminar/limpiar
  5) Riesgos y mitigación

HACER:
- FRONT: Reutiliza presets globales; mueve estilos a tokens; NO labels dinámicos por rango si el label es fijo.
- BACKEND: Diseña/ajusta contrato en OpenAPI, luego implementa; evita endpoints duplicados; valida entradas; errores consistentes.

DESPUÉS:
- Pasa ambos checklists (front y backend si aplica).
- Entrega rutas tocadas + breve diff mental + pasos de validación.
- Actualiza docs/Decisiones.md (1–3 líneas).

ENTREGABLES MÍNIMOS POR PR
- Archivos tocados/creados/eliminados.
- Resumen de cambios (3–7 bullets).
- Validación manual (pasos + resultado esperado).
- (Si backend) OpenAPI actualizado + pruebas contract/integración.
- Sin TODOs ni console.logs permanentes.

ESCENARIOS TÍPICOS Y CÓMO EVITARLOS
- “Hay 20 endpoints para lo mismo”: combina en uno con filtros y sorting.
- “Se duplican pagos/acciones”: usa Idempotency-Key + constraints únicos/índices parciales.
- “N+1”: usa batch/loaders o joins; mide latencias.
- “Tooltip tapa datos”: offset global en ChartContainer (NO local).
- “No se refleja el color”: el color está hardcodeado; mover a tokens del tema.
- “Se creó otro Button/Card”: prohibido; agrega props en el global.
- “El botón de deploy sale en prod”: condicionar por entorno y ocultar en producción.
- “Cambiaste labels por rango de fechas”: NO; sólo cambian los valores.
- “Rompiste contrato”: prohibido; propone RFC y sigue sin romper.

AMBIGÜEDAD / FALTA DE CONTEXTO
- NO inventes. Resume la duda (1–3 bullets), sugiere opción conservadora y pausa ese punto. Continúa con lo claro.

MODO DE RESPUESTA (OBLIGATORIO)
- Antes de tocar, dame el “Plan en 5 bullets”.
- Luego indica archivos a tocar, qué se reutiliza y qué se elimina.
- Al terminar, pasa checklists y entrega validación manual.

PROBLEMAS COMUNES Y SOLUCIONES RÁPIDAS

PROBLEMA: Frontend no muestra datos reales de la DB
SÍNTOMAS:
- La página carga pero muestra datos vacíos o de prueba
- Error "ERR_CONNECTION_REFUSED" en localhost
- Console del navegador muestra errores de API

CAUSA RAÍZ:
- Frontend configurado para puerto incorrecto de API
- vite.config.ts apunta a puerto 5001 pero API corre en 3002

SOLUCIÓN RÁPIDA:
1) Verificar puertos activos: lsof -i :5173 -i :3002
2) Matar procesos antiguos: pkill -f node
3) Reiniciar con puerto correcto: VITE_API_URL=http://localhost:3002/api npm run dev
4) Verificar API funciona: curl "http://localhost:3002/api/contacts?start=2024-01-01&end=2024-12-31"

COMANDOS DE EMERGENCIA:
# Matar todos los procesos Node
pkill -f node

# Verificar puertos libres
lsof -i :3000 -i :3001 -i :3002 -i :5173

# Iniciar con configuración correcta
VITE_API_URL=http://localhost:3002/api npm run dev

# Probar que API responde
curl -I http://localhost:3002/health

PREVENCIÓN:
- Siempre verificar que vite.config.ts apunte al puerto correcto de la API
- Documentar cambios de puerto en .env o variables de entorno
- Probar endpoints de API antes de asumir que el problema es del frontend


LIMPIEZA IMPORTANTE:
- Cuando verifiques que lo que acabamos de implementar ya quedó funcionando correctamente y se completó de manera exitosa, es importante dar un siguiente paso de limpieza. Esto significa que deberás revisar y eliminar todos aquellos archivos de prueba, así como implementaciones temporales o fragmentos de código que se usaron únicamente como apoyo para poder lograr la función que necesitábamos.

La idea es que no se quede basura en el proyecto ni partes que ya no tienen utilidad. Estos archivos o implementaciones fueron creados con un propósito muy específico: facilitar la construcción de lo que queríamos lograr. Una vez cumplido ese propósito, pierden sentido y lo mejor es quitarlos para que el sistema quede ordenado, limpio y sin elementos innecesarios que en el futuro puedan generar confusión o errores.

En resumen, después de confirmar que la nueva función está estable y lista, elimina cualquier recurso de uso único que se creó solo para llegar a este resultado. Esto asegura que el código sea más claro, fácil de mantener y profesional a largo plazo.

⸻

🔒 SEGURIDAD EN DEPLOYMENT Y MANEJO DE CREDENCIALES

PRINCIPIOS FUNDAMENTALES:
1. NUNCA hardcodear credenciales (contraseñas, tokens, API keys) en el código
2. Las credenciales viven en .env.local (LOCAL) que NUNCA se sube al repo
3. El servidor valida que las variables coincidan antes de deployar
4. Usar usuario específico para deployment, no root
5. Todos los secretos deben ser rotables sin tocar código

ARQUITECTURA DE SEGURIDAD:
```
LOCAL (tu máquina):
├── .env.local          # Credenciales reales (NUNCA al repo)
├── .env.example        # Plantilla sin valores (SÍ al repo)
└── .gitignore          # DEBE incluir .env*

SERVIDOR (producción):
├── /etc/ristak-pro/
│   ├── env.production  # Variables (chmod 600)
│   └── env.schema      # Variables requeridas
```

VALIDACIÓN DE DEPLOYMENT:
1. Leer variables locales desde .env.local
2. Conectar al servidor con credenciales seguras
3. Validar que servidor tiene TODAS las variables
4. Si falta alguna → ERROR y abortar
5. Si coinciden → proceder con deployment

MANEJO DE CREDENCIALES SSH:

❌ MALO (NUNCA hacer):
```bash
SERVER_PASSWORD="Raulgom123"  # EXPUESTO!
```

✅ BUENO (usar variables):
```bash
source .env.local
sshpass -p "$DEPLOY_PASSWORD" ssh deploy@servidor
```

⭐ MEJOR (usar SSH keys):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/ristak-deploy
ssh-copy-id -i ~/.ssh/ristak-deploy.pub deploy@servidor
ssh -i ~/.ssh/ristak-deploy deploy@servidor
```

CHECKLIST DE SEGURIDAD:
□ .env.local existe con todas las variables
□ .env NUNCA está en el repositorio
□ .gitignore incluye .env* (excepto .env.example)
□ Credenciales en variable de entorno o archivo separado
□ Validar variables antes de conectar al servidor
□ Usar usuario no-root para deployment
□ No mostrar credenciales en logs
□ Permisos 600 en archivos sensibles
□ Rotar credenciales regularmente

SI SE EXPONEN CREDENCIALES:
1. INMEDIATO: Cambiar TODAS las contraseñas
2. Auditar logs de acceso buscando intrusos
3. Implementar 2FA donde sea posible
4. Documentar el incidente

SCRIPTS DE DEPLOYMENT:
- deploy-secure.sh: Script que valida y NO incluye credenciales
- Debe leer todo desde .env.local
- Debe validar permisos de archivos
- Debe excluir .env* del deployment
- Debe registrar auditoría de deployments