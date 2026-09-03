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

// Tipografía.
//
// Georgia para todo lo que sea texto chico (diálogo, nombres, botones). No es
// una elección estética sino técnica: Georgia fue diseñada para leerse en
// pantalla a tamaños chicos y trae "hinting", que ajusta los trazos a la
// grilla de píxeles. Las webfonts finas tipo Spectral o Cormorant Garamond no
// lo tienen y a 15-19px se ven blandas.
//
// Cormorant Garamond queda SOLO para el título grande (52px), que es el
// tamaño para el que esa fuente está pensada.
//
// Para comparar opciones lado a lado: tests/nitidez.html
export const F = {
  body:  'Georgia, "Times New Roman", serif',
  name:  'Georgia, "Times New Roman", serif',
  title: '"Cormorant Garamond", Georgia, serif',

  sizeBody:   '17px',
  weightBody: 'normal',
  sizeName:   '19px',
  sizeSmall:  '14px',
};

/** Nombre visible y color por speaker. */
export const SPEAKERS = {
  rein:     { name: 'Reinhart', color: C.reinName },
  daku:     { name: 'Daku',     color: C.dakuName },
  nuri:     { name: 'Nuri',     color: C.nuriName },
  narrator: { name: '',         color: C.narrator },
  stage:    { name: '',         color: C.textStage },
};
