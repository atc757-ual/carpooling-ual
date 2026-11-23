// Ficheros Markdown importados como texto (import … with { loader: 'text' }):
// el test de los mensajes de error lee el catálogo de docs/api/errors.md
declare module '*.md' {
  const content: string;
  export default content;
}
