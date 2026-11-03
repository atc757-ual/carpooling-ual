// «Carlos Ruiz Gómez» → «Carlos R.»: lo justo para reconocer a alguien sin
// mostrar su nombre completo (reseñas y chat)
export function toShortName(name: string): string {
  const [first = '', second] = name.trim().split(/\s+/);
  return second === undefined ? first : `${first} ${second.charAt(0)}.`;
}
