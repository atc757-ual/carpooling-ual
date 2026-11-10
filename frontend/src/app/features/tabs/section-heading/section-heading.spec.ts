import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { SectionHeading } from './section-heading';

describe('SectionHeading', () => {
  function render(data: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SectionHeading],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data } } }],
    });
    const fixture = TestBed.createComponent(SectionHeading);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the title and subtitle of its route, only on mobile', () => {
    const root = render({
      heading: {
        title: 'Tus viajes',
        subtitle: 'Tus viajes y solicitudes.',
        scrollsWithContent: true,
      },
    });

    expect(root.querySelector('h1')?.textContent).toBe('Tus viajes');
    expect(root.querySelector('p')?.textContent?.trim()).toBe('Tus viajes y solicitudes.');
    expect(root.classList).toContain('ion-hide-md-up');
  });

  it('shows nothing when the fixed strip already has the title (no repeated heading)', () => {
    const root = render({ heading: { title: 'Conversación', subtitle: 'Con quien conduce.' } });

    expect(root.querySelector('h1')).toBeNull();
  });

  it('shows nothing without a heading', () => {
    expect(render({}).querySelector('h1')).toBeNull();
  });
});
