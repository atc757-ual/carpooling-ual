import { escapeHtml } from './escape-html';

// HTML sencillo con estilos en línea y sin imágenes externas, como el resto
// de correos (los programas de correo ignoran las hojas de estilo): los
// párrafos (ya escapados), un botón con el enlace y el pie en gris
export function wrapMailHtml(
  paragraphs: string[],
  link: { url: string; label: string },
  footer: string,
): string {
  return `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n  ')}
  <p style="margin: 24px 0"><a href="${escapeHtml(link.url)}" style="background: #0b5cad; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: bold">${escapeHtml(link.label)}</a></p>
  <p style="color: #5c5c5c; font-size: 14px">${footer}</p>
</div>`;
}
