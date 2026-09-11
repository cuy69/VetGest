# Sprint 1 · VetGest

## Objetivo y duración

En **dos semanas (10 días hábiles)** entregar un flujo integrado para que un propietario cree una cuenta, gestione sus datos y mascotas, consulte veterinarias y servicios, y solicite o cancele una cita utilizando PostgreSQL.

El estado de implementación y la evidencia están en [verification.md](verification.md). La definición de terminado todavía no se cumple mientras falten las pruebas funcionales y la ejecución de Compose.

## Historias seleccionadas

| Historia | Prioridad | Puntos | Criterios de aceptación |
|---|---|---:|---|
| US01 Registro | P0 | 3 | Nombres, apellidos, email, teléfono, password y confirmación; email único; hash seguro; validación de obligatorios/email/coincidencia; mensajes claros; redirección al login. |
| US02 Sesión | P0 | 5 | Login real con email/password; JWT firmado y validado; rutas protegidas; logout; separación de datos entre propietarios; sin autenticación simulada en navegador. |
| US03 Perfil | P1 | 2 | Mostrar nombres, apellidos, email y teléfono; editar solo nombres/apellidos/teléfono propios; confirmación de guardado. |
| US04 Mascotas | P0 | 5 | Registro asociado a sesión; lista propia y estado vacío; detalle, edición y eliminación confirmada; nombre/especie/raza/sexo/nacimiento/peso/color y notas opcionales; validar fechas y números. |
| US05 Veterinarias | P1 | 3 | Catálogo con nombre/dirección/teléfono/horario/descripción; búsqueda por nombre; seed; sin mapas. |
| US06 Servicios | P1 | 2 | Consulta general/vacunación/desparasitación/control; nombre/descripción/duración/precio; filtro por veterinaria y seed. |
| US07 Citas | P0 | 5 | Elegir mascota propia, clínica y servicio de esa clínica; fecha/hora futuras; motivo opcional; alta pendiente; listado y detalle propios; cancelación de pendiente; impedir acceso/cancelación ajenos. |
| **Total** | | **25** | Estimación relativa para planificación, no equivalencia directa a horas. |

## Plan de tareas

1. Días 1–2: revisar repositorio, contratos, modelo y migración; preparar contenedores y configuración.
2. Días 3–4: registro, sesión real, autorizaciones y perfil.
3. Días 5–6: gestión de mascotas y estados de UI; pruebas de propiedad y validación.
4. Día 7: catálogo, búsqueda y servicios con datos iniciales.
5. Días 8–9: solicitud/listado/detalle/cancelación de citas; integrar todo el flujo.
6. Día 10: migraciones/seed/pruebas/linters/build, revisión en escritorio y móvil, correcciones, README y preparación de Review.

## Definition of Done

Cada historia solo pasa a terminada si:

- El código está implementado y revisado.
- Frontend, API y PostgreSQL están integrados; no hay mocks en la aplicación entregada.
- Funcionan validaciones del navegador y del servidor.
- Las pruebas funcionales principales pasan, incluyendo restricciones de acceso entre propietarios.
- La aplicación arranca con `docker compose up --build` desde las instrucciones del README.
- Migración y seed ejecutan sin errores, y el seed es repetible.
- README y documentación del sprint están actualizados.
- No aparecen errores críticos en consola durante el flujo principal.
- Se revisó visualmente la interfaz en escritorio y móvil, incluyendo navegación, formularios, estados y confirmaciones.
- La evidencia describe las pruebas efectivamente ejecutadas; cualquier limitación pendiente está declarada.

## Fuera de alcance / backlog futuro

- Registro de vacunas y tratamientos, atención e historial veterinario completo.
- Recordatorios automáticos y alertas por email, SMS o WhatsApp.
- Campañas de salud, panel veterinario, médico o administrativo y confirmación de citas por profesionales.
- Pagos, geolocalización, mapas, microservicios y aplicación móvil nativa.
- Agenda por profesional, control de cupos/solapamientos y reprogramación.
- Recuperación de contraseña, validación del email y mecanismos avanzados de protección de acceso.

El catálogo muestra servicios de vacunación; **no** implementa un registro de vacunas. Las pantallas y botones se limitan a acciones implementadas en este sprint.

## Riesgos técnicos encontrados

| Riesgo | Impacto | Tratamiento / estado |
|---|---|---|
| Repositorio vacío | No había arquitectura ni código reutilizable | Se creó un monolito modular con el stack solicitado. |
| Docker/PostgreSQL no disponibles en el host | Impide ejecutar el sistema completo | Compose y servicios de pruebas preparados; ejecución aún pendiente. |
| Descarga de dependencias rechazada; caché insuficiente | Bloquea backend, build y pruebas de navegador | Se intentó instalación normal y offline; conservar evidencia sin inventar aprobación ni resultados. |
| Cookies, origen y proxy | Login o Swagger podrían fallar si host/CORS no coinciden | Mismo origen `/api`, cookies HttpOnly, CORS explícito y política de contenido específica de Swagger; requiere verificación ejecutada. |
| Cruce de propietarios o servicios | Exposición o datos inconsistentes | Verificación por sesión, FK compuestas y pruebas negativas escritas. |
| Diferencias de zona horaria | Citas guardadas a una hora equivocada | TIMESTAMPTZ, entrada con offset y representación fija en Lima. |
| Borrado de mascotas con citas | Pérdida de referencias | Baja lógica y bloqueo mientras existan pendientes; bloqueo de fila ante concurrencia. |
| Dependencias sin lockfile generado | Versiones transitivas no fijadas | Generarlo tras autorizar y completar instalación; no simular un lockfile. |
| Foto y Swagger remotos | Recursos visuales requieren Internet | Alt descriptivo; funcionalidad principal no depende de la foto; documentado. |

## Sprint Review propuesta

En una base de demostración: abrir la página de inicio, registrar a Ana, comprobar redirección y login, editar su teléfono, registrar y editar a Luna, buscar una veterinaria y consultar sus servicios, solicitar una cita futura y consultar su detalle, cancelarla, eliminar la mascota con confirmación y cerrar sesión. Recargar entre pasos para mostrar persistencia. Demostrar que otra cuenta no accede a los recursos de Ana.

Presentar resultados de pruebas, Swagger y vistas de escritorio/móvil. Este guion es el **resultado esperado**, no evidencia de una Review ya ejecutada.
