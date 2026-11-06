# App del propietario (Expo) y vistas de propietario en la web

Manda sobre MASTER para `mobile/` y para Inicio/Citas/Mascotas del propietario en la web.

## Tema «cálido» de la app (06/11/2026)

La web del personal mantiene la identidad de MASTER §2 (herramienta de trabajo). La app del propietario usa la misma marca teal con un tono más cercano: fondo crema, acento durazno y la tipografía redondeada **Nunito**. Tokens en `mobile/src/theme.ts`; contraste comprobado en `mobile/__tests__/theme.test.ts`.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` | `#0d5953` | `#73d4c7` | Botón principal, navegación activa |
| `accent` / `onAccent` | `#f6c38a` / `#3b2104` | `#f6c38a` / `#2b1703` | Solo el CTA del bloque de bienvenida («Pedir turno») |
| `accentSoft` / `onAccentSoft` | `#fdebd5` / `#7a3d07` | `#3a2814` / `#f8cf9f` | Avatares de mascotas, mensaje del estado de la cita |
| `hero` | `#0d5953` | `#173c38` | Bloque de bienvenida del inicio |
| `background` / `card` | `#f7f3ec` / `#ffffff` | `#111716` / `#1a2221` | Fondo crema y tarjetas |
| `text` / `textSecondary` | `#1d2b2d` / `#59605f` | `#edf3f2` / `#a9b7b4` | Texto (≥ 4.5:1 sobre fondo, tarjeta y `soft`) |
| `inputBorder` | `#8a8073` | `#7d8d8a` | Borde de campos y opciones (≥ 3:1, WCAG 1.4.11) |

**Alto contraste** (preferencia): texto ≥ 7:1 (AAA), bordes oscuros y visibles en tarjetas, insignias y pestañas. Formas: tarjetas de radio 20 y controles de 14; sombra suave solo en claro.

**Ícono**: huella crema con una cruz médica teal sobre fondo teal. Fuente editable en `mobile/assets/icon-source/` (SVG generado por código); PNG para iOS, Android adaptable (con versión monocroma para íconos temáticos), splash y favicon.

## Accesibilidad ajustable (pantalla «Accesibilidad»)

Desde **Perfil → Accesibilidad** y desde el ingreso (antes de iniciar sesión). Igual que el menú de la web, se guarda en el teléfono y se aplica al instante:
- **Tema**: Automático (como el teléfono), Claro u Oscuro.
- **Tamaño del texto**: 100 %, 120 %, 140 % o 160 %, sumado al tamaño de letra del sistema. La barra de pestañas crece hasta 120 % porque su alto es fijo.
- **Alto contraste**, **Texto en negrita**, **Espaciado de lectura** (interlineado ≥ 1.5 y más espacio entre letras, WCAG 1.4.12) y **Reducir animaciones** (sin deslizamientos entre pantallas ni en las hojas).
- Siempre se respetan los ajustes del sistema «Texto en negrita» (iOS) y «Reducir movimiento».

## Navegación

Pestañas inferiores (máximo 4): **Inicio · Citas · Mascotas · Perfil**. Botón de acción principal «Pedir turno» en Inicio y en Citas (no una pestaña). Atrás predecible; enlaces profundos a una cita (`/citas/{id}`).

## Inicio: «qué pasa con mi mascota»

Orden fijo, de lo urgente a lo útil:
1. **Próxima cita** (tarjeta grande): mascota, servicio, día y hora, veterinaria, línea de 5 pasos con el estado actual y su texto para el propietario (MASTER §3). Si está en sala de espera o en consulta, la tarjeta pasa a primer plano con refresco cada 30 s.
2. **Recordatorios**: vencidos primero (rojo + `TriangleAlert`), luego próximos 30 días. Cada uno con botón **«Agendar»** que abre la reserva con mascota y veterinaria preseleccionadas y el servicio sugerido (Vacunación, Desparasitación o Control). Es la palanca de retorno: no lo escondas.
3. **Mis mascotas** en fila horizontal con acceso a su historia.
Vacío: «Agrega a tu mascota para pedir su primer turno».

## Pedir turno: ≤ 4 pasos con progreso «Paso X de 4»

1. **Mascota** (preseleccionada si hay una sola o viene de un recordatorio).
2. **Veterinaria y servicio**: tarjetas con **precio y duración visibles** («Consulta general · 30 min · S/ 65»). Recordar la última veterinaria usada.
3. **Día y hora**: tira de 14 días (cerrados deshabilitados con texto «Cerrado»), turnos en rejilla de botones ≥ 44 px; ocupados deshabilitados y tachados con lector «no disponible». Atajo **«Primer turno libre»**.
4. **Resumen y motivo** (opcional, ayuda: «¿Qué le pasa? Ayuda a preparar la consulta») → «Solicitar turno».
Después: pantalla de éxito con la cita en estado **Por confirmar** y el texto «La veterinaria confirmará tu turno. Revisa su estado aquí». Si el servidor responde 409: «Ese horario se acaba de ocupar» y volver al paso 3 con los turnos recargados, sin perder lo demás.

## Mis citas

Segmentos **Próximas / Anteriores**. Cada fila: estado (badge), fecha relativa, mascota, servicio, veterinaria y, si está atendida, «Pagado S/ X · método» o «Pago en la veterinaria». Cancelar solo si está Por confirmar o Confirmada y no llegó; hoja de confirmación: «¿Cancelar el turno de Luna del jue 12 a las 10:00? El horario quedará libre para otra mascota». Botón destructivo «Cancelar turno» y secundario «Mantener».

## Mascota

Cabecera con especie (icono), edad calculada y peso. Pestañas **Historia · Vacunas y cuidados**. Vacunas como carnet: nombre, fecha, próxima dosis con estado (Al día / Por vencer / Vencida). Alergias o notas importantes arriba, en `danger`.

## Específico de la app

- `Pressable` con feedback (opacidad o ripple), `hitSlop` en iconos, `SafeAreaView` en cabecera, pestañas y botón inferior fijo.
- Texto dinámico: nada se corta con la letra más grande; listas con `FlatList`.
- Modo oscuro y alto contraste con los tokens de este archivo, probados aparte.
- Primer arranque: API dormida de Render puede tardar ~1 min → mostrar «Despertando el servidor…» en vez de un error genérico.
