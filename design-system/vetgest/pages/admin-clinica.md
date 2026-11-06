# Administrador de clínica: ingresos, inventario y equipo

Manda sobre MASTER para Reportes, Inventario y Datos de la veterinaria.

## Resumen del negocio (lo primero que ve)

Indicadores con periodo seleccionable (hoy · 7 días · 30 días · rango): **Ingresos**, **Ticket promedio** (ingresos / cobros), **Por cobrar** (S/ y cantidad), **Inasistencias** (% de citas del periodo, de `appointments`) y **Productos bajo mínimo**. La ocupación de agenda queda para una versión posterior (el backend aún no la calcula). Cada indicador enlaza a su detalle.

## Ingresos

- Barras por día (no torta) con el total en texto; desglose por método y por servicio como **tablas** ordenadas por monto. Toda gráfica tiene su tabla equivalente.
- Exportar no es necesario en v1; sí el periodo en la URL para compartirlo.

## Inventario

- Lista ordenada por urgencia: stock en 0, bajo mínimo, resto. Cada fila: nombre, categoría, stock con unidad, mínimo, estado (texto + icono), acciones «Registrar ingreso» y «Ajustar».
- Ingreso: cantidad + nota («Factura 001-234»); ajuste: cantidad con signo y motivo obligatorio. Historial de movimientos con autor y si vino de una atención.

## Datos de la veterinaria

Horario estructurado (abre, cierra, días con casillas) con vista previa de los turnos que verá el propietario: «Así verán tus clientes el martes: 08:00, 08:30 … 19:30».
