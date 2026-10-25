# Frontend - Carpooling UAL

Aplicación web y móvil en **Angular 22 + Ionic 9** (componentes *standalone*, sin Zone.js) empaquetable como app nativa con **Capacitor 8**.

## Requisitos

- Node.js en la versión indicada en `.nvmrc` (raíz del repositorio), la misma que usa el CI
- Para usar la API: el backend en marcha (`cd backend && npm run dev`)

## Uso

    npm install           # Instalar dependencias
    npm start             # Desarrollo con recarga automática (http://localhost:4200)
    npm run build         # Compilar a www/ (lo empaqueta Capacitor)
    npm test              # Tests (Vitest)
    npm run test:watch    # Tests al guardar
    npm run test:cov      # Tests con cobertura (mínimo 80 % de líneas)
    npm run lint          # ESLint (angular-eslint)
    npm run e2e           # Tests e2e (Cypress), con la app ya en marcha (npm start)
    npm run e2e:open      # Cypress con su ventana, para escribir y depurar tests

**API:** el frontend llama siempre a `/api` en su mismo dominio (`environment.apiUrl`). En desarrollo, `ng serve` la reenvía al backend en `http://localhost:3000` (`proxy.conf.json`); en producción lo hará Nginx. Así el navegador nunca hace peticiones a otro origen y el backend no necesita CORS.

## Estructura

    src/
    ├── app/
    │   ├── core/            Lo transversal, una sola instancia
    │   │   ├── guards/          Protección de rutas (*.guard.ts: sesión, perfiles)
    │   │   ├── interceptors/    Token de acceso y su renovación (*.interceptor.ts)
    │   │   ├── models/          Recursos de la API y errores (*.model.ts)
    │   │   ├── plugins/         Envoltorios de los plugins de Capacitor (*-plugin.ts)
    │   │   └── services/        Una subcarpeta por dominio: auth/, system/, ui/...
    │   ├── shared/          Reutilizable entre pantallas
    │   │   ├── components/      layout/, modals/, ui/
    │   │   └── utils/           Funciones puras (*.util.ts)
    │   ├── features/        Una carpeta por área, con sus pantallas (*.page.ts)
    │   │   └── auth/  trips/  requests/  matching/  admin/
    │   ├── app.config.ts    Proveedores globales (Ionic, router, HttpClient)
    │   ├── app.routes.ts    Rutas: cada pantalla se carga bajo demanda (loadComponent)
    │   └── app.ts           Raíz: <ion-app> + <ion-router-outlet>
    ├── environments/    Configuración por entorno (apiUrl)
    ├── theme/           Tema: colores, tipografía, tokens (entrada: variables.scss)
    └── styles.scss      Estilos globales
    public/              Ficheros estáticos (favicon, imágenes, fonts/)

## Sesión

`AuthService` (`core/services/auth/`) gestiona el registro, el login, el logout y la sesión contra `/api/auth`; su estado va en *signals* (`currentUser`, `isLoggedIn`, `hasProfile()`).

- **Tokens:** el de acceso (15 min) solo en memoria; el de renovación se guarda con Capacitor Preferences (almacenamiento nativo en el móvil, `localStorage` en la web) para recuperar la sesión al abrir la app (`provideAppInitializer`).
- **Renovación:** `authInterceptor` añade `Authorization: Bearer` a las peticiones a `/api` y, si el token ha caducado (`ACCESS_TOKEN_EXPIRED`), lo renueva y repite la petición una vez. Si la sesión ya no se puede renovar, lleva al login.
- **Una renovación a la vez:** el token de renovación es de un solo uso y el backend cierra la sesión si se reutiliza. Las peticiones simultáneas comparten la misma renovación y, en la web, las pestañas se turnan con la Web Locks API.
- **Guards:** `authGuard` (exige sesión; vuelve después a la página pedida con `?returnUrl=`), `profileGuard('driver')` (exige un perfil) y `guestGuard` (bienvenida, login y registro solo sin sesión).
- **Errores:** los services lanzan `ApiError` (código TMF630 de `docs/api/errors.md`, estado y campos); `getErrorMessage()` (`shared/utils/`) da el mensaje en español para el usuario.

## Pantallas de acceso

Bienvenida (`/auth/welcome`) y login (`/auth/login`), solo sin sesión (`guestGuard`). Se ajustan a la guía de estilos (sección «Pantallas de acceso»), que se revisa antes de hacer o cambiar cualquier pantalla.

