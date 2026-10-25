// Se carga antes de cada fichero de tests e2e.

// Tamaños de pantalla en los que se prueba cada pantalla: el móvil del diseño
// y un escritorio (el layout cambia desde 768px)
export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;
