import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { StepIndicator } from './step-indicator';

const STEPS = ['Trayecto', 'Vehículo', 'Revisión', 'Publicado'];

describe('StepIndicator', () => {
  let fixture: ComponentFixture<StepIndicator>;

  function render(current: number, isComplete = false): HTMLElement {
    TestBed.configureTestingModule({
      imports: [StepIndicator],
      providers: [provideIonicAngular()],
    });
    fixture = TestBed.createComponent(StepIndicator);
    fixture.componentRef.setInput('steps', STEPS);
    fixture.componentRef.setInput('current', current);
    fixture.componentRef.setInput('isComplete', isComplete);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('marks the current step and lets go back only to the done ones', () => {
    const root = render(3);
    const selected: number[] = [];
    fixture.componentInstance.selected.subscribe((step) => selected.push(step));

    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('Revisión');
    const buttons = root.querySelectorAll<HTMLButtonElement>('button.steps__button');
    expect(Array.from(buttons, (button) => button.textContent?.trim())).toEqual([
      'Trayecto',
      'Vehículo',
    ]);

    buttons[1].click();

    expect(selected).toEqual([2]);
  });

  it('shows every step done and none to go back to once complete', () => {
    const root = render(4, true);

    expect(root.querySelectorAll('.steps__item--done')).toHaveLength(4);
    expect(root.querySelector('button')).toBeNull();
  });
});
