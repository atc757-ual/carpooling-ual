import { TestBed } from '@angular/core/testing';
import { SensitivityChart, sweepLayout, variantLabel } from './sensitivity-chart';
import { PENDING, SWEEP, variant } from './sweep.testing';

describe('sensitivity chart', () => {
  it('places one point per variant, higher the more vehicles avoided', () => {
    const { points } = sweepLayout(SWEEP.variants, 'ownCarShare');

    expect(points.map(({ label }) => label)).toEqual(['20 %', '30 %', '50 %']);
    expect(points[0].x).toBeLessThan(points[1].x);
    expect(points[2].y).toBeLessThan(points[0].y ?? 0);
    expect(points[0].ciTop).toBeLessThan(points[0].ciBottom ?? 0);
  });

  it('keeps the 15 % target inside the axis even when every value is lower', () => {
    const layout = sweepLayout([variant(0.1)], 'adoptionRate');

    expect(layout.ticks.at(-1)?.value).toBeGreaterThanOrEqual(15);
    expect(layout.targetY).toBeGreaterThanOrEqual(layout.ticks.at(-1)?.y ?? 0);
  });

  it('extends the axis below zero when an interval does', () => {
    const layout = sweepLayout(
      [variant(0.2, { vehiclesAvoidedPct: 1, vehiclesAvoidedCiLow: -3 })],
      'ownCarShare',
    );

    expect(layout.ticks[0].value).toBe(-3);
  });

  it('draws no point for a variant without results, but keeps its label', () => {
    const [point] = sweepLayout([variant(0.5, PENDING)], 'ownCarShare').points;

    expect(point.y).toBeNull();
    expect(point.ciTop).toBeNull();
    expect(point.tooltip).toBe('50 % en coche propio: sin resultados todavía');
  });

  it('describes each point in its tooltip', () => {
    const [point] = sweepLayout([variant(0.5)], 'adoptionRate').points;

    expect(point.tooltip).toBe(
      '50 % de adopción: 20 % de vehículos evitados (IC 95 %: 19–21 %), 60 % de solicitudes cubiertas, se rechaza HE0',
    );
    expect(variantLabel(0.35)).toBe('35 %');
  });

  it('fills the points where HE0 is rejected and leaves the rest hollow', () => {
    TestBed.configureTestingModule({ imports: [SensitivityChart] });
    const fixture = TestBed.createComponent(SensitivityChart);
    fixture.componentRef.setInput('variants', [variant(0.2), variant(0.5, { rejectsNull: false })]);
    fixture.componentRef.setInput('parameter', 'ownCarShare');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.sweep-chart__dot')).toHaveLength(2);
    expect(root.querySelectorAll('.sweep-chart__dot--rejects')).toHaveLength(1);
    expect(root.querySelector('.sweep-chart__title')?.textContent).toBe(
      'Vehículos evitados según el % en coche propio',
    );
    expect(root.querySelectorAll('title')).toHaveLength(2);
  });
});