- **`AuthLayout`** (`shared/components/layout/auth-layout/`): en escritorio (≥ 768px), a la izquierda y igual en todas, la ilustración con el lema; a la derecha, el logotipo, el contenido y el pie de confianza. En el móvil, una columna. `variant="welcome"` (ilustración y pie también en el móvil) o `"form"` (logotipo con lema). Lo marcado con `authLayoutTop` va encima del logotipo.
- **Cabecera:** en el móvil, `ion-header` con `ion-toolbar` (flecha y título); en escritorio, sin barra, la clase `top-bar` (flecha y título sobre el logotipo). La flecha es `ion-back-button` con la clase `back-button` (`theme/_components.scss`).
- **Espaciado:** 24px entre bloques, 16px entre botones seguidos, 20px dentro de un formulario.
- **Estilos comunes de los formularios** (título y texto, campo con su etiqueta, ojo de la contraseña, error y aviso): `features/auth/auth-form.scss`, que cada pantalla incluye en `styleUrls` junto a los suyos (clases `auth-intro`, `auth-form`, `auth-field`, `auth-password-toggle`, `auth-error`, `auth-notice`).
- **Formularios:** Reactive Forms con `ion-input`. La directiva `IonicFormStatus` (`shared/directives/`) copia el estado del control (`ion-invalid`, `ion-touched`…) a cada render: sin Zone.js, la copia que hace Ionic llega tarde y los errores no se ven. `ualEmailValidator()` (`shared/utils/ual-email.util.ts`) rechaza los correos de fuera de `environment.allowedEmailDomains` (los mismos que `ALLOWED_EMAIL_DOMAINS` del backend), para no llamar a la API con ellos.
- **Iconos:** `ionicons` (versión *outline*), pasando el icono importado: `[icon]="mailIcon"`.
- **Textos legales:** las condiciones de uso y la política de privacidad son fragmentos HTML en `public/legal/` (se editan ahí; ahora son provisionales). `LegalModal` (`shared/components/modals/`) los carga y los muestra; Angular limpia el HTML antes de mostrarlo.

## Tema

Guía visual con todos los valores: [docs/guia-estilos.html](../docs/guia-estilos.html) (se abre en el navegador).

- **Capas:** paleta (`_palette.scss`, solo Sass) → roles de color en claro y oscuro (`_roles.scss`: `--color-text`, `--color-primary`…) → variables de Ionic (`_ionic.scss`). Las pantallas usan los **roles y los tokens**, nunca la paleta: así el modo oscuro funciona sin tocarlas.
- **Modo oscuro:** sigue la preferencia del sistema; se puede forzar con la clase `theme-dark` o `theme-light` en `<html>`.
- **Tokens** (`_tokens.scss`): espaciado `--space-xs…xxxl`, esquinas `--radius-xs…xl` (por defecto `--radius-s`, 8px), bordes, alturas de controles (mínimo táctil 44px), tipografía y movimiento. Tamaños en `rem`.
- **Texto:** clases por papel (`.text-display`, `.text-title`, `.text-body`…, variante `--strong`); los títulos crecen con `clamp()`. Barlow para títulos y botones, Inter para el texto (`public/fonts/`, licencia OFL).
- **Contraste:** todos los pares de texto cumplen WCAG AA (≥ 4,5:1) en los dos modos.
- **Personalizar componentes de Ionic:** con sus variables CSS y `::part()`, sin `!important`. El aspecto por defecto (botones, barras, flecha atrás) está en `_components.scss`.

## Notas técnicas

- **Ionic 9:** los componentes se importan de `@ionic/angular` (en Ionic 8 era `@ionic/angular/standalone`, que ya no existe).
- **Sin Zone.js (zoneless):** el estado que cambia en un callback asíncrono (respuesta de la API, `setTimeout`, resultado de un modal) se guarda en *signals* para que la vista se actualice.
- **Tests:** Vitest con `jsdom` (sin navegador). Cada `*.spec.ts` va junto al fichero que prueba. El informe lcov usa rutas relativas a la raíz del repositorio para SonarCloud.
- **Tests e2e (Cypress):** en un navegador real, en `cypress/e2e/*.cy.ts`, cada pantalla en móvil (390px) y en escritorio (1280px). La API se simula con `cy.intercept`, así que no hace falta el backend. Desde la terminal de VS Code, Cypress no arranca (`bad option: --smoke-test`) porque VS Code define `ELECTRON_RUN_AS_NODE=1`: quitarla antes (`Remove-Item Env:ELECTRON_RUN_AS_NODE` en PowerShell, `unset ELECTRON_RUN_AS_NODE` en Git Bash) o usar otra terminal.
- **Capacitor:** `capacitor.config.ts` (`es.ual.carpooling`). Las plataformas (`npx cap add android`) y los plugins (p. ej. la geolocalización para el seguimiento del viaje) se añadirán cuando hagan falta.
- **Viewport:** sin zoom (como una app nativa), una decisión de experiencia de usuario.
