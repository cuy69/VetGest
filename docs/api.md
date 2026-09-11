# API REST del propietario

Prefijo `/api`. JSON de entrada y salida. Swagger: `/api/docs`. OpenAPI: `/api/openapi.json`.

## Endpoints

| Método | Ruta | Sesión | Resultado |
|---|---|---|---|
| POST | `/auth/register` | No | 201: usuario y perfil; no inicia sesión |
| POST | `/auth/login` | No | 200: usuario; establece cookie JWT |
| GET | `/auth/me` | Sí | 200: usuario y perfil |
| PATCH | `/auth/profile` | Sí | 200: nombres, apellidos y teléfono actualizados |
| POST | `/auth/logout` | Sí | 204: invalida sesiones y borra cookie |
| GET | `/pets` | Sí | 200: mascotas activas del propietario |
| POST | `/pets` | Sí | 201: mascota creada |
| GET | `/pets/{id}` | Sí | 200: detalle propio |
| PUT | `/pets/{id}` | Sí | 200: reemplaza datos editables |
| DELETE | `/pets/{id}` | Sí | 204: baja lógica; 409 con citas pendientes |
| GET | `/clinics?search=nombre` | Sí | 200: catálogo filtrado por nombre |
| GET | `/clinics/{id}` | Sí | 200: detalle de clínica |
| GET | `/services?clinic_id=1` | Sí | 200: todos o filtrados por clínica |
| POST | `/appointments` | Sí | 201: solicitud pendiente |
| GET | `/appointments` | Sí | 200: citas propias, fecha descendente |
| GET | `/appointments/{id}` | Sí | 200: detalle propio con mascota, clínica y servicio |
| PATCH | `/appointments/{id}/cancel` | Sí | 200: cita cancelada; 409 si ya se canceló |
| GET | `/health` | No | 200 si PostgreSQL responde; 503 ante fallo |

## Ejemplos de cuerpos

Registro:

```json
{
  "first_name": "Ana", "last_name": "Torres",
  "email": "ana@example.com", "phone": "987654321",
  "password": "una-clave-personal-larga", "password_confirmation": "una-clave-personal-larga"
}
```

Mascota (propietario derivado de la sesión):

```json
{
  "name": "Luna", "species": "Gato", "breed": "Mestizo", "sex": "Hembra",
  "birth_date": "2022-03-12", "weight": 4.5, "color": "Gris", "notes": "Es tranquila."
}
```

Cita (usa IDs reales de tu mascota y del catálogo; fecha futura):

```json
{
  "pet_id": 1, "clinic_id": 1, "service_id": 1,
  "starts_at": "2099-01-10T10:00:00-05:00", "reason": "Control preventivo"
}
```

Los IDs de ejemplo no garantizan pertenencia ni existencia. El servidor verifica las relaciones y rechaza campos adicionales como `owner_id` o `status`. Los comentarios son opcionales, con máximo 2000 caracteres.

## Errores

```json
{"error":{"code":"404","message":"No encontramos esa mascota."}}
```

Validación:

```json
{"error":{"code":"validation_error","message":"Revisa los campos obligatorios y los valores ingresados.","fields":[{"field":"email","type":"value_error"}]}}
```

401 para sesión ausente, inválida, expirada o revocada; 403 para origen no permitido; 404 para recurso inexistente o ajeno; 409 para duplicados/transición inválida/eliminación bloqueada; 422 para contrato o valores inválidos; 503 para indisponibilidad de la base. Nunca se incluyen los valores originales de los campos inválidos.

La API no acepta el token en localStorage ni en un parámetro de URL: usa la cookie `vetgest_session`. Para clientes HTTP usa un cookie jar tras iniciar sesión. Swagger conserva la cookie de su mismo origen; no es necesario copiar un token en Authorize.
