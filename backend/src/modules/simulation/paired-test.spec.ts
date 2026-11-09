import { ALPHA, pairedTest, wilcoxonSignedRank } from './paired-test';

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('pairedTest', () => {
  it('uses Bonferroni over the five comparisons with S0', () => {
    expect(ALPHA).toBe(0.01);
    expect(pairedTest([1, 2]).alpha).toBe(0.01);
  });

  it('rejects HE0 when the one-sided 99 % bound of the mean is above zero', () => {
    // Media 3, desviación 1,581, t de 4 grados de libertad = 3,747
    const test = pairedTest([1, 2, 3, 4, 5]);

    expect(test).toMatchObject({
      replicas: 5,
      meanDifference: 3,
      sdDifference: 1.581,
      tStatistic: 4.243,
      rejectsNull: true,
    });
    // 3 - 3,747 · 1,581 / √5
    expect(test.lowerBound).toBeCloseTo(0.35, 2);
  });

  it('does not reject HE0 when the scenario does not use fewer cars', () => {
    expect(pairedTest([-1, 1, -1, 1, 0, 0]).rejectsNull).toBe(false);
    expect(pairedTest([-3, -2, -4, -5]).rejectsNull).toBe(false);
  });

  it('does not reject HE0 when the bound is not clearly above zero', () => {
    // Media positiva pero con mucha dispersión
    expect(pairedTest([10, -8, 9, -7, 1]).rejectsNull).toBe(false);
  });

  it('cannot test a single replica', () => {
    expect(pairedTest([7])).toMatchObject({
      replicas: 1,
      meanDifference: 7,
      tStatistic: null,
      rejectsNull: false,
    });
    expect(pairedTest([])).toMatchObject({ replicas: 0, rejectsNull: false });
  });

  it('rejects HE0 without spread only when the difference is positive', () => {
    expect(pairedTest([4, 4, 4])).toMatchObject({
      tStatistic: null,
      lowerBound: 4,
      rejectsNull: true,
    });
    expect(pairedTest([0, 0, 0]).rejectsNull).toBe(false);
  });

  it('uses the normal distribution beyond 31 replicas', () => {
    const values = range(1, 40).map((i) => (i % 2 === 0 ? 1 : 3));
    const test = pairedTest(values);
    const standardError = test.sdDifference / Math.sqrt(40);

    expect(test.meanDifference - test.lowerBound).toBeCloseTo(
      2.326 * standardError,
      2,
    );
  });
});

describe('wilcoxonSignedRank', () => {
  it('needs at least 10 non-zero differences', () => {
    expect(wilcoxonSignedRank(range(1, 9))).toBeNull();
    expect(wilcoxonSignedRank([...range(1, 9), 0, 0])).toBeNull();
  });

  it('rejects HE0 when every difference is positive', () => {
    // W+ = 78, media 39, varianza 162,5
    expect(wilcoxonSignedRank(range(1, 12))).toEqual({
      pairs: 12,
      z: 3.02,
      rejectsNull: true,
    });
  });

  it('does not reject HE0 with differences of both signs', () => {
    const result = wilcoxonSignedRank([
      ...range(1, 6),
      ...range(1, 6).map((d) => -d),
    ]);

    expect(result?.pairs).toBe(12);
    expect(result?.rejectsNull).toBe(false);
  });

  it('averages the ranks of ties and corrects the variance', () => {
    const result = wilcoxonSignedRank([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, -2]);

    // Todos empatados (rango medio 6,5): W+ = 71,5, media 39
    expect(result?.pairs).toBe(12);
    expect(result?.z).toBeGreaterThan(2.326);
    expect(result?.rejectsNull).toBe(true);
  });
});
