# VetGest · Sistema de diseño y experiencia (fuente única)

Versión 1 · 05/11/2026 · rama `feature/despliegue-y-app`. Las reglas de `pages/` mandan sobre este archivo para su pantalla. Aplica a la web (`frontend/`) y a la app de propietarios (`mobile/`).

## 1. Para qué diseñamos: el negocio y el cliente

VetGest gana si la veterinaria **llena su agenda, cobra todo lo que atiende y el propietario vuelve**. Cada pantalla debe mover al menos una de estas palancas:

| Palanca de negocio | Indicador | Cómo la empuja el diseño |
|---|---|---|
| Agenda llena | Citas por día (ocupación: versión posterior) | Reservar en ≤ 4 pasos, «primer turno libre» a un toque, precios visibles antes de reservar |
| Menos inasistencias | % «No asistió» | Recordatorio de la cita en el inicio, estado claro («Por confirmar» vs «Confirmada»), cancelar fácil para liberar el turno |
| Cobrar todo lo atendido | Pendiente de cobro (S/) | La atención termina en caja: «Por cobrar» visible en recepción hasta cobrar; cierre del día por método |
| Clientes que vuelven | Citas generadas desde recordatorios | Cada recordatorio vencido trae «Agendar» con mascota y servicio ya elegidos |
| Sin quiebres de stock | Productos bajo mínimo | Alerta de stock bajo donde se usa (ficha del veterinario) y donde se compra (inventario) |

Lo que el **propietario** necesita sentir: *sé cuánto cuesta, sé si me confirmaron, sé qué está pasando con mi mascota ahora y tengo su carnet a la mano.*
Lo que el **personal** necesita: *ver el día de un vistazo, una acción principal por tarjeta, no equivocarse y no escribir dos veces lo mismo.*

## 2. Identidad visual (se mantiene la marca actual)

Se descartan las sugerencias genéricas de la base de estilos (claymorphism, naranja): VetGest es una herramienta de trabajo de 8 horas diarias y ya tiene marca. Estilo: **plano, sereno y confiable**, tarjetas suaves, sin decoración que compita con los datos.

| Token | Claro | Oscuro (app) | Uso |
|---|---|---|---|
| `primary` | `#103d41` teal | `#7fd1c8` | Botón principal, navegación activa, marca |
| `primary-hover` | `#18555a` | `#9fe0d8` | Hover / pressed |
| `accent` | `#dbf18c` lime | `#c6e36b` | Solo para resaltar una cosa por pantalla (CTA secundario, «hoy») |
| `bg` | `#f5f7f8` | `#0e1a1b` | Fondo |
| `surface` | `#ffffff` | `#162426` | Tarjetas |
| `text` | `#233b40` | `#e3eeee` | Texto principal (≥ 7:1) |
| `muted` | `#657579` | `#9fb3b5` | Texto secundario (≥ 4.5:1) |
| `line` | `#e4e9e9` | `#2a3c3e` | Bordes |
| `danger` | `#a73636` | `#f08a7e` | Destructivo, alergias, stock en 0 |

Tipografía: pila del sistema (`Segoe UI`, `-apple-system`, `Roboto`), base **16 px** respetando el tamaño del usuario, interlineado 1.5–1.6, cifras tabulares en montos y horas. Espaciado en múltiplos de 4/8. Radio: 10 px botones y campos, 18 px tarjetas. Iconos: **Lucide** (web: `lucide-react`; app: `lucide-react-native` o `@expo/vector-icons` Feather), trazo 1.75–2, nunca emojis.

## 3. Estados: siempre texto + icono + color

El color nunca va solo. Mismo nombre, icono y tono en web y app.

| Estado / etiqueta | Tono | Icono Lucide | Texto para el propietario |
|---|---|---|---|
| Por confirmar | ámbar (`pending`) | `Clock` | «La veterinaria confirmará tu turno» |
| Confirmada | azul (`confirmed`) | `CalendarCheck` | «Te esperamos el {día} a las {hora}» |
| En sala de espera | lima (`waiting`) | `Armchair` | «Ya estás registrado. Te llamarán pronto» |
| En consulta | teal (`consult`) | `Stethoscope` | «{Mascota} está con {veterinario}» |
| Atendida | verde (`attended`) | `CircleCheck` | «Atención registrada. Revisa sus indicaciones» |
| Cancelada | gris (`cancelled`) | `CircleX` | «Cita cancelada» |
| No asistió | rojo (`noshow`) | `UserX` | «No registramos tu llegada» |
| Por cobrar | ámbar | `Wallet` | (solo personal) |
| Pagada | verde | `BadgeCheck` | «Pagado S/ 65 · Yape» |
| Stock bajo | rojo | `TriangleAlert` | (solo personal) |

El recorrido de una cita se muestra como **línea de 5 pasos** (Por confirmar → Confirmada → En sala de espera → En consulta → Atendida) con el paso actual marcado con texto, no solo con color.

## 4. Reglas de interacción (no negociables)

1. **Una acción principal por tarjeta/pantalla**, en `primary`; las demás como secundarias o en menú.
2. **Objetivos táctiles ≥ 44×44** (web y app), separación ≥ 8 px. Feedback al presionar en ≤ 100 ms.
3. **Acciones que cuestan dinero o turnos** (cobrar, anular, cancelar, marcar inasistencia) piden confirmación dentro de la página con el resumen: qué, a quién, cuánto. Nunca `window.confirm`.
4. **Formularios**: etiqueta visible siempre, ayuda debajo, error junto al campo y resumen enlazado si hay varios. Se permite pegar y el gestor de contraseñas (`autocomplete`).
5. **Carga y resultado**: botón con estado «Guardando…», luego mensaje de éxito que diga qué pasó («Llegada registrada · Luna»). Errores del servidor con el texto que devuelve la API.
6. **Estados vacíos que venden**: dicen qué falta y ofrecen la acción («Aún no tienes mascotas · Agregar mascota»).
7. **Datos en vivo** (sala de espera, estado de la cita): refresco cada 30 s y al volver a la pantalla; indicar «Actualizado hace X min».
8. **Montos** siempre `S/ 1 234.50` con cifras tabulares; **horas** en 24 h de Lima (`16:30`) y fechas relativas cuando ayudan («Hoy», «Mañana», «jue 12 nov»).
9. **Movimiento**: 150–250 ms, solo para confirmar acciones o cambiar de estado; respetar «reducir movimiento».
10. **Accesibilidad**: contraste 4.5:1, foco visible, orden de lectura = orden visual, iconos decorativos ocultos al lector de pantalla, botones de icono con nombre.

## 5. Lenguaje

Tú, cálido y directo. Nombres que entiende el cliente: «turno», «tu mascota», «Por confirmar» (no «Pendiente»), «Registrar llegada» (no «check-in»), «Cobrar» (no «Registrar pago»). Botones con verbo + objeto: «Confirmar turno», «Cobrar S/ 65».

## 6. Lista de verificación antes de entregar una pantalla

- [ ] Mueve al menos una palanca de la sección 1 y se nota cuál es la acción principal.
- [ ] Estados con texto + icono + color; nada depende solo del color.
- [ ] Probada a 375 px y a 1280 px; sin scroll horizontal (salvo tablas en su contenedor).
- [ ] Contraste revisado en claro (y oscuro en la app); foco visible con teclado.
- [ ] Vacío, cargando, error y éxito diseñados.
- [ ] Confirmación con resumen en acciones de dinero o turnos.
