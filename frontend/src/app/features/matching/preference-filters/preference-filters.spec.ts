import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { PreferenceFilter } from './preference-filter';
import { PreferenceFilters } from './preference-filters';

describe('PreferenceFilters', () => {
  function render(selected: PreferenceFilter[], resultCount = 3) {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(PreferenceFilters);
    fixture.componentRef.setInput('selected', new Set(selected));
    fixture.componentRef.setInput('resultCount', resultCount);
    fixture.detectChanges();
    return { fixture, filters: fixture.componentInstance };
  }

  it('shows the plain button without filters', () => {
    const { fixture } = render([]);
    const button = (fixture.nativeElement as HTMLElement).querySelector('ion-button');

    expect(button?.getAttribute('aria-label')).toBe('Filtros');
    expect(button?.querySelector('.preference-filters__count')).toBeNull();
  });

  it('counts the chosen filters on the button and opens the sheet', () => {
    const { fixture, filters } = render(['no_smoking', 'quiet']);
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('ion-button');

    expect(button?.getAttribute('aria-label')).toBe('Filtros, 2 elegidos');
    expect(button?.querySelector('.preference-filters__count')?.textContent).toBe('2');

    button?.click();
    expect(filters.isOpen()).toBe(true);
  });

  it('lists one checkbox per preference, marked when chosen, and passes on the changes', async () => {
    const { fixture, filters } = render(['pets'], 1);
    const toggled = vi.fn();
    const cleared = vi.fn();
    filters.toggled.subscribe(toggled);
    filters.cleared.subscribe(cleared);

    filters.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const sheet = document.querySelector('ion-modal') as HTMLElement;

    const items = [...sheet.querySelectorAll('ion-item')];
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Sin humo',
      'Admite mascotas',
      'Con música',
      'Con charla',
      'Tranquilo',
    ]);
    const boxes = sheet.querySelectorAll<HTMLIonCheckboxElement>('ion-checkbox');
    expect([...boxes].map((box) => box.checked)).toEqual([false, true, false, false, false]);
    expect(sheet.textContent).toContain('un conductor que no indicó esa preferencia no aparece');
    expect(sheet.textContent).toContain('Ver 1 viaje');

    boxes[4].dispatchEvent(new CustomEvent('ionChange'));
    expect(toggled).toHaveBeenCalledWith('quiet');

    const [clear, show] = sheet.querySelectorAll<HTMLElement>(
      '.preference-filters__actions ion-button',
    );
    clear.click();
    expect(cleared).toHaveBeenCalled();
    show.click();
    expect(filters.isOpen()).toBe(false);
  });
});
