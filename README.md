# VetGest

Plataforma multi-clínica para la gestión y el cuidado de mascotas. Interfaz en español, importes en soles y citas en hora de Lima (UTC−5).

- **Propietarios (web y app móvil Expo):** mascotas, solicitud de turnos libres, estado de la cita en vivo, historial clínico y recordatorios de vacunas y controles.
- **Clínicas:** recepción (agenda, sala de espera y caja), veterinarios (consulta, atenciones, vacunas y tratamientos con descuento de inventario) y administrador (equipo, servicios, horario, inventario e ingresos).
- **Administración VetGest:** alta y suspensión de clínicas, métricas.

Perfiles y reglas: [docs/roles.md](docs/roles.md). Despliegue en Supabase + Render (API) + Vercel (web): [docs/deploy.md](docs/deploy.md). App móvil: [mobile/README.md](mobile/README.md). Administración de la base de datos (privilegios, respaldos, replicación): [docs/administracion-bd.md](docs/administracion-bd.md). Seguridad de la información (riesgos, controles, incidentes): [docs/seguridad.md](docs/seguridad.md).

**Estado actual (05/11/2026):** backend (42 pruebas), web (51 pruebas, ESLint, TypeScript y build) y app Expo (27 pruebas) verificados; el recorrido completo se probó en el navegador contra la API real. Falta desplegar. Detalle en [el registro de verificación](docs/verification.md).

## Ejecutar con Docker Compose

Requisitos: Docker Engine/Desktop con Compose v2, motor activo y acceso a Internet para descargar imágenes y dependencias. Se usan los puertos internos 5432 y 8000; solo la web se publica en `127.0.0.1:8080`.

1. En la raíz del proyecto, crea el archivo local de configuración:

   ```sh
   cp .env.example .env
   ```

   En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Sustituye `POSTGRES_PASSWORD` y `JWT_SECRET` por valores aleatorios; el secreto JWT necesita al menos 32 caracteres. Alternativamente, si tienes Python 3, `python scripts/init_env.py` crea `.env` con valores aleatorios y no sobrescribe archivos existentes. No ejecutes ambas alternativas sobre el mismo archivo.
3. Desde la raíz:

   ```sh
   docker compose up --build
   ```

