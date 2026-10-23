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

## Tema

Guía visual con todos los valores: [docs/guia-estilos.html](../docs/guia-estilos.html) (se abre en el navegador).

- **Capas:** paleta (`_palette.scss`, solo Sass) → roles de color en claro y oscuro (`_roles.scss`: `--color-text`, `--color-primary`…) → variables de Ionic (`_ionic.scss`). Las pantallas usan los **roles y los tokens**, nunca la paleta: así el modo oscuro funciona sin tocarlas.
- **Modo oscuro:** sigue la preferencia del sistema; se puede forzar con la clase `theme-dark` o `theme-light` en `<html>`.
- **Tokens** (`_tokens.scss`): espaciado `--space-xs…xxxl`, esquinas `--radius-xs…xl` (por defecto `--radius-s`, 8px), bordes, alturas de controles (mínimo táctil 44px), tipografía y movimiento. Tamaños en `rem`.
- **Texto:** clases por papel (`.text-display`, `.text-title`, `.text-body`…, variante `--strong`); los títulos crecen con `clamp()`. Barlow para títulos y botones, Inter para el texto (`public/fonts/`, licencia OFL).
- **Contraste:** todos los pares de texto cumplen WCAG AA (≥ 4,5:1) en los dos modos.
- **Personalizar componentes de Ionic:** con sus variables CSS y `::part()`, sin `!important`.

## Notas técnicas

- **Ionic 9:** los componentes se importan de `@ionic/angular` (en Ionic 8 era `@ionic/angular/standalone`, que ya no existe).
- **Sin Zone.js (zoneless):** el estado que cambia en un callback asíncrono (respuesta de la API, `setTimeout`, resultado de un modal) se guarda en *signals* para que la vista se actualice.
- **Tests:** Vitest con `jsdom` (sin navegador). Cada `*.spec.ts` va junto al fichero que prueba. El informe lcov usa rutas relativas a la raíz del repositorio para SonarCloud.
- **Capacitor:** `capacitor.config.ts` (`es.ual.carpooling`). Las plataformas (`npx cap add android`) y los plugins (p. ej. la geolocalización para el seguimiento del viaje) se añadirán cuando hagan falta.
- **Viewport:** sin zoom (como una app nativa), una decisión de experiencia de usuario.
