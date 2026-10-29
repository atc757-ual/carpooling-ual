import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { SectionTitle } from './section-title';

describe('SectionTitle', () => {
  function render(data: object): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SectionTitle],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data } } }],
    });
    const fixture = TestBed.createComponent(SectionTitle);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the title and subtitle of the section from its route', () => {
    const root = render({ heading: { title: 'Buscar viaje', subtitle: 'Viajes de la UAL' } });

    expect(root.querySelector('h1')?.textContent).toBe('Buscar viaje');
    expect(root.textContent).toContain('Viajes de la UAL');
  });

  it('shows nothing without a heading', () => {
    expect(render({}).querySelector('h1')).toBeNull();
  });
});
