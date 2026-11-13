// iPhone (Safari, la app instalada y la de Capacitor): iOS amplía la página al
// enfocar un campo con la letra por debajo de 16px y no la devuelve a su
// tamaño. Con maximum-scale=1 en el viewport deja de hacerlo, y el zoom con los
// dedos sigue funcionando: iOS lo permite siempre por accesibilidad (WCAG
// 1.4.4). Solo en iOS: en Android, maximum-scale sí bloquearía ese zoom
const MAXIMUM_SCALE = 'maximum-scale=1';

export function preventIosFocusZoom(doc: Document): void {
  const viewport = doc.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport || viewport.content.includes('maximum-scale')) return;
  viewport.content = `${viewport.content}, ${MAXIMUM_SCALE}`;
}
