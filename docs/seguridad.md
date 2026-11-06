# Gestión de seguridad de la información

Cómo VetGest protege la información de las veterinarias y de los propietarios: qué se protege, qué riesgos hay, qué controles existen (con su evidencia) y cómo se responde a un incidente. La administración de la base de datos está en [administracion-bd.md](administracion-bd.md).

Marcos de referencia: **OWASP Top 10 (2021)** para la aplicación, **ISO/IEC 27001:2022, Anexo A** para la gestión y la **Ley N.º 29733** (Protección de Datos Personales, Perú) para los datos de los propietarios.

## 1. Activos y clasificación

| Activo | Ejemplos | Clasificación | Dónde vive |
|---|---|---|---|
| Datos personales de propietarios | Nombre, correo, teléfono | Confidencial (Ley 29733) | Supabase (`users`, `profiles`) |
| Información clínica | Historias, vacunas, tratamientos | Confidencial | Supabase (`medical_records`, `care_events`) |
| Información comercial | Cobros, ingresos, inventario | Interna | Supabase (`payments`, `inventory_*`) |
| Credenciales | Hashes de contraseñas, tokens de sesión | Secreta | Supabase (solo hashes); cookie HttpOnly; almacenamiento seguro del celular |
| Secretos de infraestructura | `DATABASE_URL`, `JWT_SECRET`, `BACKUP_PASSPHRASE` | Secreta | Paneles de Render y GitHub. Nunca en el repositorio |
| Código fuente | Repositorio | Pública / interna | GitHub (`cuy69/VetGest`, fork `Aldairz16/VetGest`) |
| Respaldos | Volcados diarios | Secreta (cifrados) | GitHub Actions, 7 días |

## 2. Roles y responsabilidades

| Rol | Responsabilidad |
|---|---|
| Administrador de plataforma | Da de alta y suspende veterinarias. Custodia los secretos de Render, Vercel, Supabase y GitHub |
| Administrador de veterinaria | Crea y desactiva cuentas de su personal, define servicios, horarios e inventario |
| Veterinario / Recepción | Usan solo los datos de su veterinaria según su rol |
| Propietario | Ve y gestiona solo sus mascotas y citas |
| Equipo de desarrollo | Cambios por rama y revisión; ningún secreto en el código; pruebas antes de desplegar |

La matriz de permisos completa está en [roles.md](roles.md).

## 3. Riesgos

Probabilidad e impacto: A = alto, M = medio, B = bajo. «Residual» es el riesgo después de los controles.

| # | Riesgo | Prob. | Impacto | Controles | Residual |
|---|---|---|---|---|---|
| R1 | Un usuario ve o modifica datos de otra veterinaria o de otro propietario | M | A | C1, C2, C9 | B |
| R2 | Robo de contraseñas por fuerza bruta | M | A | C4, C5 | B |
| R3 | Robo de la sesión (XSS, CSRF, *clickjacking*) | M | A | C6, C7, C8 | B |
| R4 | Filtración de la base por la Data API pública de Supabase | M | A | C9 | B |
| R5 | API comprometida que borra o altera el esquema | B | A | C10 | B |
| R6 | Pérdida de datos (borrado, fallo del proveedor, pausa del proyecto) | M | A | C11, C12 | M (RPO 24 h) |
| R7 | Secretos expuestos en código o logs | M | A | C13, C14 | B |
| R8 | Inyección SQL | B | A | C15 | B |
| R9 | Acciones del personal sin trazabilidad | M | M | C16 (parcial) | M |
| R10 | Dependencias con vulnerabilidades | M | M | C17 | M |

## 4. Controles

