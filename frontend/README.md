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
    │   │   ├── guards/          Protección de rutas (sesión, perfiles)
    │   │   ├── interceptors/    Token de acceso, errores TMF630
    │   │   ├── models/          Recursos de la API (Trip, SeatRequest...)
    │   │   └── services/        Acceso a la API y estado de la sesión
    │   ├── shared/          Reutilizable entre pantallas
    │   │   ├── components/      Layouts y componentes de interfaz
    │   │   └── utils/
    │   ├── features/        Una carpeta por área, con sus pantallas (*.page.ts)
    │   │   └── auth/  trips/  requests/  matching/  admin/
    │   ├── app.config.ts    Proveedores globales (Ionic, router, HttpClient)
    │   ├── app.routes.ts    Rutas: cada pantalla se carga bajo demanda (loadComponent)
    │   └── app.ts           Raíz: <ion-app> + <ion-router-outlet>
    ├── environments/    Configuración por entorno (apiUrl)
    ├── theme/           Tema de Ionic (variables.scss)
    └── styles.scss      Estilos globales
    public/              Ficheros estáticos (favicon, imágenes)

## Notas técnicas

- **Ionic 9:** los componentes se importan de `@ionic/angular` (en Ionic 8 era `@ionic/angular/standalone`, que ya no existe).
- **Sin Zone.js (zoneless):** el estado que cambia en un callback asíncrono (respuesta de la API, `setTimeout`, resultado de un modal) se guarda en *signals* para que la vista se actualice.
- **Tests:** Vitest con `jsdom` (sin navegador). Cada `*.spec.ts` va junto al fichero que prueba. El informe lcov usa rutas relativas a la raíz del repositorio para SonarCloud.
- **Capacitor:** `capacitor.config.ts` (`es.ual.carpooling`). Las plataformas (`npx cap add android`) y los plugins (p. ej. la geolocalización para el seguimiento del viaje) se añadirán cuando hagan falta.
- **Viewport:** sin zoom (como una app nativa), una decisión de experiencia de usuario.
