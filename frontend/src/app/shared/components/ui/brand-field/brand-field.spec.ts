import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { BrandField } from './brand-field';

describe('BrandField', () => {
  let fixture: ComponentFixture<BrandField>;
  let component: BrandField;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BrandField], providers: [provideIonicAngular()] });
    fixture = TestBed.createComponent(BrandField);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('starts closed and shows the local brand options when the search is activated', async () => {
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();

    input().click();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    expect(options.length).toBeGreaterThan(50);
    expect(options.at(-1)?.textContent?.trim()).toBe('Otra');
  });

  it('filters brands and sends the selected brand through ControlValueAccessor', async () => {
    const changes: string[] = [];
    const change = vi.fn((value: string) => changes.push(value));
    component.registerOnChange(change);
    input().click();
    sendInput('seat');
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['SEAT', 'Otra']);
    options[0].click();
    fixture.detectChanges();

    expect(changes).toEqual(['', 'SEAT']);
    expect(input().value).toBe('SEAT');
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
  });

  it('allows a free-text brand after choosing Otra', async () => {
    const changes: string[] = [];
    component.registerOnChange((value) => changes.push(value));
    input().click();
    fixture.detectChanges();
    const options = Array.from(
      fixture.nativeElement.querySelectorAll('[role="option"]'),
    ) as HTMLElement[];
    options.at(-1)?.click();
    fixture.detectChanges();

    expect(input().placeholder).toBe('Escribe la marca');
    sendInput('Rivian');

    expect(changes).toEqual(['', 'Rivian']);
    expect(input().value).toBe('Rivian');
  });

  it('shows a legacy free-text brand provided by the form', () => {
    component.writeValue('Rivian');
    fixture.detectChanges();

    expect(input().placeholder).toBe('Escribe la marca');
    expect(input().value).toBe('Rivian');
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
  });

  function input(): HTMLIonInputElement {
    return fixture.nativeElement.querySelector('ion-input') as HTMLIonInputElement;
  }

  function sendInput(value: string): void {
    input().dispatchEvent(
      new CustomEvent('ionInput', { bubbles: true, composed: true, detail: { value } }),
    );
    fixture.detectChanges();
  }
});
