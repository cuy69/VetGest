# Perfiles y permisos

VetGest es una plataforma **multi-clínica**. El avance 2 (PDF) se tomó como referencia y se ajustó: los actores del diagrama de casos de uso se convirtieron en cinco perfiles con permisos verificados en el backend, no solo ocultos en la interfaz.

| Perfil | Cómo se crea | Qué puede hacer | Qué no puede hacer |
|---|---|---|---|
| **Propietario** | Registro público (web o app móvil) | Mascotas, solicitar un turno libre o cancelar citas, ver el estado de la cita en vivo y si está pagada, historial clínico y recordatorios de sus mascotas, catálogo. Único perfil que entra a la **app móvil** | Ver datos de otros propietarios o entrar al espacio de clínica; cancelar después de llegar |
| **Recepción** | Lo crea el administrador de su clínica | Agenda de su clínica: confirmar, asignar veterinario, reprogramar, cancelar, marcar inasistencia, notas internas; **registrar la llegada** (sala de espera); **caja**: cobrar citas atendidas (Efectivo, Yape, Tarjeta) y ver cobros del día; ver pacientes, historial e inventario | Registrar atenciones, vacunas o tratamientos; anular cobros; ver reportes de ingresos; gestionar equipo, servicios o inventario |
| **Veterinario** | Lo crea el administrador de su clínica | Ver agenda (filtro «mis citas»), fichas e historial; **iniciar la consulta** de sus pacientes que ya llegaron; registrar atenciones con vacunas, desparasitaciones y tratamientos, eligiendo el producto del inventario que se descuenta | Cambiar estados de la agenda; cobrar; gestionar equipo, servicios o inventario |
| **Administrador de clínica** | Lo crea el admin de plataforma al dar de alta la clínica (o otro admin de la clínica) | Todo lo de recepción y veterinario + equipo (altas, rol, desactivar), servicios (crear, editar, retirar), datos públicos y **horario** de la clínica, **inventario** (productos, ingresos, ajustes, movimientos), **anular cobros** y **reportes de ingresos** | Modificar su propio rol o desactivarse (evita dejar la clínica sin administrador) |
| **Admin de plataforma** | Variable `BOOTSTRAP_ADMIN_*` al arrancar | Métricas globales, alta de clínicas con su primer administrador, suspender/reactivar clínicas | Ver historias clínicas o la agenda de una clínica |

## Reglas de negocio

- **Una clínica por cuenta de personal.** Simplifica permisos; una persona que trabaje en dos clínicas usa dos correos.
- **Contraseñas temporales.** Toda cuenta creada por un administrador debe cambiar su contraseña en el primer ingreso; la interfaz bloquea el resto hasta hacerlo. Cambiar la contraseña cierra las demás sesiones.
- **Acceso a pacientes.** Una clínica ve a una mascota desde que el propietario solicita una cita con ella o desde que la atiende. Ve **el historial completo** (todas las clínicas): es la continuidad de atención que justifica la plataforma (NG01, NG03). El propietario lo autoriza implícitamente al solicitar la cita; ver «Riesgos».
- **Ciclo de una cita:** `Pendiente → Confirmada → Atendida`; `Pendiente/Confirmada → Cancelada`; `Confirmada → No asistió` (solo después de la hora). `Atendida` solo se alcanza registrando la atención, así no hay citas «atendidas» sin historia clínica.
- **Sala de espera sin estados nuevos.** «Llegó» (`arrived_at`, recepción) y «En consulta» (`started_at`, veterinario asignado o admin) son marcas de tiempo de una cita `Confirmada`; la cita sigue siendo `Confirmada` hasta que se registra la atención. Iniciar la consulta no es un cambio de estado de agenda. Tras la llegada no se puede marcar inasistencia, reprogramar ni (el propietario) cancelar.
- **Horarios disponibles.** Turnos de 30 minutos dentro del horario estructurado de la veterinaria (`opens_at`, `closes_at`, `open_days`). Un turno se llena cuando las citas pendientes o confirmadas que se cruzan con él igualan a los veterinarios activos; un veterinario no puede tener dos citas que se crucen. Se valida al solicitar, confirmar, asignar y reprogramar, con bloqueo por veterinaria para evitar dobles reservas simultáneas.
- **Caja.** Solo se cobran citas `Atendida`, una vez. El monto parte del precio del servicio y recepción puede ajustarlo (p. ej. según la vacuna). Los cobros no se editan ni se borran: el administrador los anula con motivo y se puede volver a cobrar.
- **Inventario.** El stock cambia solo con movimientos (ingreso, ajuste o uso en atención), todos registrados con su autor. Usar un producto en un cuidado descuenta una unidad; con stock 0 se rechaza.
- **Historia clínica inmutable.** Atenciones y vacunas no se editan ni se borran; quedan firmadas por el veterinario y la clínica (trazabilidad). Una corrección se registra como nueva atención.
- **Recordatorios.** Se calculan a partir de la próxima dosis (vacunas, desparasitación, tratamiento), el próximo control de la última atención y las citas de los próximos 30 días. Una dosis más reciente del mismo producto reemplaza el recordatorio anterior.
- **Suspensión de clínica.** Cierra de inmediato las sesiones de su equipo y la oculta del catálogo; conserva el historial.
- **Servicios retirados** no se ofrecen, pero se mantienen en citas antiguas.

## Riesgos y pendientes

- **Consentimiento explícito** para compartir historial entre clínicas (hoy es implícito al reservar). Recomendado antes de producción real; requiere una tabla de consentimientos.
- **Recordatorios por correo/WhatsApp:** hoy se muestran en el panel del propietario. Enviar notificaciones requiere un proveedor externo y una tarea programada.
- **Atención sin cita (walk-in):** recepción no puede crear propietarios. Hoy el propietario debe registrarse y solicitar la cita (puede hacerlo en recepción desde la app).
- **Horario simple:** una sola franja por día y los mismos días toda la semana (no hay medio día los sábados, feriados ni turnos por veterinario).
- **Caja sin comprobante electrónico:** el cobro registra el ingreso, pero no emite boleta ni factura SUNAT.
- **Estado en vivo por consulta periódica** (cada 30 s), no por notificaciones push.
- **Recuperación de contraseña** por correo: pendiente (requiere proveedor de correo). Hoy un administrador puede desactivar y recrear la cuenta.
