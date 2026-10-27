// CartoCiudad da las direcciones en mayúsculas y con la partícula al final:
// «AVENIDA» + «MEDITERRANEO (DEL)» + 120. Aquí se escriben como se leen:
// «Avenida del Mediterraneo, 120» (las tildes que no trae no se pueden
// recuperar)

// Palabras que van en minúscula dentro de un nombre
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);

// «AVENIDA DEL MEDITERRANEO» → «Avenida del Mediterraneo». Las partículas, en
// minúscula salvo al principio
export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && PARTICLES.has(word)
        ? word
        : word.replace(/\p{L}/u, (letter) => letter.toUpperCase()),
    )
    .join(' ');
}

// «MEDITERRANEO (DEL)» → «DEL MEDITERRANEO». Un paréntesis que no es una
// partícula («SACRAMENTO (CARRETERA)») se deja como está
function moveParticle(name: string): string {
  // Sin expresión regular: con «(.*)» y «\s*» seguidos, una regex puede
  // tardar mucho más de lo lineal en textos raros (backtracking)
  const open = name.lastIndexOf('(');
  if (!name.endsWith(')') || open <= 0) {
    return name;
  }
  const base = name.slice(0, open).trimEnd();
  const particle = name.slice(open + 1, -1).trim();
  if (!base || !particle) {
    return name;
  }
  const isParticle = particle
    .toLowerCase()
    .split(/\s+/)
    .every((word) => PARTICLES.has(word));
  return isParticle ? `${particle} ${base}` : name;
}

export interface AddressParts {
  // Tipo de vía («CALLE», «AVENIDA»); null en los lugares sin vía
  streetType: string | null;
  // Nombre de la vía, sin el tipo ni el número
  streetName: string;
  portalNumber: number | null;
}

// «Avenida del Mediterraneo, 120» (o sin número, la vía)
export function formatAddress({
  streetType,
  streetName,
  portalNumber,
}: AddressParts): string {
  const street = toTitleCase(
    [streetType, moveParticle(streetName.trim())].filter(Boolean).join(' '),
  );
  return portalNumber ? `${street}, ${portalNumber}` : street;
}

// «La Cañada de San Urbano (Almería)», o solo el municipio si la población es
// el propio municipio
export function formatLocality(town: string, municipality: string): string {
  return town && town !== municipality
    ? `${town} (${municipality})`
    : municipality;
}
