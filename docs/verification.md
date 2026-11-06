# Registro de implementación y verificación

## 5 de noviembre de 2026 · Despliegue y app (rama `feature/despliegue-y-app`)

Entorno: macOS (Apple M2), Docker 29.8.2. Base y API en un stack aislado (`vetgest-verify`) con migraciones desde cero.

| Comprobación | Resultado |
|---|---|
| Backend en Docker | **42 pytest** (35 anteriores + 7 nuevas: token Bearer, turnos y capacidad, cruce de veterinario, sala de espera, cobros e ingresos, inventario) + Ruff OK |
| Migración `0003` | `alembic check` sin diferencias; `downgrade 0002 → upgrade 0003` OK |
| Web | **51 Vitest** + ESLint + TypeScript + build OK, también en Docker con pnpm 10 |
| App Expo (SDK 58) | `tsc` OK, **27 pruebas jest**, `expo-doctor` 20/20, `expo export --platform web` OK |
| Navegador, web contra la API real | Propietaria pide turno (4 pasos, primer turno libre) → recepción confirma con veterinario y registra llegada → veterinario inicia consulta y registra la vacuna con producto del inventario (12 → 11 dosis) → caja cobra S/ 55 con Yape → ingresos muestra S/ 55 y ticket promedio |
| Navegador, app (Expo web) contra la API real | Ingreso con token Bearer; Inicio muestra el turno confirmado con la línea de estados; Citas muestra la atención «Pagado S/ 55.00 · Yape». Modo claro y oscuro |
| Bugs encontrados y corregidos | Pruebas antiguas fallaban de noche (fecha UTC del contenedor); el botón «Continuar» del paso 3 enviaba el turno sin pasar por el resumen; montos partidos en los indicadores; avatar cortado en celular |

**Pendiente:** despliegue en Supabase, Render y Vercel sin ejecutar; app no probada en un teléfono real (Expo Go) ni en el simulador iOS; Playwright E2E actualizado pero no ejecutado.

---

## 9 de octubre de 2026 · Roles multi-clínica (rama `feature/roles-multiclinica`)

Entorno: macOS (Apple M2), Docker 29.8.2, Compose 5.5.1. Red con inspección TLS (Fortinet) que bloquea `registry.npmjs.org`; se instaló desde `registry.yarnpkg.com` con `NPM_REGISTRY`, que valida contra el mismo lockfile.

| Comprobación | Resultado |
|---|---|
| `docker compose build` y `up` | API y BD saludables; web responde 200; `/api/health` OK |
| Suite original antes de cambios | 25 pytest + Ruff OK; 29 Vitest + ESLint + TypeScript + build OK |
| Migración `0002` sobre la base con datos de la `0001` | Aplicada en el arranque sin pérdida |
| `alembic upgrade → downgrade 0001 → upgrade` y `alembic check` | OK, sin divergencias modelo/migración |
| Backend final | **35 pytest** (roles, aislamiento entre clínicas, flujo de citas, historial, recordatorios, alta/suspensión, bloqueo de la Data API de Supabase) + Ruff OK |
| Frontend final | **32 Vitest** (incluye redirección por rol y cambio obligatorio de contraseña) + ESLint + TypeScript + build OK |
| Navegador (localhost:8080) | Recepción confirmó y asignó una cita → el veterinario registró la atención con una vacuna → el propietario vio el historial y el recordatorio → el admin de plataforma vio las métricas y las clínicas → el admin de la clínica vio su equipo. El propietario es redirigido fuera de `/clinica`. Sin errores de consola; sin desbordamiento a 375 px |
| Bug encontrado y corregido | `BOOTSTRAP_ADMIN_EMAIL` con dominio `.local` creaba una cuenta que el login rechazaba; ahora la configuración lo valida al arrancar |

**Pendiente:** Playwright E2E no se actualizó para los nuevos roles; el despliegue en Render/Supabase no se ha ejecutado (ver [deploy.md](deploy.md)).

---

## 10 de septiembre de 2026 · Sprint 1 (registro original)

Fecha de trabajo: 10 de septiembre de 2026. Repositorio inicial vacío.

## Estado honesto

**No se declara ninguna historia como terminada funcionalmente.** El código y las pruebas están escritos, pero falta ejecutar la integración con PostgreSQL, las pruebas y el navegador. La Definition of Done exige esas comprobaciones.

