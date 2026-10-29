import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { MessagesPage } from './messages.page';

describe('MessagesPage', () => {
  it('tells that messages are coming soon', () => {
    TestBed.configureTestingModule({
      imports: [MessagesPage],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(MessagesPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Muy pronto podrás escribir aquí',
    );
  });
});
