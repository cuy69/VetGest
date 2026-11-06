# Despliegue: Supabase + Render + Vercel (+ app Expo)

| Pieza | Servicio | Qué corre | Configuración |
|---|---|---|---|
| Base de datos | **Supabase** (proyecto «Veterinaria», `us-east-2`) | Solo PostgreSQL gestionado. Sin Supabase Auth ni Data API | `DATABASE_URL` en Render |
| API | **Render** (`vetgest-api`, Docker, plan gratuito, región Ohio) | FastAPI. Al arrancar aplica migraciones, bloquea la Data API y crea el admin de arranque | [`render.yaml`](../render.yaml) |
| Web | **Vercel** (carpeta `frontend/`) | Sitio estático de Vite. `/api/*` se reenvía a Render, así la cookie de sesión es del mismo origen | [`frontend/vercel.json`](../frontend/vercel.json) |
| App móvil | **Expo** (carpeta `mobile/`) | App de propietarios. Llama directo a la API de Render con token Bearer | `EXPO_PUBLIC_API_URL` |

Los secretos se cargan en los paneles de Render y Vercel. Nunca se versionan.

## Orden recomendado

1. Subir la rama a GitHub (Render y Vercel despliegan desde GitHub).
2. Supabase: copiar la URL del *Session pooler*.
3. Render: crear la API con el Blueprint y pegar los secretos.
4. Vercel: importar el repositorio con raíz `frontend/`.
5. Volver a Render y poner en `CORS_ORIGINS` el dominio exacto que dio Vercel.
6. App: apuntar `EXPO_PUBLIC_API_URL` a la API de Render.

## 1. Supabase

1. En el proyecto «Veterinaria», ve a **Connect → Session pooler** y copia la URL (puerto **5432**). Usa el *pooler*, no la conexión directa: la directa es solo IPv6 y Render no la alcanza en el plan gratuito. No uses el *transaction pooler* (6543): rompe las sentencias preparadas de psycopg.
2. Sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos. El backend acepta `postgresql://…` y añade el driver automáticamente.
3. No necesitas la URL pública de Supabase ni la clave *publishable*: VetGest no habla con Supabase desde el navegador.

> **Seguridad.** Supabase publica el esquema `public` en su Data API con claves públicas. En cada arranque la API activa RLS sin políticas y revoca los permisos de `anon` y `authenticated` (`lock_down_data_api` en `app/seed.py`). Después del primer arranque, verifica en **Table Editor** que todas las tablas muestran «RLS enabled». Opcional: desactiva la Data API en **Settings → API**.

## 2. Render (API)

1. **New → Blueprint** → elige el repositorio y la rama. Solo crea `vetgest-api`.
2. Completa las variables `sync: false`:
   - `DATABASE_URL`: la URL del paso 1.
   - `CORS_ORIGINS`: de momento `["https://vetgest.vercel.app"]`; se corrige en el paso 5 con el dominio real, sin barra final.
   - `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`: el primer administrador de plataforma. Contraseña de al menos 12 caracteres; se pide cambiarla al ingresar. El correo necesita un dominio real (no `.local`).
3. Espera el primer despliegue y abre `https://<api>.onrender.com/api/health` → `{"status":"ok","database":"postgresql"}`.
4. Si Render asigna un dominio distinto de `vetgest-api.onrender.com`, cámbialo en el `destination` de `/api/:path*` en `frontend/vercel.json`.

`SEED_DEMO_CATALOG` está en `false`: en producción no se cargan las veterinarias ficticias. Ponlo en `true` solo para una demo.

## 3. Vercel (web)

1. **Add New → Project** → importa `cuy69/VetGest` y elige la rama.
2. **Root Directory**: `frontend`. Vercel lee `vercel.json` (Vite, pnpm, `dist`). No hacen falta variables de entorno.
3. Despliega y copia el dominio de producción (p. ej. `https://vetgest.vercel.app`).
4. En Render, pon ese dominio en `CORS_ORIGINS` y guarda (la API se reinicia).

Notas:

- La API rechaza escrituras con cookie desde un origen que no esté en `CORS_ORIGINS`. Los despliegues de **vista previa** de Vercel tienen otro dominio: para probarlos agrega también ese dominio o usa solo el de producción.
- `vercel.json` aplica a las páginas las mismas cabeceras de seguridad que Nginx (CSP, `X-Frame-Options`, `nosniff`). Las respuestas de `/api` llevan las de la API, así Swagger (`/api/docs`) sigue funcionando.

## 4. App móvil (Expo)

Ver [`mobile/README.md`](../mobile/README.md).

- `EXPO_PUBLIC_API_URL=https://<api>.onrender.com/api` en `mobile/.env`.
- La app usa `POST /api/auth/token` y guarda el token en el almacenamiento seguro del teléfono. No necesita CORS: una app nativa no envía `Origin`.
- Para repartirla sin tienda: APK de Android con EAS Build (perfil `preview`, plan gratuito de Expo). En iPhone se prueba con Expo Go; publicarla en App Store requiere una cuenta de Apple Developer (de pago).

## 5. Verificación después de desplegar

1. `https://<web>/api/health` responde `ok` a través de Vercel.
2. Inicia sesión con el admin de arranque, cambia la contraseña y da de alta una veterinaria con su horario.
3. Como administrador de esa veterinaria: crea un veterinario y un recepcionista, publica servicios y registra productos de inventario.
4. Registra un propietario (web o app), solicita un turno libre, confírmalo desde recepción, registra la llegada, inicia la consulta, registra la atención con una vacuna del inventario y cobra la cita.
5. **Recarga la web y comprueba que la sesión se mantiene.** Si el login responde 200 pero `/api/auth/me` devuelve 401, la cookie no está pasando por el rewrite: revisa `CORS_ORIGINS` y que el dominio de la API en `vercel.json` sea el correcto.

## Limitaciones del plan gratuito

- Render suspende la API tras ~15 minutos sin tráfico; la primera petición tarda ~1 minuto. Para una demostración, abre `/api/health` unos minutos antes.
- Supabase pausa proyectos inactivos una semana. Antes de cargar datos reales activa el respaldo diario cifrado y el usuario `vetgest_app` de permisos mínimos: [administracion-bd.md](administracion-bd.md). El respaldo diario también evita la pausa.
- Vercel Hobby es para uso no comercial; para una veterinaria real que cobre por el servicio corresponde el plan Pro.
