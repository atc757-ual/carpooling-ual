import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ActiveModeService, TravelMode } from '../../../../core/services/users/active-mode.service';
import { ModeSelector } from './mode-selector';

describe('ModeSelector', () => {
  const mode = signal<TravelMode | null>('passenger');
  const hasBothModes = signal(true);
  const setMode = vi.fn().mockResolvedValue(undefined);

  function render(variant: 'inline' | 'card' = 'inline'): ComponentFixture<ModeSelector> {
    TestBed.configureTestingModule({
      imports: [ModeSelector],
      providers: [
        provideIonicAngular(),
        { provide: ActiveModeService, useValue: { mode, hasBothModes, setMode } },
      ],
    });
    const fixture = TestBed.createComponent(ModeSelector);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<ModeSelector>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    mode.set('passenger');
    hasBothModes.set(true);
    setMode.mockClear();
  });

  it('shows the active mode', () => {
    expect(text(render())).toContain('Modo: Pasajero');
  });

  it('is not shown with a single profile', () => {
    hasBothModes.set(false);

    expect((render().nativeElement as HTMLElement).querySelector('ion-select')).toBeNull();
  });

  it('changes the mode', () => {
    const fixture = render();

    fixture.componentInstance.handleModeChange('driver');

    expect(setMode).toHaveBeenCalledWith('driver');
  });

  it('shows the enabled profiles only in the card', () => {
    expect(text(render('card'))).toContain('Perfiles habilitados');
    TestBed.resetTestingModule();
    expect(text(render('inline'))).not.toContain('Perfiles habilitados');
  });
});
