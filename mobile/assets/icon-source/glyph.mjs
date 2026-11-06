// Huella con cruz médica. Coordenadas en un lienzo de 1024; `s` escala alrededor del centro.
export function glyph({ pad = '#f7f3ec', cross = '#0d5953', s = 1, dy = 0, mono = false }) {
  const toes = [[318, 430, -24, 64, 82], [430, 318, -8, 70, 90], [594, 318, 8, 70, 90], [706, 430, 24, 64, 82]]
  const toeEls = toes.map(([x, y, r, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})"/>`).join('')
  // Almohadilla principal: forma de corazón suave.
  const mainPad = `<path d="M512 488 C 600 488 690 560 712 640 C 734 720 680 772 610 764 C 560 758 540 740 512 740 C 484 740 464 758 414 764 C 344 772 290 720 312 640 C 334 560 424 488 512 488 Z"/>`
  const plus = `<path d="M512 560 V 700 M442 630 H 582" stroke-width="46" stroke-linecap="round"/>`
  const t = `translate(512 ${512 + dy}) scale(${s}) translate(-512 -540)`
  if (mono) return `<defs><mask id="m"><rect width="1024" height="1024" fill="white"/><g transform="${t}" stroke="black" fill="none">${plus}</g></mask></defs>
    <g transform="${t}" fill="${pad}" mask="url(#m)">${toeEls}${mainPad}</g>`
  return `<g transform="${t}"><g fill="${pad}">${toeEls}${mainPad}</g><g stroke="${cross}" fill="none">${plus}</g></g>`
}
