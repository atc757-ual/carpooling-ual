import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { ActiveModeService, TravelMode } from '../../../../core/services/users/active-mode.service';
import { ModeSelector } from './mode-selector';

describe('ModeSelector', () => {
  const mode = signal<TravelMode | null>('passenger');
  const hasBothModes = signal(true);
  const setMode = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);

  function render(): ComponentFixture<ModeSelector> {
    TestBed.configureTestingModule({
      imports: [ModeSelector],
      providers: [
        provideIonicAngular(),
        { provide: ActiveModeService, useValue: { mode, hasBothModes, setMode } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    const fixture = TestBed.createComponent(ModeSelector);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    mode.set('passenger');
    hasBothModes.set(true);
    setMode.mockClear();
  });

  it('offers both modes in a card, with the active one selected', () => {
    const root = render().nativeElement as HTMLElement;

    expect(root.textContent).toContain('¿Cómo viajas hoy?');
    expect(root.querySelectorAll('ion-segment-button')).toHaveLength(2);
    expect((root.querySelector('ion-segment') as HTMLIonSegmentElement).value).toBe('passenger');
  });

  it('is not shown with a single profile', () => {
    hasBothModes.set(false);

    expect((render().nativeElement as HTMLElement).querySelector('ion-segment')).toBeNull();
  });

  it('changes the mode', () => {
    render().componentInstance.handleModeChange('driver');

    expect(setMode).toHaveBeenCalledWith('driver');
  });

  it('ignores a value that is not a mode', async () => {
    await render().componentInstance.handleModeChange('admin');

    expect(setMode).not.toHaveBeenCalled();
  });

  it('tells when the mode could not be kept', async () => {
    setMode.mockRejectedValueOnce(new Error('down'));

    await render().componentInstance.handleModeChange('driver');

    expect(showError).toHaveBeenCalled();
  });
});
