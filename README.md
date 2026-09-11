# VetGest · Sprint 1

Aplicación para propietarios de mascotas: registro, sesión, perfil, mascotas, catálogo de veterinarias y solicitudes de citas. Interfaz en español, importes en soles y citas en hora de Lima (UTC−5).

**Estado actual:** implementación escrita; la verificación funcional sigue pendiente. No se pudo instalar las dependencias porque la descarga fue rechazada y no están disponibles sin conexión. Docker y PostgreSQL tampoco están instalados en el equipo de trabajo. Consulta [el registro de verificación](docs/verification.md) antes de considerar el sprint terminado.

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

4. Abre [VetGest](http://localhost:8080) y crea tu propia cuenta. Tras registrarte, inicia sesión. No existen usuarios ni contraseñas de demostración.
5. La API ejecuta `alembic upgrade head` y `python -m app.seed` antes de arrancar. El seed es idempotente y carga tres veterinarias ficticias y doce servicios, sin sobrescribir registros existentes.

- [Swagger](http://localhost:8080/api/docs): usa primero `POST /api/auth/login`; el navegador conserva la cookie para probar los endpoints privados. Los recursos de Swagger necesitan acceso a jsDelivr.
- [Salud de la API y conexión a PostgreSQL](http://localhost:8080/api/health).
- Detener conservando datos: `docker compose down`. El volumen `postgres_data` persiste los datos. No uses `down -v` si quieres conservarlos.
- Los contenedores API y base de datos no publican puertos hacia el host. Las páginas utilizan `/api` a través de Nginx.

El compose está preparado, pero **no se ha ejecutado en este entorno**. El frontend todavía no tiene lockfile porque no hubo una instalación exitosa. Se fijaron versiones directas; genera y versiona `frontend/pnpm-lock.yaml` tras la primera instalación y validación. El Dockerfile acepta ese lockfile cuando exista.

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
  app/domains/       Routers de autenticación, mascotas, catálogo y citas
  app/models.py     Entidades SQLAlchemy
  app/schemas.py    Contratos y validaciones Pydantic
  app/seed.py       Catálogo ficticio idempotente
  migrations/       Migración Alembic versionada
  tests/            Casos funcionales con PostgreSQL
frontend/
  src/components/   Navegación, formularios y estados reutilizables
  src/pages/        Pantallas reales del propietario
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
- Las consultas nuevas se guardan como `Pendiente`; el propietario puede cancelarlas. No se confirma disponibilidad, no se reservan cupos y no hay pagos. El horario de la clínica se muestra como información; no es un motor de disponibilidad.
- El catálogo, direcciones, teléfonos y precios son **ficticios**. Las solicitudes no se envían a clínicas reales.
- Fotos de mascotas, historial clínico, vacunas, alertas, recuperación de contraseña, verificación de correo, administración, pagos, mapas y panel médico no forman parte de esta entrega. Se documentan en el backlog; no hay botones falsos.
- Para un despliegue público se requiere HTTPS, `COOKIE_SECURE=true`, dominio exacto en CORS, secretos nuevos, copias de seguridad y una revisión de seguridad. El sprint no incorpora limitación de intentos distribuida ni autenticación multifactor.

Ver [decisiones del modelo](docs/architecture.md), [contratos REST](docs/api.md), [Sprint 1](docs/sprint-1.md) y [verificación real](docs/verification.md).

## Recursos visuales y referencias

Foto “Real life best friends”, Krista Mangulsone, publicada originalmente en Unsplash en 2015; [Wikimedia documenta CC0](https://commons.wikimedia.org/wiki/File:Real_life_best_friends_(Unsplash).jpg). Se usa el recurso remoto de Unsplash, por lo que la fotografía requiere conexión; el contenido y los formularios siguen siendo utilizables si no carga.

Referencias de implementación: [FastAPI: JWT y hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) y [Vite: requisitos de ejecución](https://vite.dev/guide/).
