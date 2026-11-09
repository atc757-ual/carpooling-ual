// Contraste de la hipótesis experimental (sección 11 de la memoria): ¿reduce
// el escenario los vehículos frente a la base? Cada réplica compara el
// escenario y la base con la misma población (semillas emparejadas), así que
// se trabaja con la diferencia de cada réplica: vehículos de la base menos
// vehículos del escenario (positiva = el escenario usa menos coches).
//
// - HE0: no hay diferencia. HE1: el escenario usa menos vehículos (contraste
//   unilateral, porque HE1 tiene dirección).
// - Bonferroni: hay cinco comparaciones (S1-S5 frente a S0), así que cada una
//   se hace con alfa = 0,05 / 5 = 0,01.
// - t pareado: se rechaza HE0 si la cota inferior del intervalo unilateral al
//   99 % de la diferencia media queda por encima de cero.
// - Wilcoxon de rangos con signo: comprobación sin suponer normalidad, con la
//   aproximación normal (solo con 10 o más diferencias distintas de cero).

export const COMPARISONS = 5;
export const FAMILY_ALPHA = 0.05;
export const ALPHA = FAMILY_ALPHA / COMPARISONS;
export const MIN_WILCOXON_PAIRS = 10;

// Valor crítico de la t de Student, una cola, alfa = 0,01, para 1-30 grados
// de libertad; a partir de ahí, la normal
const T_CRITICAL_ONE_SIDED_99 = [
  31.821, 6.965, 4.541, 3.747, 3.365, 3.143, 2.998, 2.896, 2.821, 2.764, 2.718,
  2.681, 2.65, 2.624, 2.602, 2.583, 2.567, 2.552, 2.539, 2.528, 2.518, 2.508,
  2.5, 2.492, 2.485, 2.479, 2.473, 2.467, 2.462, 2.457,
];
const Z_CRITICAL_ONE_SIDED_99 = 2.326;

export interface WilcoxonResult {
  // Pares con diferencia distinta de cero (los que cuentan)
  pairs: number;
  z: number;
  rejectsNull: boolean;
}

export interface PairedTest {
  alpha: number;
  replicas: number;
  // Vehículos evitados por réplica: media, desviación y cota inferior del
  // intervalo unilateral al (1 - alfa)
  meanDifference: number;
  sdDifference: number;
  lowerBound: number;
  // null si todas las diferencias son iguales (sin dispersión)
  tStatistic: number | null;
  rejectsNull: boolean;
  // null con menos de MIN_WILCOXON_PAIRS diferencias distintas de cero
  wilcoxon: WilcoxonResult | null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function criticalT(degreesOfFreedom: number): number {
  return (
    T_CRITICAL_ONE_SIDED_99[degreesOfFreedom - 1] ?? Z_CRITICAL_ONE_SIDED_99
  );
}

// Rangos de los valores absolutos, con la media de los rangos en los empates
function averageRanks(values: readonly number[]): number[] {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      order[end + 1].value === order[start].value
    ) {
      end += 1;
    }
    const rank = (start + end) / 2 + 1;
    for (let k = start; k <= end; k += 1) {
      ranks[order[k].index] = rank;
    }
    start = end + 1;
  }
  return ranks;
}

// Corrección de la varianza por empates: suma de (t^3 - t) de cada grupo
function tieCorrection(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let sum = 0;
  for (const count of counts.values()) {
    sum += count ** 3 - count;
  }
  return sum;
}

export function wilcoxonSignedRank(
  differences: readonly number[],
): WilcoxonResult | null {
  const nonZero = differences.filter((difference) => difference !== 0);
  const n = nonZero.length;
  if (n < MIN_WILCOXON_PAIRS) {
    return null;
  }
  const magnitudes = nonZero.map(Math.abs);
  const ranks = averageRanks(magnitudes);
  const positiveSum = ranks.reduce(
    (sum, rank, index) => (nonZero[index] > 0 ? sum + rank : sum),
    0,
  );
  const expected = (n * (n + 1)) / 4;
  const variance =
    (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection(magnitudes) / 48;
  // Corrección de continuidad hacia la media
  const z =
    variance > 0 ? (positiveSum - expected - 0.5) / Math.sqrt(variance) : 0;
  return {
    pairs: n,
    z: round(z),
    rejectsNull: z > Z_CRITICAL_ONE_SIDED_99,
  };
}

// t pareado unilateral sobre las diferencias (base - escenario)
export function pairedTest(differences: readonly number[]): PairedTest {
  const n = differences.length;
  const mean = n > 0 ? differences.reduce((sum, d) => sum + d, 0) / n : 0;
  const variance =
    n > 1
      ? differences.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1)
      : 0;
  const sd = Math.sqrt(variance);
  const standardError = n > 0 ? sd / Math.sqrt(n) : 0;
  const lowerBound = n > 1 ? mean - criticalT(n - 1) * standardError : mean;
  return {
    alpha: ALPHA,
    replicas: n,
    meanDifference: round(mean),
    sdDifference: round(sd),
    lowerBound: round(lowerBound),
    tStatistic: standardError > 0 ? round(mean / standardError) : null,
    // Con una sola réplica no hay contraste posible
    rejectsNull: n > 1 && lowerBound > 0,
    wilcoxon: wilcoxonSignedRank(differences),
  };
}
