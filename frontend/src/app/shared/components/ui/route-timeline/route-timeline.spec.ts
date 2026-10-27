import { TestBed } from '@angular/core/testing';
import { RouteStop, RouteTimeline } from './route-timeline';

describe('RouteTimeline', () => {
  function render(stops: RouteStop[]): HTMLElement {
    const fixture = TestBed.createComponent(RouteTimeline);
    fixture.componentRef.setInput('stops', stops);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

  it('shows each stop with its detail, the origin empty and the destination filled', () => {
    const root = render([
      { name: 'Roquetas de Mar', detail: 'Recogida' },
      { name: 'Campus UAL', detail: 'Ingreso norte' },
    ]);

    expect(texts(root, '.route-timeline__body')).toEqual([
      'Roquetas de MarRecogida',
      'Campus UALIngreso norte',
    ]);
    expect(root.querySelectorAll('.route-timeline__dot--end')).toHaveLength(1);
    expect(root.querySelector('.route-timeline__time')).toBeNull();
  });

  it('shows the time of each stop when it has one', () => {
    const root = render([
      { name: 'Roquetas de Mar', detail: 'Recogida', time: '07:40' },
      { name: 'Campus UAL', detail: 'Ingreso norte', time: '08:12' },
    ]);

    expect(texts(root, '.route-timeline__time')).toEqual(['07:40', '08:12']);
    expect(root.querySelector('.route-timeline--timed')).not.toBeNull();
  });
});
