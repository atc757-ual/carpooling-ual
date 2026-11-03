// Cuántas muestras recientes se guardan para el percentil
export const LAG_SAMPLES_LIMIT = 500;

export interface LagStats {
  samples: number;
  lastMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

// Retraso entre que se registra un evento y lo aplica el gemelo (RNF-07,
// DP-04: p95 ≤ 1 s), sobre las últimas LAG_SAMPLES_LIMIT muestras
export class LagTracker {
  private readonly samples: number[] = [];

  record(lagMs: number): void {
    this.samples.push(Math.max(0, lagMs));
    if (this.samples.length > LAG_SAMPLES_LIMIT) {
      this.samples.shift();
    }
  }

  stats(): LagStats {
    const count = this.samples.length;
    if (count === 0) {
      return { samples: 0, lastMs: null, p95Ms: null, maxMs: null };
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    // Percentil por el método del rango más cercano
    const p95Index = Math.ceil(0.95 * count) - 1;
    return {
      samples: count,
      lastMs: this.samples[count - 1],
      p95Ms: sorted[p95Index],
      maxMs: sorted[count - 1],
    };
  }
}
