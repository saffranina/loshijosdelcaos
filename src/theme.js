// theme.js — paleta y tipografía compartidas.
// Todo lo que sea "provisional" (colores de placeholder) vive acá para que
// cambiarlo cuando llegue el arte sea un solo archivo.

export const C = {
  // Ambiente
  night:      0x0a0708,
  roomDark:   0x1b1013,
  roomWarm:   0x2e1c1c,
  barDark:    0x140d0e,
  barWarm:    0x3a2418,
  lamp:       0xd9a05b,

  // UI
  boxFill:    0x111b27,
  boxStroke:  0x71859a,
  textMain:   '#f4f7fa',
  textDim:    '#ccd6df',
  // Las acotaciones iban en gris medio y eran lo que peor se leía: su tinta
  // nunca llegaba a un tono claro, así que la letra se veía lavada. Subido.
  textStage:  '#dbe3ea',
  textName:   '#ffffff',

  // Personajes (placeholder rects + nombres)
  rein:       0x3f5a72,
  reinName:   '#8fb4d4',
  daku:       0x6b2f4a,
  dakuName:   '#d98ab0',
  nuri:       0x6b5334,
  nuriName:   '#d9bd7a',
  narrator:   '#a99b8d',

  // Recursos
  emp:        0x6fd0e0,
  empEmpty:   0x344657,
  drink:      0xd98a3a,
  cloth:      0xb9cad9,
  clothLost:  0x33404d,

  // Dados
  dieFace:    0xe8dcc8,
  diePip:     0x2a1e18,
  dieHeld:    0xd9a05b,
  dieSelect:  0x8fd48f,
  dieDead:    0x8a7f70,
};

// Tipografía. Los tamaños y pesos NO son decorativos: están medidos con
// tests/nitidez.html, que calcula qué proporción de la tinta de una letra cae
// en tonos intermedios (más alto = se ve más difusa a 800x600).
//
//   Spectral 400 a 15px ...... el más difuso de todos, era lo que había
//   Spectral 400 a 17px ...... 52,7 %
//   Cormorant Garamond a 19px  58,8 %   (es una fuente de titular, no de texto)
//   Georgia 400 a 17px ....... 45,3 %
//   Spectral 600 a 19px ...... 45,2 %   <- lo que usamos ahora
//
// Si cambiás algo de acá, volvé a correr tests/nitidez.html.
export const F = {
  body:  '"Spectral", Georgia, serif',
  title: '"Cormorant Garamond", Georgia, serif',

  sizeBody:   '19px',
  weightBody: '600',    // el peso normal (400) se deshilacha a este tamaño
  sizeName:   '22px',
  sizeSmall:  '15px',
};

/** Nombre visible y color por speaker. */
export const SPEAKERS = {
  rein:     { name: 'Reinhart', color: C.reinName },
  daku:     { name: 'Daku',     color: C.dakuName },
  nuri:     { name: 'Nuri',     color: C.nuriName },
  narrator: { name: '',         color: C.narrator },
  stage:    { name: '',         color: C.textStage },
};
