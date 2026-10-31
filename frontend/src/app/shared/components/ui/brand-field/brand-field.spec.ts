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

  it('starts closed and exposes the local brands through a native datalist', async () => {
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
    const datalist = fixture.nativeElement.querySelector('datalist') as HTMLDataListElement;
    expect(datalist.options.length).toBeGreaterThan(50);
    expect(datalist.options.item(datalist.options.length - 1)?.value).toBe('Otra');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    expect((await input().getInputElement()).getAttribute('list')).toBe(datalist.id);
  });

  it('filters brands and sends the selected brand through ControlValueAccessor', async () => {
    const changes: string[] = [];
    const change = vi.fn((value: string) => changes.push(value));
    component.registerOnChange(change);
    sendInput('sea');
    fixture.detectChanges();
    await fixture.whenStable();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll('datalist option'),
    ) as HTMLOptionElement[];
    expect(options.map((option) => option.value)).toEqual(['SEAT', 'Otra']);
    sendInput('SEAT');
    fixture.detectChanges();

    expect(changes).toEqual(['', 'SEAT']);
    expect(input().value).toBe('SEAT');
    expect(fixture.nativeElement.querySelector('.brand-field__dropdown')).toBeNull();
  });

  it('allows a free-text brand after choosing Otra', async () => {
    const changes: string[] = [];
    component.registerOnChange((value) => changes.push(value));
    sendInput('Otra');

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
