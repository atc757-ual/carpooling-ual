import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LicensePlate } from './license-plate';

describe('LicensePlate', () => {
  it('renders the plate number and hidden text for screen readers', () => {
    const fixture = TestBed.createComponent(LicensePlate);
    fixture.componentRef.setInput('plate', '1234 BCD');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.visually-hidden')?.textContent?.trim()).toBe('Matrícula 1234 BCD');
    expect(root.querySelector('.license-plate__number')?.textContent?.trim()).toBe('1234 BCD');
  });

  it('draws the 12 stars and the default country E', () => {
    const fixture = TestBed.createComponent(LicensePlate);
    fixture.componentRef.setInput('plate', '1234 BCD');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const stars = root.querySelectorAll('.license-plate__star');
    expect(stars).toHaveLength(12);

    const country = root.querySelector('.license-plate__country');
    expect(country?.textContent?.trim()).toBe('E');
  });

  it('accepts a custom country code', () => {
    const fixture = TestBed.createComponent(LicensePlate);
    fixture.componentRef.setInput('plate', 'AA-123-BB');
    fixture.componentRef.setInput('country', 'F');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const country = root.querySelector('.license-plate__country');
    expect(country?.textContent?.trim()).toBe('F');
  });
});
