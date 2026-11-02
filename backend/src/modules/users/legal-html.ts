// Saneado del HTML de los documentos legales que edita el panel. No filtra
// el HTML recibido: lo reconstruye. Solo vuelven a salir como etiquetas las de
// la lista cerrada (títulos, párrafos, listas, negritas, cursivas, saltos y
// enlaces), sin atributos salvo el href de los enlaces (http, https o
// mailto). Todo lo demás (scripts, estilos, eventos, comentarios, etiquetas
// desconocidas) se queda en texto escapado o se quita

const ALLOWED_TAGS = new Set([
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'a',
  'br',
]);
// Etiquetas cuyo contenido tampoco se conserva como texto
const DROPPED_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object']);
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s"'<>`]+$/i;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function openingTag(name: string, attributes: string): string {
  if (name !== 'a') {
    return `<${name}>`;
  }
  const match = HREF.exec(attributes);
  const href = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
  return SAFE_HREF.test(href)
    ? `<a href="${escapeText(href)}" rel="noopener noreferrer">`
    : '<a>';
}

// El HTML limpio, listo para guardarlo y servirlo
export function sanitizeLegalHtml(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?(-->|$)/g, '');
  const withoutDangerous = withoutComments.replace(
    /<(script|style|iframe|object)\b[\s\S]*?(<\/\1\s*>|$)/gi,
    '',
  );
  let output = '';
  let last = 0;
  for (const match of withoutDangerous.matchAll(TAG)) {
    const [whole, closing, rawName, attributes] = match;
    const name = rawName.toLowerCase();
    output += escapeText(withoutDangerous.slice(last, match.index));
    last = match.index + whole.length;
    if (DROPPED_WITH_CONTENT.has(name) || !ALLOWED_TAGS.has(name)) {
      continue;
    }
    if (name === 'br') {
      output += closing ? '' : '<br>';
    } else {
      output += closing ? `</${name}>` : openingTag(name, attributes);
    }
  }
  output += escapeText(withoutDangerous.slice(last));
  return output.trim();
}
