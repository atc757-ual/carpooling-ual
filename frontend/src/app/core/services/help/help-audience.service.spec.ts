import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActiveModeService, TravelMode } from '../users/active-mode.service';
import { HelpAudienceService } from './help-audience.service';

describe('HelpAudienceService', () => {
  function setUp(mode: TravelMode | null): {
    help: HelpAudienceService;
    activeMode: ReturnType<typeof signal<TravelMode | null>>;
  } {
    const activeMode = signal<TravelMode | null>(mode);
    TestBed.configureTestingModule({
      providers: [{ provide: ActiveModeService, useValue: { mode: activeMode } }],
    });
    return { help: TestBed.inject(HelpAudienceService), activeMode };
  }

  it('starts with the mode of the app', () => {
    expect(setUp('driver').help.audience()).toBe('driver');
  });

  it('starts with the passenger questions without a mode', () => {
    expect(setUp(null).help.audience()).toBe('passenger');
  });

  it('keeps the choice without changing the mode of the app', () => {
    const { help, activeMode } = setUp('passenger');

    help.select('driver');

    expect(help.audience()).toBe('driver');
    expect(activeMode()).toBe('passenger');
  });
});
