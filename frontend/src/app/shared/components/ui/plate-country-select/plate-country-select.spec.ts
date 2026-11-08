import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideIonicAngular } from '@ionic/angular';
import { PlateCountrySelect } from './plate-country-select';

@Component({
  imports: [PlateCountrySelect, ReactiveFormsModule],
  template: '<app-plate-country-select [formControl]="country" />',
})
class HostForm {
  readonly country = new FormControl('PT');
}

describe('PlateCountrySelect', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(HostForm);
    fixture.detectChanges();
    const select = fixture.debugElement.children[0].componentInstance as PlateCountrySelect;
    return { fixture, select, root: fixture.nativeElement as HTMLElement };
  }

  it('shows the chosen country with its flag', () => {
    const { root } = render();

    const trigger = root.querySelector('.plate-country__trigger');
    expect(trigger?.textContent).toContain('Portugal');
    expect(trigger?.querySelector('.fi-pt')).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBe('País de la matrícula: Portugal');
  });

  it('writes the chosen country to the form and falls back to Spain', () => {
    const { fixture, select } = render();

    select.handleChoose('FR');
    expect(fixture.componentInstance.country.value).toBe('FR');

    fixture.componentInstance.country.setValue(null);
    expect(select.selected().code).toBe('ES');
  });

  it('disables the field with the form control', () => {
    const { fixture, root } = render();

    fixture.componentInstance.country.disable();
    fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('.plate-country__trigger')?.disabled).toBe(true);
  });
});
