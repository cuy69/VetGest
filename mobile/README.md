# VetGest · App de propietarios (Expo)

App móvil **solo para propietarios de mascotas**. Consume la API FastAPI de `backend/` con un token Bearer (`POST /auth/token`); el personal de las veterinarias usa la web. Expo SDK 58 · expo-router · TypeScript. Diseño según `design-system/vetgest/MASTER.md` y `pages/app-propietario.md`.

## Requisitos

- Node 22 o superior y npm. Este proyecto es independiente: `npm` se ejecuta dentro de `mobile/` (no es parte de ningún workspace).
- La API de VetGest corriendo (local o en Render).

```bash
cd mobile
npm install
cp .env.example .env.local   # ajusta EXPO_PUBLIC_API_URL
```

## Variable de entorno

`EXPO_PUBLIC_API_URL` es la base de la API, con el prefijo `/api` (por defecto `http://localhost:8000/api`). Expo la inserta al compilar: reinicia `npx expo start` tras cambiarla. Ejemplos en `.env.example` (simulador, emulador Android `10.0.2.2`, celular por IP de la Mac en la misma wifi, Render).

## Correr la app

| Dónde | Cómo |
|---|---|
| Celular con **Expo Go** | `npx expo start` y escanea el QR (Android: con Expo Go; iPhone: con la cámara). Usa la IP de tu Mac en `EXPO_PUBLIC_API_URL`, no `localhost` |
| **Simulador iOS** (requiere Xcode) | `npx expo start --ios` |
| **Web** | `npx expo start --web`. El token vive solo en memoria: al recargar hay que ingresar de nuevo. La API debe permitir el origen `http://localhost:8081` (CORS) |

Si `npm install` falla por certificados (proxy Fortinet), usa `npm install --registry=https://registry.yarnpkg.com/`.

## Verificaciones

```bash
npx tsc --noEmit        # tipos
npm test                # jest-expo: cliente API, selector de turnos, formatos y estados
npx expo-doctor         # dependencias y configuración
npx expo export --platform web
```

## APK de prueba con EAS Build (perfil `preview`)

No se ejecuta desde este repo; requiere una cuenta de Expo propia.

1. En `eas.json`, perfil `preview`, cambia `EXPO_PUBLIC_API_URL` por la URL pública del backend (por ejemplo, la de Render).
2. `npx eas-cli@latest login` y luego `npx eas-cli@latest build:configure` (la primera vez; asocia el proyecto).
3. `npx eas-cli@latest build --platform android --profile preview` → al terminar, EAS da un enlace para descargar el `.apk` e instalarlo en el celular.

El identificador Android/iOS es `com.vetgest.mobile` (en `app.json`); cámbialo si se publicará con otro.

## Estructura

```
src/app/            rutas (expo-router)
  (tabs)/           Inicio · Citas · Mascotas · Perfil
  citas/nueva.tsx   Pedir turno (4 pasos)   citas/[id].tsx  detalle y cancelación
  mascotas/…        alta, detalle (historia y carnet), edición
  veterinarias.tsx, veterinaria/[id].tsx    catálogo y servicios
  ingresar.tsx, registro.tsx
src/components/     UI accesible (ui.tsx), selector de días y turnos, iconos Lucide
src/lib/prefs.tsx   preferencias de accesibilidad (tema, tamaño, contraste, negrita, espaciado, animaciones)
assets/icon-source/ fuente del ícono de la app (regenera los PNG de assets/images)
src/lib/            cliente API, sesión, consultas, validaciones (copiadas de la web), formatos
__tests__/          pruebas jest-expo
```
