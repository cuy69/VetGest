# Administración de la base de datos

Cómo se integra, diseña, protege, respalda y replica la base de datos de VetGest. El modelo de datos está en [database.md](database.md) y el despliegue en [deploy.md](deploy.md).

## 1. Integración con la base de datos

| Aspecto | Implementación | Evidencia |
|---|---|---|
| Motor | PostgreSQL 17 gestionado por Supabase (proyecto «Veterinaria», `us-east-2`). Se usa **solo como PostgreSQL**: sin Supabase Auth ni Data API | [deploy.md](deploy.md) |
| Conexión | La API (FastAPI) usa SQLAlchemy 2 + psycopg 3 por el *Session pooler* (IPv4, puerto 5432). `pool_pre_ping` descarta conexiones caídas | `backend/app/core/database.py` |
| Sesiones | Una sesión por petición (`get_db`); cada caso de uso confirma o revierte su transacción completa | `backend/app/domains/*` |
| Esquema | Versionado con Alembic: `0001_sprint_one` → `0002_roles_and_clinical` → `0003_operations`. Se aplica al arrancar la API | `backend/migrations/versions/` |
| Concurrencia | `pg_advisory_xact_lock` por veterinaria al reservar turnos: dos recepcionistas no pueden ocupar el mismo horario | `backend/app/domains/scheduling.py` |
| Errores | Un fallo de PostgreSQL devuelve 503 sin SQL ni parámetros | `backend/app/main.py` |
| Pruebas | 46 pruebas de pytest contra una base PostgreSQL real, cada una dentro de una transacción que se revierte | `backend/tests/` |

## 2. Recomendaciones de diseño e implementación aplicadas

1. **Normalización (3FN).** Credenciales (`users`) separadas de datos personales (`profiles`); el rol del personal en `clinic_members`; catálogo por veterinaria en `veterinary_services`.
2. **La base valida, no solo la API.** Claves foráneas compuestas (una cita no puede usar la mascota de otro dueño ni el servicio de otra veterinaria), `CHECK` en estados, precios, pesos, horarios y stock, y un índice único parcial para un solo cobro válido por cita.
3. **Nada clínico se borra.** `ON DELETE RESTRICT` en todas las relaciones, baja lógica de mascotas (`deleted_at`), cobros que solo se anulan con motivo y responsable, inventario con movimientos inmutables.
4. **Tiempo con zona horaria.** Fechas en `timestamptz`; la agenda trabaja en hora de Lima.
5. **Índices según las consultas reales:** agenda (`clinic_id, starts_at`), citas del propietario (`owner_id, status, starts_at`), recordatorios (`pet_id, next_due_on`).
6. **Auditoría básica.** `created_at`/`updated_at` en todas las tablas, mantenidos por el trigger `vetgest_touch_updated_at` aunque se actualice fuera del ORM; `received_by_id`/`voided_by_id` en cobros.
7. **Migraciones como única vía de cambio.** Una migración aplicada no se edita; se crea otra. `alembic check` debe salir sin diferencias y cada migración se prueba con `downgrade` y `upgrade`.

## 3. Usuarios y privilegios (mínimo privilegio)

| Rol | Para qué | Permisos |
|---|---|---|
| `postgres` (dueño) | Migraciones, `app.seed` y respaldos | Dueño del esquema `public` |
| `vetgest_app` | La API en funcionamiento | `SELECT`, `INSERT`, `UPDATE`. **Sin** `DELETE`, `TRUNCATE` ni DDL. Política RLS `vetgest_app_access` por tabla. No puede tocar `alembic_version` |
| `anon`, `authenticated` (Supabase) | Data API pública | Ninguno: RLS activo sin políticas y permisos revocados |

Si la API fuera comprometida con `vetgest_app`, no podría borrar ni vaciar tablas, ni cambiar el esquema. Los permisos se aplican solos en cada arranque (`grant_app_role` en `backend/app/seed.py`), también para tablas de migraciones futuras.

Verificado en local (06/11/2026): las pruebas de la API pasan conectadas como `vetgest_app` con RLS activo (44 de 45; la restante crea roles de Supabase y por diseño necesita al dueño), y `DELETE`, `TRUNCATE`, `DROP TABLE`, `CREATE TABLE` y cambios en `alembic_version` son rechazados. La prueba `test_app_role_reads_and_writes_but_cannot_delete_or_alter` lo repite en cada ejecución.

### Activarlo en producción

Lo hace quien administra Supabase y Render. Las contraseñas no se escriben en el repositorio.

1. Supabase → **SQL Editor**, ejecutar con una contraseña larga y nueva:
   ```sql
   CREATE ROLE vetgest_app LOGIN PASSWORD 'contraseña-larga-nueva';
   ```
2. Render → `vetgest-api` → **Environment**:
   - `MIGRATION_DATABASE_URL` = la `DATABASE_URL` actual (usuario `postgres.vddpluoapopcdavzhkqz`).
   - `DATABASE_URL` = la misma URL cambiando el usuario por `vetgest_app.vddpluoapopcdavzhkqz` y la contraseña por la del paso 1.
3. Guardar y desplegar. En el log debe aparecer «Permisos mínimos aplicados a vetgest_app.» y `/api/health` debe responder `ok`.
4. Para volver atrás: borrar `MIGRATION_DATABASE_URL` y devolver `DATABASE_URL` a la URL de `postgres`.

## 4. Respaldos

