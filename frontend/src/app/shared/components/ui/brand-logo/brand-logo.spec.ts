import { TestBed } from '@angular/core/testing';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { BrandLogo, BrandLogoVariant } from './brand-logo';

describe('BrandLogo', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTestingSupport()] });
  });

  async function render(variant: BrandLogoVariant): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(BrandLogo);
    fixture.componentRef.setInput('variant', variant);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('reads as the app name for screen readers', async () => {
    const host = await render('default');

    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('UAL Carpool');
  });

  it('renders the car-sport icon in the badge', async () => {
    const host = await render('default');
    const badge = host.querySelector('.brand-logo__badge');
    expect(badge?.querySelector('ion-icon')).not.toBeNull();
  });

  it('shows the tagline only in the tile variant', async () => {
    expect((await render('default')).querySelector('.brand-logo__tagline')).toBeNull();

    const tile = await render('tile');
    expect(tile.classList).toContain('brand-logo--tile');
    expect(tile.querySelector('.brand-logo__tagline')?.textContent).toBe(
      'Sistema de movilidad compartida',
    );
  });

  it('has a compact variant without the tagline for the headers with session', async () => {
    const compact = await render('compact');

    expect(compact.classList).toContain('brand-logo--compact');
    expect(compact.querySelector('.brand-logo__tagline')).toBeNull();
  });
});
