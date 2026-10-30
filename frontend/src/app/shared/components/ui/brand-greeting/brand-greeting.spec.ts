import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BrandGreeting } from './brand-greeting';

describe('BrandGreeting', () => {
  function create(name = 'Ana'): ComponentFixture<BrandGreeting> {
    TestBed.configureTestingModule({ imports: [BrandGreeting] });
    const fixture = TestBed.createComponent(BrandGreeting);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    return fixture;
  }

  function words(fixture: ComponentFixture<BrandGreeting>): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.brand-greeting__word'),
    );
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the badge and starts with the brand name', () => {
    const fixture = create('Ana');
    const [brand, hello] = words(fixture);

    expect((fixture.nativeElement as HTMLElement).querySelector('app-brand-logo')).not.toBeNull();
    expect(brand.textContent).toContain('Carpool');
    expect(hello.textContent).toContain('¡Hola, Ana!');
    expect(hello.classList).toContain('brand-greeting__word--out');
  });

  it('turns the name into the greeting every five seconds', async () => {
    vi.useFakeTimers();
    const fixture = create('Ana');
    const [brand, hello] = words(fixture);

    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();

    expect(brand.classList).toContain('brand-greeting__word--out');
    expect(hello.classList).not.toContain('brand-greeting__word--out');

    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();

    expect(hello.classList).toContain('brand-greeting__word--out');
    expect(brand.classList).not.toContain('brand-greeting__word--out');
  });

  // Con «reducir movimiento» no se anima ni se cambia: se queda «Carpool»
  it('stays on the brand name when the system asks for less motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const fixture = create('Ana');

    vi.advanceTimersByTime(6000);
    fixture.detectChanges();

    expect(words(fixture)[1].classList).toContain('brand-greeting__word--out');
  });
});