| Parámetro | Valor |
|---|---|
| Herramienta | GitHub Actions: [`.github/workflows/respaldo-bd.yml`](../.github/workflows/respaldo-bd.yml) |
| Frecuencia | Diaria, 03:00 hora de Lima, y manual con **Run workflow** |
| Contenido | Esquema `public` completo (datos, índices, restricciones, triggers y políticas) con `pg_dump` 17 en formato *custom* |
| Verificación | `pg_restore --list` comprueba que el archivo es legible antes de guardarlo; se publica su SHA-256 |
| Cifrado | GPG simétrico AES-256 con la frase `BACKUP_PASSPHRASE`. El archivo sin cifrar se borra con `shred` |
| Retención | 7 días como *artifact* de GitHub |
| RPO (datos que se pueden perder) | Hasta 24 horas |
| RTO (tiempo para volver a operar) | ~30 minutos: crear una base vacía, restaurar y cambiar `DATABASE_URL` en Render |

El cifrado es obligatorio porque el respaldo contiene datos personales y hashes de contraseñas, y en un repositorio público los *artifacts* los puede descargar cualquier usuario de GitHub. La consulta diaria también evita que Supabase pause el proyecto por inactividad.

### Activar los respaldos

1. En el repositorio que despliega (`Aldairz16/VetGest`): **Settings → Secrets and variables → Actions → New repository secret**:
   - `BACKUP_DATABASE_URL`: la URL del *Session pooler* con el usuario `postgres`.
   - `BACKUP_PASSPHRASE`: una frase larga. Guárdala también fuera de GitHub (por ejemplo en un gestor de contraseñas): sin ella el respaldo no se puede abrir.
2. **Actions** → habilitar los workflows del fork si GitHub lo pide → «Respaldo de base de datos» → **Run workflow**.
3. Debe terminar en verde y dejar un *artifact* `vetgest-AAAAMMDD-HHMM`. Sin secretos, el workflow termina con un aviso y no hace nada.

### Restaurar

```bash
scripts/restaurar-respaldo.sh vetgest-AAAAMMDD-HHMM.dump.gpg
```

El script comprueba el SHA-256, pide la frase y la URL de destino sin mostrarlas, descifra en una carpeta temporal y restaura con `pg_restore`. **Siempre en una base vacía** (un proyecto Supabase nuevo o un PostgreSQL local), nunca sobre la base en uso. Para una base en la propia Mac se usa `host.docker.internal` en lugar de `localhost`.

Verificado en local (06/11/2026): respaldo → cifrado → restauración en un servidor PostgreSQL 17 nuevo, con los mismos conteos en las 13 tablas, las 12 políticas RLS y los 12 triggers; una frase incorrecta es rechazada.

**Prueba de restauración:** una vez al mes, restaurar el último respaldo en una base local y comparar conteos. Un respaldo que nunca se restauró no cuenta como respaldo.

## 5. Replicación

| Tipo | Qué es | Situación en VetGest |
|---|---|---|
| Física (*streaming*) | Copia exacta del almacenamiento en otro servidor, en tiempo real. Sirve para alta disponibilidad y réplicas de lectura | La gestiona Supabase en su infraestructura. Las **réplicas de lectura** son de pago (plan Pro), por eso no se usan |
| Lógica (*publication/subscription*) | Envía los cambios fila por fila a otra base PostgreSQL, que puede estar en otro proveedor | Opcional, ver abajo. No activada |
| Lógica por volcado (réplica en frío) | Copia completa periódica que se puede levantar en otro servidor | **Implementada**: el respaldo diario cifrado (sección 4) |

**Decisión.** Con una sola veterinaria piloto y plan gratuito, el volcado diario cubre la recuperación ante desastres (RPO 24 h) sin costo. La replicación en tiempo real se justifica cuando haya varias veterinarias operando o haga falta un RPO de minutos.

**Replicación lógica opcional** hacia una segunda base PostgreSQL 17 (otro proyecto gratuito):

1. En el destino, crear el esquema restaurando un respaldo sin datos o aplicando las migraciones.
2. En Supabase (origen), SQL Editor:
   ```sql
   CREATE PUBLICATION vetgest_pub FOR TABLES IN SCHEMA public;
   ```
3. En el destino:
   ```sql
   CREATE SUBSCRIPTION vetgest_sub
     CONNECTION 'host=<host directo de Supabase> port=5432 dbname=postgres user=postgres password=<contraseña>'
     PUBLICATION vetgest_pub;
   ```
   La conexión directa de Supabase es solo IPv6 (el *pooler* no admite replicación): el destino debe tener IPv6.
4. Vigilar `pg_stat_subscription` en el destino. Los cambios de esquema no se replican: cada migración se aplica también en la réplica.

## 6. Monitoreo y mantenimiento

| Tarea | Frecuencia | Dónde |
|---|---|---|
| Salud de la API y la base | Continua | `GET /api/health` (Render lo usa como *health check*) |
| Errores de la API | Semanal | Render → Logs (los errores de base solo muestran el tipo de excepción) |
| Asesores de seguridad y rendimiento | Mensual | Supabase → **Advisors** (Security y Performance) |
| Uso de disco y conexiones | Mensual | Supabase → **Reports**. Plan gratuito: 500 MB |
| Consultas lentas | Antes de cada entrega | Supabase → Query Performance. Crear índices solo para consultas medidas |
| Respaldo del día | Diaria | GitHub → Actions: el último «Respaldo de base de datos» debe estar en verde |
| Prueba de restauración | Mensual | `scripts/restaurar-respaldo.sh` en una base local |
| `VACUUM` / `ANALYZE` | Automático | Autovacuum de PostgreSQL, gestionado por Supabase |

## 7. Lista de control antes de cargar datos reales

- [ ] `vetgest_app` activo en producción (sección 3).
- [ ] Respaldo diario en verde y una restauración probada (sección 4).
- [ ] Supabase → Table Editor: todas las tablas con «RLS enabled».
- [ ] Data API desactivada en Supabase → Settings → API (opcional; ya está bloqueada).
- [ ] Contraseña de la base de datos de Supabase cambiada si alguna vez se compartió.