4. Abre [VetGest](http://localhost:8080) y crea tu propia cuenta de propietario. No existen usuarios ni contraseñas de demostración.
5. Para entrar como **administrador de plataforma**, define en `.env` `BOOTSTRAP_ADMIN_EMAIL` (dominio real, no `.local`) y `BOOTSTRAP_ADMIN_PASSWORD` (12+ caracteres) antes de arrancar. Desde ese perfil se dan de alta clínicas con su administrador, que a su vez crea veterinarios y recepcionistas. Toda contraseña temporal se cambia en el primer ingreso.
6. La API ejecuta `alembic upgrade head` y `python -m app.seed` antes de arrancar. El seed es idempotente: carga tres veterinarias ficticias y doce servicios (desactívalo con `SEED_DEMO_CATALOG=false`) y crea el admin de arranque si no existe.
7. Si tu red inspecciona TLS y bloquea `registry.npmjs.org` (error `UNABLE_TO_VERIFY_LEAF_SIGNATURE`), añade `NPM_REGISTRY=https://registry.yarnpkg.com/` a `.env`.

- [Swagger](http://localhost:8080/api/docs): usa primero `POST /api/auth/login`; el navegador conserva la cookie para probar los endpoints privados. Los recursos de Swagger necesitan acceso a jsDelivr.
- [Salud de la API y conexión a PostgreSQL](http://localhost:8080/api/health).
- Detener conservando datos: `docker compose down`. El volumen `postgres_data` persiste los datos. No uses `down -v` si quieres conservarlos.
- Los contenedores API y base de datos no publican puertos hacia el host. Las páginas utilizan `/api` a través de Nginx.

El compose se ejecutó y validó el 9 de octubre de 2026 con Docker 29.8 y Compose 5.5. `frontend/pnpm-lock.yaml` está versionado y el Dockerfile instala con `--frozen-lockfile`.

## Desarrollo sin Docker

Requisitos: PostgreSQL 17, Python 3.12+, Node 22.12+ y pnpm 10+. Primero prepara `.env` como se describe arriba.

1. Crea una base de datos `vetgest` y un usuario `vetgest` cuyo password coincida con `.env`. Configura `POSTGRES_HOST` y `POSTGRES_PORT` si no usas `localhost:5432`.
2. Backend, desde la raíz:

   ```sh
   python -m venv .venv
   # Linux/macOS:
   source .venv/bin/activate
   # PowerShell: .\.venv\Scripts\Activate.ps1
   python -m pip install -r backend/requirements-dev.txt
   cd backend
   alembic upgrade head
   python -m app.seed
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

3. En otra terminal:

   ```sh
   cd frontend
   pnpm install
   pnpm dev
   ```

4. Abre [la aplicación local](http://localhost:5173). Vite reenvía `/api` a `127.0.0.1:8000`. Usa `localhost` en el navegador: los orígenes permitidos deben coincidir exactamente con `CORS_ORIGINS`.

Para Swagger directamente en el puerto 8000, añade `http://localhost:8000` a `CORS_ORIGINS` y reinicia el backend. En Docker usa Swagger en el puerto 8080, ya permitido.

## Validaciones y pruebas

Estas instrucciones son reproducibles; no representan resultados ya obtenidos.

### Con Docker

```sh
# PostgreSQL aislado en tmpfs; no toca los datos del propietario.
docker compose --profile test run --build --rm backend-test
docker compose --profile test run --build --rm frontend-test
```

La primera orden aplica migraciones, carga el catálogo y ejecuta pytest y Ruff contra `vetgest_test`. La segunda ejecuta Vitest, ESLint, TypeScript y la compilación de Vite. El servicio `db-test` no publica un puerto y tiene datos efímeros.

### En desarrollo

```sh
cd frontend
pnpm test
pnpm lint
pnpm build
```

Para pytest, prepara una segunda base PostgreSQL cuyo nombre termine en `_test`. Aplica la migración en esa base; nunca apuntes las pruebas a datos reales. Define `TEST_DATABASE_URL` con su URL y ejecuta desde `backend`:

```sh
# DATABASE_URL se usa al aplicar Alembic; TEST_DATABASE_URL por los fixtures.
# Configura ambas variables con la URL de tu base de pruebas.
alembic upgrade head
python -m pytest -q
python -m ruff check .
alembic check
```

Los fixtures ejecutan cada caso dentro de una transacción con savepoints y rollback. Se rechazan bases que no sean PostgreSQL o no terminen en `_test`. `alembic check` detecta divergencias entre la migración y el modelo; no se ejecutó aquí.

### Flujo real en navegador

Arranca la aplicación con Compose. Luego, desde `frontend`:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Para Vite configura `E2E_BASE_URL=http://localhost:5173` (`$env:E2E_BASE_URL='http://localhost:5173'` en PowerShell). La suite ejecuta el flujo en escritorio y en móvil, llama a la API real, verifica persistencia al recargar, registra/edita/elimina una mascota, solicita/cancela una cita, modifica el perfil y cierra sesión. Genera capturas en `frontend/test-results` y un reporte en `frontend/playwright-report`.

Ejecuta E2E contra una instalación de pruebas: crea cuentas con correos aleatorios, conserva la cita cancelada y deja esas cuentas en esa base. No uses una instalación con datos reales. Las pruebas unitarias de UI simulan las respuestas HTTP; **no sustituyen** a E2E.

## Arquitectura y organización

```text
backend/
  app/core/          Configuración, conexión, hash y sesión JWT
  app/domains/       Routers: auth, mascotas, catálogo, citas, clínica (personal) y admin
  app/models.py     Entidades SQLAlchemy
  app/schemas.py    Contratos y validaciones Pydantic
  app/seed.py       Catálogo ficticio idempotente
  migrations/       Migración Alembic versionada
  tests/            Casos funcionales con PostgreSQL
frontend/
  src/components/   Navegación, formularios y estados reutilizables
  src/pages/        Propietario, clínica (Clinic*.tsx) y administración (Admin.tsx)
  src/lib/          Cliente HTTP, tipos, consultas y esquemas Zod
  src/test/         Vitest, Testing Library y flujo con contrato HTTP simulado
  e2e/              Playwright, API real, escritorio y móvil
docs/               Sprint, modelo, API y resultados de verificación
scripts/            Generación segura de configuración local
compose.yaml        Web + API + PostgreSQL y servicios de pruebas
```

Es un monolito modular: una API y una base PostgreSQL. No hay microservicios ni almacenamiento de datos de negocio en el navegador. React Router organiza las rutas; TanStack Query obtiene/invalida datos; React Hook Form y Zod validan formularios. Tailwind CSS v4 se integra mediante Vite; el tema y los componentes visuales están en `styles.css`.

## Seguridad y decisiones de producto

- Contraseñas Argon2id con `pwdlib`. JWT HS256, emisor/audiencia, expiración de 60 minutos y versión de sesión consultada en la base. Cookie `HttpOnly`, `SameSite=Lax`, ruta `/api`; sin token en localStorage.
- Cerrar sesión revoca **todas las sesiones de esa cuenta** incrementando la versión, además de eliminar la cookie. Es una decisión deliberada para este sprint.
- Los formularios de escritura solo aceptan campos declarados. El backend deriva el propietario de la sesión y verifica la propiedad en cada acceso; responde 404 a recursos ajenos.
- Mutaciones desde orígenes no permitidos o con `Sec-Fetch-Site: cross-site` se rechazan. CORS usa una lista explícita. Los clientes no navegador pueden omitir Origin, pero necesitan una cookie JWT válida para recursos privados.
- Las citas nuevas se guardan como `Pendiente`; recepción las confirma, reprograma o cancela. No hay motor de disponibilidad ni pagos.
- El catálogo, direcciones, teléfonos y precios son **ficticios**. Las solicitudes no se envían a clínicas reales.
- Permisos por rol verificados en el backend (`require_staff`, `require_owner`, `require_platform_admin`); la interfaz solo refleja esas reglas.
- Fotos de mascotas, recuperación de contraseña, verificación de correo, notificaciones por correo/WhatsApp, pagos y mapas no forman parte de esta entrega. Ver riesgos en [docs/roles.md](docs/roles.md).
- Para un despliegue público se requiere HTTPS, `COOKIE_SECURE=true`, dominio exacto en CORS, secretos nuevos, copias de seguridad y una revisión de seguridad. Hay límite de intentos de inicio de sesión (por proceso, no distribuido); no hay autenticación multifactor. Ver [docs/seguridad.md](docs/seguridad.md).

Ver [decisiones del modelo](docs/architecture.md), [contratos REST](docs/api.md), [Sprint 1](docs/sprint-1.md) y [verificación real](docs/verification.md).

## Recursos visuales y referencias

Foto “Real life best friends”, Krista Mangulsone, publicada originalmente en Unsplash en 2015; [Wikimedia documenta CC0](https://commons.wikimedia.org/wiki/File:Real_life_best_friends_(Unsplash).jpg). Se usa el recurso remoto de Unsplash, por lo que la fotografía requiere conexión; el contenido y los formularios siguen siendo utilizables si no carga.

Referencias de implementación: [FastAPI: JWT y hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) y [Vite: requisitos de ejecución](https://vite.dev/guide/).
