import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { Vehicle } from '../../../../core/models/driver.model';
import { VehicleColorsStore } from '../../../../core/services/catalogs/vehicle-colors.store';
import { VehicleCard } from './vehicle-card';

const IBIZA: Vehicle = {
  id: 'v1',
  plate: '1234BGG',
  plateCountry: 'ES',
  brand: 'Seat',
  model: 'Ibiza',
  color: 'grey',
  engine: 'hybrid',
  capacity: 4,
  status: 'available',
  isDeclared: true,
};

describe('VehicleCard', () => {
  let fixture: ComponentFixture<VehicleCard>;

  function render(inputs: Partial<Record<'isSelected' | 'hasActions' | 'hasIcon', boolean>> = {}) {
    TestBed.configureTestingModule({
      imports: [VehicleCard],
      providers: [
        provideAppTransloco(),
        {
          provide: VehicleColorsStore,
          useValue: { label: () => 'Gris', swatch: () => '#808080' },
        },
      ],
    });
    fixture = TestBed.createComponent(VehicleCard);
    fixture.componentRef.setInput('vehicle', IBIZA);
    fixture.componentRef.setInput('groupName', 'vehicles');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the name, the plate and the specs', () => {
    const root = render();

    expect(root.querySelector('.vehicle-card__name')?.textContent).toBe('Seat Ibiza');
    expect(fixture.componentInstance.plate()).toBe('1234 BGG');
    expect(root.querySelector('.vehicle-card__specs')?.textContent).toContain('Gris');
    expect(root.querySelector('.vehicle-card__specs')?.textContent).toContain('4 plazas');
    expect(
      root.querySelector<HTMLElement>('.vehicle-card')?.style.getPropertyValue('--swatch-color'),
    ).toBe('#808080');
  });

  it('is chosen with its radio and marks itself when selected', () => {
    const root = render({ isSelected: true });
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    const radio = root.querySelector<HTMLInputElement>('input[type="radio"]');

    expect(radio?.name).toBe('vehicles');
    expect(radio?.checked).toBe(true);
    expect(root.querySelector('.vehicle-card--selected')).not.toBeNull();

    radio?.dispatchEvent(new Event('change'));
    expect(selected).toHaveBeenCalledWith(IBIZA);
  });

  it('has no actions and shows the car icon by default', () => {
    const root = render();

    expect(root.querySelectorAll('.vehicle-card__action')).toHaveLength(0);
    expect(root.querySelector('.vehicle-card__car')).not.toBeNull();
  });

  it('edits and removes from its buttons, named after the plate', () => {
    const root = render({ hasActions: true, hasIcon: false });
    const edit = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.remove.subscribe(remove);
    const [editButton, removeButton] = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.vehicle-card__action'),
    );

    expect(root.querySelector('.vehicle-card__car')).toBeNull();
    expect(editButton.getAttribute('aria-label')).toBe('Editar 1234BGG');
    expect(removeButton.getAttribute('aria-label')).toBe('Eliminar 1234BGG');

    editButton.click();
    removeButton.click();
    expect(edit).toHaveBeenCalledWith(IBIZA);
    expect(remove).toHaveBeenCalledWith(IBIZA);
  });
});
