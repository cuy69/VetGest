# Recepción y veterinario (web, espacio de clínica)

Manda sobre MASTER para Agenda, Sala de espera, Caja y la ficha del veterinario. Densidad media-alta: el personal lo usa todo el día.

## Vista «Hoy» (inicio de recepción)

Tablero del día en 4 columnas que siguen el recorrido del paciente, cada tarjeta con **una** acción:

| Por llegar | En sala de espera | En consulta | Por cobrar |
|---|---|---|---|
| Confirmadas de hoy por hora · **Registrar llegada** | Minutos esperando (≥ 15 min ámbar, ≥ 30 min rojo, siempre con número) · veterinario | Veterinario y desde qué hora | Atendidas sin cobro · **Cobrar S/ X** |

Encima, contadores con número grande: Solicitudes por confirmar · En sala · Por cobrar (S/) · Inasistencias de hoy. Las solicitudes por confirmar se atienden en su lista: **la más antigua primero**, selector de veterinario en la misma fila y aviso de cruce antes de enviar (consultar `/clinic/availability?vet_id=`). En pantallas angostas las columnas se apilan en ese mismo orden.

## Caja

- Pendientes de cobro con monto precargado (precio del servicio) y editable; métodos como **tres botones grandes** (Efectivo, Yape, Tarjeta) y un botón final «Cobrar S/ 65 con Yape» que repite monto y método.
- Cobros del día con **cierre**: total por método para cuadrar con el cajón y la app de Yape, cantidad de cobros y pendiente.
- Anular (solo admin): confirmación con motivo obligatorio y el cobro queda visible tachado como «Anulado».

## Veterinario

- «Mi siguiente paciente»: el que está en sala de espera y le toca; botón **Iniciar consulta**. Alergias/notas en `danger` arriba de todo.
- Al registrar vacuna o tratamiento: selector de producto del inventario que muestra el stock («Antirrábica · quedan 3»); con stock 0 deshabilitado con el motivo; con stock bajo, aviso discreto.
- Atajos que evitan escribir: próxima dosis sugerida (vacuna anual +12 meses, desparasitación +3 meses) editable.
