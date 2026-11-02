import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { TripProgress } from './trip-progress';

describe('TripProgress', () => {
  function render(status: 'published' | 'confirmed' | 'in_progress' | 'finished'): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripProgress],
      providers: [provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(TripProgress);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('marks the status of the trip as the current step, without going back', () => {
    const root = render('in_progress');

    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Progreso del viaje');
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('En curso');
    expect(root.querySelectorAll('.steps__item--done')).toHaveLength(2);
    expect(root.querySelector('button')).toBeNull();
  });

  it('shows every step done once the trip is finished', () => {
    const root = render('finished');

    expect(root.querySelectorAll('.steps__item--done')).toHaveLength(4);
  });
});