| # | Control | OWASP | ISO 27001 | Evidencia |
|---|---|---|---|---|
| C1 | **Control de acceso por rol y por veterinaria** en cada endpoint (`require_owner`, `require_staff`, `require_platform_admin`). Un recurso ajeno responde 404 | A01 | A.5.15, A.8.3 | `backend/app/core/security.py`; `tests/test_roles.py` |
| C2 | **Integridad en la base**: claves foráneas compuestas que impiden mezclar datos de veterinarias o dueños | A01, A04 | A.8.3 | [database.md](database.md) |
| C3 | **Contraseñas con Argon2** (`pwdlib`), mínimo 10 caracteres; el registro público solo crea propietarios; el personal lo crea su administrador | A02, A07 | A.5.17, A.8.5 | `backend/app/domains/auth.py`, `schemas.py` |
| C4 | **Límite de intentos**: 5 fallos en 15 minutos bloquean la cuenta 15 minutos (HTTP 429 con `Retry-After`), en la web y en la app. Un ingreso correcto reinicia el contador. Mismo tiempo de respuesta exista o no el correo (`dummy_hash`) | A07 | A.8.5 | `tests/test_owner_flow.py::test_login_locks_after_repeated_failures` |
| C5 | **Contraseña temporal obligatoria de cambiar** al primer ingreso (`must_change_password`); cambiar la contraseña o cerrar sesión revoca todas las sesiones (`token_version`) | A07 | A.5.17 | `tests/test_owner_flow.py` |
| C6 | **Sesión web en cookie HttpOnly, Secure, SameSite=Lax**, 60 minutos, ruta `/api`. JWT HS256 con emisor, audiencia, expiración y versión verificados en cada petición | A07 | A.8.5 | `backend/app/core/security.py` |
| C7 | **Control de origen (CSRF)**: las escrituras con cookie desde otro origen se rechazan con 403; CORS limitado al dominio de la web | A01 | A.8.26 | `backend/app/main.py` |
| C8 | **Cabeceras**: CSP estricta, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS en la web y en la API, `Cache-Control: no-store` en la API | A05 | A.8.9 | `frontend/vercel.json`, `backend/app/main.py` |
| C9 | **Data API de Supabase bloqueada**: RLS activo y permisos revocados a `anon` y `authenticated` en cada arranque | A01, A05 | A.8.3 | `tests/test_deploy.py::test_supabase_data_api_cannot_read_tables` |
| C10 | **Mínimo privilegio en la base**: la API usa `vetgest_app`, sin `DELETE`, `TRUNCATE` ni DDL | A01 | A.8.2 | [administracion-bd.md §3](administracion-bd.md#3-usuarios-y-privilegios-mínimo-privilegio) |
| C11 | **Respaldo diario cifrado** (AES-256), verificado y con restauración probada | — | A.8.13 | [administracion-bd.md §4](administracion-bd.md#4-respaldos) |
| C12 | **Nada clínico se borra**: `ON DELETE RESTRICT`, bajas lógicas, cobros anulables solo con motivo | A04 | A.8.13 | [database.md](database.md) |
| C13 | **Secretos fuera del código**: variables de Render, Vercel y GitHub; `.env` ignorado por git; la configuración inválida nunca imprime valores | A05 | A.8.9 | `backend/app/core/config.py`; `tests/test_deploy.py::test_invalid_settings_never_print_secret_values` |
| C14 | **Errores sin datos sensibles**: validaciones que no devuelven lo enviado (contraseñas), errores de base sin SQL | A09 | A.8.15 | `backend/app/main.py`; `test_registration_validation_does_not_echo_password` |
| C15 | **Consultas parametrizadas** con SQLAlchemy y validación de entrada con Pydantic y zod | A03 | A.8.28 | `backend/app/schemas.py`, `frontend/src` |
| C16 | **Trazabilidad**: `created_at`/`updated_at` en todas las tablas; responsable en cobros, anulaciones e inventario | A09 | A.8.15 | `backend/app/models.py` |
| C17 | **Dependencias fijadas** (`requirements.txt` con versiones exactas, `pnpm-lock.yaml`, `package-lock.json`) | A06, A08 | A.8.25 | Repositorio |
| C18 | **Cifrado en tránsito**: HTTPS en Vercel y Render; TLS hacia Supabase | A02 | A.8.24 | Despliegue |
| C19 | **App móvil**: token Bearer en `expo-secure-store` (Keychain/Keystore), solo para propietarios; el personal no puede entrar desde la app | A07 | A.8.5 | `mobile/src/lib`; `POST /api/auth/token` |
| C20 | **Contenedor sin privilegios**: la API corre con el usuario `vetgest`, no `root` | A05 | A.8.9 | `backend/Dockerfile` |

## 5. Políticas

**Contraseñas y cuentas**
- Mínimo 10 caracteres (12 para el administrador de arranque). Se guardan con Argon2; nadie las puede leer.
- Las cuentas del personal las crea el administrador de su veterinaria con una contraseña temporal que se cambia al primer ingreso. La contraseña temporal se entrega por un canal distinto al correo de la cuenta.
- Una persona que deja la veterinaria se **desactiva** el mismo día (no se borra, para conservar la trazabilidad).
- Suspender una veterinaria bloquea a todo su personal.

**Secretos**
- Solo los custodia el administrador de plataforma, en los paneles de Render, Vercel, Supabase y GitHub.
- Nunca se pegan en el chat, en el código, en notas ni en capturas.
- Se rotan ante cualquier sospecha de exposición y al cambiar de responsable.

**Datos personales (Ley 29733)**
- Solo se piden los datos necesarios para la atención: nombre, correo, teléfono.
- Cada veterinaria ve solo a sus pacientes y propietarios.
- Antes de operar con datos reales: aviso de privacidad visible en el registro e inscripción del banco de datos ante la Autoridad Nacional de Protección de Datos Personales (pendiente, ver §7).

**Cambios**
- Todo cambio va por rama y revisión; `main` no se modifica directamente.
- Antes de desplegar: pruebas del backend, la web y la app en verde.
- Cambios de esquema solo por migraciones de Alembic.

## 6. Gestión de incidentes

1. **Detectar.** Logs de Render, avisos de Supabase Advisors, reportes de usuarios.
2. **Contener.** Rotar el secreto afectado; suspender la cuenta o la veterinaria involucrada; si hace falta, pausar el servicio en Render.
3. **Erradicar y corregir.** Corregir la causa en el código con una prueba que la cubra.
4. **Recuperar.** Restaurar desde el último respaldo si hubo pérdida o alteración de datos.
5. **Registrar.** Fecha, qué pasó, impacto, causa, acciones y responsable.
6. **Notificar.** Si hubo datos personales expuestos, avisar a las veterinarias afectadas y evaluar la comunicación a los titulares según la Ley 29733.

### Registro de incidentes

| Fecha | Incidente | Impacto | Causa | Acciones | Estado |
|---|---|---|---|---|---|
| 05/11/2026 | Parte del `JWT_SECRET` apareció en el log de Render durante un arranque fallido | Un secreto de firma de sesiones expuesto en los logs del proveedor (acceso restringido al equipo). Sin usuarios aún | Pydantic incluía los valores recibidos en su mensaje de error de configuración | Secreto rotado con un valor generado por Render; el error de configuración ya no imprime valores (`f988414`), con prueba | Cerrado |

## 7. Limitaciones y plan

| Pendiente | Riesgo | Plan |
|---|---|---|
| Bitácora de auditoría general (quién vio o cambió qué) | R9 | Tabla `audit_log` de solo inserción escrita por la API en acciones del personal |
| Doble factor (MFA) para administradores | R2 | TOTP para administradores de plataforma y de veterinaria |
| Contador de intentos en memoria (una sola instancia en Render) | R2 | Pasarlo a PostgreSQL si la API corre en varias instancias |
| Revisión automática de dependencias | R10 | Activar Dependabot en GitHub |
| Aviso de privacidad e inscripción del banco de datos (Ley 29733) | Legal | Antes de operar con propietarios reales |
| RPO de 24 horas | R6 | Replicación lógica o PITR cuando haya varias veterinarias |
