import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthLayout, AuthLayoutVariant } from './auth-layout';

@Component({
  imports: [AuthLayout],
  template: `
    <app-auth-layout [variant]="variant()">
      <p class="projected">Formulario</p>
      <p class="projected-top" authLayoutTop>Volver</p>
    </app-auth-layout>
  `,
})
class Host {
  readonly variant = signal<AuthLayoutVariant>('form');
}

describe('AuthLayout', () => {
  async function render(variant: AuthLayoutVariant): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.variant.set(variant);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function logoVariants(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('app-brand-logo')).map((logo) =>
      logo.classList.contains('brand-logo--tile') ? 'tile' : 'default',
    );
  }

  it('puts the content marked authLayoutTop above the logo', async () => {
    const top = (await render('form')).querySelector('.projected-top');

    expect(top?.nextElementSibling?.classList).toContain('auth-layout__brand');
  });

  it('puts the projected content between the logo and the trust footer', async () => {
    const projected = (await render('form')).querySelector('.projected');

    expect(projected?.previousElementSibling?.querySelector('app-brand-logo')).not.toBeNull();
    expect(projected?.nextElementSibling?.textContent).toContain(
      'Comunidad UAL · Perfiles verificados',
    );
  });

  it.each<AuthLayoutVariant>(['welcome', 'form'])(
    'shows the same brand message under the illustration on desktop (%s)',
    async (variant) => {
      const visual = (await render(variant)).querySelector('.auth-layout__visual');

      expect(visual?.querySelector('img')).not.toBeNull();
      expect(visual?.querySelector('.auth-layout__message')?.textContent).toContain(
        'Tu campus, mejor conectado.',
      );
    },
  );

  describe('welcome', () => {
    it('shows the default logo with the illustration under it on mobile', async () => {
      const root = await render('welcome');

      expect(logoVariants(root)).toEqual(['default']);
      expect(root.querySelector('.auth-layout__illustration')).not.toBeNull();
    });

    it('shows the footer on every screen size, without a separator', async () => {
      const footer = (await render('welcome')).querySelector('.auth-layout__footer');

      expect(footer?.classList).not.toContain('ion-hide-md-down');
      expect(footer?.classList).not.toContain('auth-layout__footer--separated');
      expect(footer?.textContent).toContain('Verificamos tu correo UAL');
    });
  });

  describe('form', () => {
    it('shows the tile logo on every screen size and no illustration', async () => {
      const root = await render('form');

      expect(logoVariants(root)).toEqual(['tile']);
      expect(root.querySelector('.auth-layout__illustration')).toBeNull();
    });

    it('shows the separated footer only on desktop', async () => {
      const footer = (await render('form')).querySelector('.auth-layout__footer');

      expect(footer?.classList).toContain('ion-hide-md-down');
      expect(footer?.classList).toContain('auth-layout__footer--separated');
      expect(footer?.textContent).toContain('espacio seguro para la comunidad universitaria');
    });
  });
});
