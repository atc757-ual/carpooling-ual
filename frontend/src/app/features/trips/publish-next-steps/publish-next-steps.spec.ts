import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { PublishNextSteps } from './publish-next-steps';

describe('PublishNextSteps', () => {
  function render(isPublished: boolean): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PublishNextSteps],
      providers: [provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(PublishNextSteps);
    fixture.componentRef.setInput('isPublished', isPublished);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('explains what happens next while reviewing', () => {
    const root = render(false);

    expect(root.textContent).toContain('¿Qué pasa después?');
    expect(root.querySelectorAll('.next-steps__list li')).toHaveLength(3);
    expect(root.textContent).not.toContain('Gracias por compartir tu coche');
  });

  it('thanks the driver once the trip is published', () => {
    const root = render(true);

    expect(root.textContent).toContain('Gracias por compartir tu coche');
    expect(root.querySelectorAll('.next-steps__community-list li')).toHaveLength(3);
  });
});
