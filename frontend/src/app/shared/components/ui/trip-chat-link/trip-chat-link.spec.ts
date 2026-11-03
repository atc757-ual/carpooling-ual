import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripChatLink } from './trip-chat-link';

describe('TripChatLink', () => {
  it('opens the chat of the trip in Mensajes', () => {
    TestBed.configureTestingModule({
      imports: [TripChatLink],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(TripChatLink);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('expand', 'block');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('ion-button');
    expect(button?.textContent).toContain('Chat del viaje');
    expect((button as unknown as { expand?: string } | null)?.expand).toBe('block');
    button?.click();

    const [url] = navigate.mock.calls[0];
    expect(TestBed.inject(Router).serializeUrl(url as never)).toBe('/tabs/messages/t1');
  });
});