| Área | Implementación | Verificación |
|---|---|---|
| US01–US02 Cuenta y sesión | Registro, hash Argon2id, JWT en cookie, logout revocable y rutas privadas | Sintaxis Python revisada; pruebas funcionales pendientes |
| US03 Perfil | Lectura y modificación del perfil propio | Pruebas escritas, no ejecutadas |
| US04 Mascotas | CRUD, validaciones, estados vacíos y baja lógica confirmada | Pruebas escritas, no ejecutadas |
| US05–US06 Catálogo | Tres clínicas y doce servicios ficticios; búsqueda y filtro | Seed y consultas sin ejecutar |
| US07 Citas | Crear/listar/detalle/cancelar, autorización y consistencia de servicio | Pruebas escritas, no ejecutadas |
| Interfaz | Inicio, registro/login, panel, perfil, mascotas, catálogo/servicios, citas y 404 | CSS responsive preparado; compilación y revisión visual pendientes |
| Infraestructura | Compose, Dockerfiles, migración y seed idempotente | Docker/Compose no disponibles en el host |
| Documentación | README, arquitectura, API, Sprint y este registro | Revisión estática |

## Comprobaciones ejecutadas

| Comando / comprobación | Resultado observado |
|---|---|
| Inspección inicial con `rg --files` y listado de archivos ocultos | Directorio sin código ni instrucciones adicionales |
| Detección de herramientas | Node y Python del runtime disponibles; Docker y PostgreSQL no encontrados |
| `pnpm install` | Falló el acceso al registro: EACCES; petición de ejecución con acceso externo rechazada por el usuario |
| `pnpm install --offline` | Falló: `ERR_PNPM_NO_OFFLINE_META` para `@eslint/js` |
| `pip install --no-index -r backend/requirements-dev.txt` | Falló: FastAPI no está disponible en la caché local |
| `python -m compileall -q backend scripts` | Aprobado incluyendo API, migración, seed, pruebas y generador; no valida importaciones ni comportamiento |
| `node --check frontend/eslint.config.js` | Aprobado: sintaxis JavaScript de la configuración |
| Parseo JSON de package.json y tsconfig.json | Aprobado |
| `python -m pytest backend/tests -q` | No pudo iniciar: `No module named pytest` |
| `pnpm run build` | No compiló: el gestor intentó resolver las dependencias faltantes, falló con EACCES y se detuvo |

## Pruebas preparadas, todavía no ejecutadas

- Backend pytest sobre **PostgreSQL real**, con base aislada y rollback: registro y duplicado, hash, validación segura, login correcto/incorrecto, logout y revocación, cookie, perfil, rutas privadas, token inválido/expirado, CRUD y acceso ajeno, pesos/fechas inválidos, ciclo de cita, baja bloqueada, cita ajena, fechas pasadas/sin zona, servicio incoherente, catálogo y origen no permitido.
- Frontend Vitest: esquemas de registro/mascota/cita, carga/error/vacío, formulario inválido y recorrido registro → login → mascota con contrato HTTP simulado.
- Playwright: flujo con API real en escritorio 1440×1000 y Pixel 7, persistencia tras recarga, edición, búsqueda/servicios, solicitud/cancelación, perfil, eliminación, logout, detección de desbordamiento horizontal, captura de pantallas y errores de consola.
- Ruff, ESLint, TypeScript y build de Vite.
- Aplicar/revertir/reaplicar migración, `alembic check`, seed repetido y arranque de Compose.

## Pendiente para cerrar el sprint

1. Autorizar/permitir la instalación de dependencias, ejecutar y guardar el lockfile generado.
2. Disponer de Docker con motor activo, o PostgreSQL local con bases de aplicación y pruebas.
3. Ejecutar las migraciones, repetir seed y comprobar modelo contra migración.
4. Ejecutar suites y linters; corregir cualquier fallo real, no solo de sintaxis.
5. Compilar, arrancar el sistema y ejecutar Playwright.
6. Inspeccionar visualmente las capturas y la consola en ambas resoluciones.
7. Actualizar este registro con evidencia y resultados reales.

## Resumen de archivos

Todos son nuevos: no había archivos funcionales que modificar. Se añadieron configuración raíz y Compose; backend modular con seis entidades, cuatro dominios, migración y seed; frontend React con rutas, componentes, estilos y formularios; pruebas backend/frontend/E2E; Dockerfiles y Nginx; documentos en `docs/`; generador de `.env`.

No se generaron ni publicaron secretos reales. `.env`, entornos virtuales, cachés, dependencias y resultados de pruebas están ignorados. No se desplegó a un servicio externo ni se contactó a clínicas reales.
