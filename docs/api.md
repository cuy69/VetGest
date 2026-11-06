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

La web no guarda el token en localStorage ni lo pone en la URL: usa la cookie `vetgest_session`. La app móvil usa la cabecera Bearer (ver «Ampliación» más abajo). Para clientes HTTP usa un cookie jar tras iniciar sesión. Swagger conserva la cookie de su mismo origen; no es necesario copiar un token en Authorize.

---

# Ampliación: app móvil, horarios, sala de espera, caja e inventario

Rama `feature/despliegue-y-app` (noviembre de 2026). Todo lo de arriba sigue vigente; esta sección agrega o cambia lo siguiente. Fechas y horas siempre en `America/Lima` (`-05:00`).

## Sesión para la app móvil (token Bearer)

| Método | Ruta | Quién | Resultado |
|---|---|---|---|
| POST | `/auth/token` | Público | 200 `{access_token, token_type: "bearer", expires_in, user}`. Solo cuentas de **propietario**; el personal recibe 403 («La app es para propietarios. El personal entra desde la web.»). No establece cookie |

- Todo endpoint privado acepta la cookie `vetgest_session` **o** la cabecera `Authorization: Bearer <access_token>`. Si llegan ambas, manda la cabecera.
- El token móvil dura `MOBILE_TOKEN_DAYS` días (30 por defecto). `POST /auth/logout` y el cambio de contraseña lo revocan (misma `token_version`).
- La app guarda el token en `expo-secure-store`, nunca en almacenamiento plano.

## Horario de la veterinaria y disponibilidad

`ClinicOut` (catálogo, detalle y panel) agrega `opens_at` (`"08:00"`), `closes_at` (`"20:00"`) y `open_days` (lista de días ISO, `1` = lunes … `7` = domingo). `opening_hours` sigue como texto informativo. `ClinicInput` (datos de la veterinaria y alta desde la plataforma) acepta esos tres campos; si se omiten se usan 09:00, 18:00 y lunes a sábado.

| Método | Ruta | Quién | Resultado |
|---|---|---|---|
| GET | `/clinics/{id}/availability?service_id=&date=AAAA-MM-DD` | Sesión | 200 `{date, slots: [{starts_at, available}]}` |
| GET | `/clinic/availability?service_id=&date=&vet_id=&exclude_appointment_id=` | Personal | Igual, para reprogramar o confirmar con un veterinario concreto |

- Turnos cada 30 minutos dentro del horario; la cita debe terminar (inicio + duración del servicio) antes del cierre.
- Un turno no está disponible si ya pasó, si el día está cerrado o si las citas que se cruzan con él (estados `Pendiente` y `Confirmada`) igualan el número de veterinarios activos de la clínica (rol `vet` o `admin`). Con `vet_id`, basta con que ese veterinario tenga un cruce.
- `POST /appointments` responde **422** si el horario está fuera de atención y **409** «Ese horario ya no está disponible. Elige otro.» si se ocupó.
- `PATCH /clinic/appointments/{id}` responde **409** al confirmar o asignar un veterinario que ya tiene otra cita que se cruza, y al reprogramar a un turno ocupado.

## Sala de espera (sin estados nuevos)

El ciclo `Pendiente → Confirmada → Atendida` no cambia. La llegada y el inicio de la consulta son marcas de tiempo de una cita `Confirmada`:

| Método | Ruta | Quién | Resultado |
|---|---|---|---|
| POST | `/clinic/appointments/{id}/arrival` | Recepción o admin | 200: guarda `arrived_at`. 409 si no está `Confirmada`, no es de hoy o ya llegó |
| POST | `/clinic/appointments/{id}/start` | Veterinario asignado o admin | 200: guarda `started_at`. 409 si no llegó o ya empezó; 403 si la cita es de otro veterinario |

`AppointmentOut` y `ClinicAppointmentOut` agregan `arrived_at`, `started_at`, `stage` y `payment`:

- `stage`: `"Por confirmar"` (Pendiente), `"Confirmada"`, `"En sala de espera"` (llegó), `"En consulta"` (empezó), `"Atendida"`, `"Cancelada"`, `"No asistió"`.
- No se puede marcar «No asistió» si el paciente llegó (409). El propietario no puede cancelar después de llegar (409).
- La app y la web del propietario consultan la cita cada 30 s para mostrar el estado en vivo.
- `GET /clinic/summary` agrega `waiting` (en sala de espera hoy) e `in_consult` (en consulta hoy).

## Caja y cobros

`payment` en las citas: `null` o `{id, amount, method, paid_at}` del cobro vigente (no anulado).

| Método | Ruta | Quién | Resultado |
|---|---|---|---|
| GET | `/clinic/payments/pending` | Recepción o admin | 200: citas `Atendida` sin cobro vigente (`ClinicAppointmentOut`) |
| GET | `/clinic/payments?date_from=&date_to=` | Recepción o admin | 200: cobros del rango (por defecto, hoy) |
| POST | `/clinic/payments` | Recepción o admin | 201 `{appointment_id, amount, method, notes}`; `method`: `Efectivo`, `Yape` o `Tarjeta`. 409 si la cita no está atendida o ya tiene cobro |
| POST | `/clinic/payments/{id}/void` | Admin | 200 `{reason}`: anula el cobro (no se borra). Luego se puede volver a cobrar |
| GET | `/clinic/reports/income?date_from=&date_to=` | Admin | 200 `{date_from, date_to, total, count, average_ticket, by_method, by_day, by_service, pending, appointments}` (por defecto, últimos 30 días). `appointments` cuenta las citas del periodo por estado (sirve para la tasa de inasistencia) |

`PaymentOut`: `{id, appointment_id, amount, method, notes, paid_at, received_by, pet_name, owner_name, service_name, voided_at, void_reason}`. Los cobros no se editan; se anulan con motivo.

## Inventario

| Método | Ruta | Quién | Resultado |
|---|---|---|---|
| GET | `/clinic/inventory` | Personal | 200: productos de la clínica con `low_stock` (`stock <= min_stock`) |
| POST | `/clinic/inventory` | Admin | 201 `{name, category, unit, min_stock, initial_stock}`; `category`: `Vacuna`, `Antiparasitario`, `Medicamento` o `Insumo` |
| PUT | `/clinic/inventory/{id}` | Admin | 200 `{name, category, unit, min_stock, is_active}` (el stock solo cambia con movimientos) |
| POST | `/clinic/inventory/{id}/movements` | Admin | 201 `{kind, quantity, notes}`; `kind`: `Ingreso` (cantidad > 0) o `Ajuste` (distinta de 0, puede ser negativa). Devuelve el producto actualizado. 409 si el stock quedaría negativo |
| GET | `/clinic/inventory/{id}/movements` | Admin | 200: historial de movimientos, el más reciente primero |

- `CareInput` (al registrar atención o cuidado) acepta `inventory_item_id`. Descuenta 1 unidad y crea un movimiento `Uso en atención` enlazado al cuidado. 409 «No queda stock de …» si está en 0; 422 si el producto no es de la clínica o está inactivo.
- `InventoryItemOut`: `{id, name, category, unit, stock, min_stock, is_active, low_stock}`. `MovementOut`: `{id, kind, quantity, notes, created_at, user, care_event_id}`.
