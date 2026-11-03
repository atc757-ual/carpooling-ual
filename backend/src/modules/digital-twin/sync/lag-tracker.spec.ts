import { LAG_SAMPLES_LIMIT, LagTracker } from './lag-tracker';

describe('LagTracker', () => {
  it('has no figures without samples', () => {
    expect(new LagTracker().stats()).toEqual({
      samples: 0,
      lastMs: null,
      p95Ms: null,
      maxMs: null,
    });
  });

  it('gives the last, the p95 and the max', () => {
    const lag = new LagTracker();
    for (let ms = 100; ms >= 1; ms -= 1) {
      lag.record(ms);
    }

    expect(lag.stats()).toEqual({
      samples: 100,
      lastMs: 1,
      p95Ms: 95,
      maxMs: 100,
    });
  });

  it('takes a negative lag (clocks apart) as zero', () => {
    const lag = new LagTracker();
    lag.record(-20);

    expect(lag.stats().lastMs).toBe(0);
  });

  it('keeps only the latest samples', () => {
    const lag = new LagTracker();
    lag.record(5000);
    for (let index = 0; index < LAG_SAMPLES_LIMIT; index += 1) {
      lag.record(10);
    }

    expect(lag.stats()).toMatchObject({
      samples: LAG_SAMPLES_LIMIT,
      maxMs: 10,
    });
  });
});
