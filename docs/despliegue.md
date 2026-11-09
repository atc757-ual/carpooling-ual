# Guía de despliegue

Pasos para poner en marcha el backend en un entorno nuevo (servidor de pruebas, demo o producción). Se ejecutan **en orden**; los comandos `npm run ...` se lanzan dentro de `backend/`.

## 1. Variables de entorno

Partir de [`.env.example`](../.env.example) y revisar en especial:

| Variable | Qué poner fuera de desarrollo |
| --- | --- |
| `DATABASE_URL` | La base de datos de ese entorno (nunca la de desarrollo) |
| `JWT_SECRET` | Un valor **aleatorio y distinto en cada entorno**, de al menos 32 caracteres. Nunca el de `.env.example` ni uno del repositorio. Para generarlo: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` |
| `API_DOCS_ENABLED` | `false` en producción si la documentación interactiva no debe ser pública; `true` en desarrollo y en la demo |
| `ALLOWED_EMAIL_DOMAINS` | Los dominios de la UAL (`ual.es,inlumine.ual.es`) |
| `MAIL_TRANSPORT` | `smtp` (envío real). `memory` solo en los tests: no envía nada |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | El servidor de correo de ese entorno (p. ej. el de la UAL o un proveedor): `SMTP_PORT=465` con `SMTP_SECURE=true`, o `587` con `false` (STARTTLS). **Nunca** el Mailpit de desarrollo (`localhost:1025`): los usuarios no recibirían el código |
| `SMTP_USER`, `SMTP_PASSWORD` | Las credenciales del servidor SMTP (los dos o ninguno). Son secretos: solo en el `.env` del servidor, nunca en el repositorio |
| `MAIL_FROM` | Un remitente del dominio del servidor SMTP, p. ej. `Carpooling UAL <no-reply@ual.es>`; si no, muchos servidores rechazan o marcan como spam los correos |
| `SUPPORT_EMAIL` | El buzón del equipo de soporte, que recibe los mensajes de «Ayuda y soporte» y responde al correo del usuario (p. ej. `soporte@ual.es`). Sin ella, llegan a `soporte@carpooling-ual.local` y en producción se pierden |
| `SMS_TRANSPORT` | En desarrollo y demo sin coste, `mailpit` (guarda el SMS en Mailpit con `X-Tags: SMS`); en tests, `memory`. **Pendiente para producción:** conectar el transporte del proveedor real de SMS cuando se contrate |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | La ruta del JSON de la cuenta de servicio de Firebase (Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada). **Es un secreto:** fuera del repositorio y con permisos solo para el usuario del servidor. Sin ella no se envían notificaciones push (los avisos siguen dentro de la app) |
| `PUSH_TRANSPORT` | Opcional: `fcm` (con la cuenta de servicio), `disabled` o `memory` (tests). Si se deja vacío, `fcm` con cuenta de servicio y `disabled` sin ella |
| `SMS_OTP_DOMAIN` | El dominio público de la app (p. ej. `carpooling.ual.es`) para que el móvil rellene el código por WebOTP (`@<dominio> #123456`); dejar vacío si no aplica |

Si `JWT_SECRET` o `DATABASE_URL` faltan o no son válidas, el servidor no arranca y explica por qué. Lo mismo con una configuración de correo incompleta (p. ej. `SMTP_USER` sin `SMTP_PASSWORD`).

Sin un servidor SMTP que funcione, el registro sigue funcionando pero **nadie recibe el código** y no puede iniciar sesión: comprobarlo en el paso 4.

## 2. Base de datos

    npm run migrate

Aplica las migraciones pendientes. Entre ellas van los escenarios de simulación S0–S5, así que el panel puede lanzar simulaciones sin más datos. **No** ejecutar `npm run seed` fuera de desarrollo: carga usuarios de prueba con la contraseña `carpooling`.

## 3. Primer administrador (solo la primera vez)

El perfil de administrador no se puede pedir en el registro (RF-01): el primero se crea en el despliegue.

    npm run create-admin -- --email=nombre@ual.es --first-name=Nombre --last-name="Apellido1 Apellido2"

- Genera una **contraseña aleatoria** y la muestra **una sola vez**: guardarla en ese momento en un gestor de contraseñas.
- El correo debe ser de un dominio permitido (`ALLOWED_EMAIL_DOMAINS`).
- Si ya existe un administrador, no hace nada: los siguientes los asigna un administrador desde el panel (RF-25).

## 4. Arranque y comprobación

    npm run build
    npm run start:prod

- `GET /api/health` debe responder `200` con `"database": "up"`.
- Iniciar sesión con el administrador del paso 3 (`POST /api/auth/login`). Se crea con el correo ya verificado: no necesita código.
- Registrar una cuenta de prueba (`POST /api/auth/register`) y comprobar que **llega el correo con el código**. Si no llega, revisar las variables `SMTP_*` y el log del servidor (`Could not send the verification code`). Después, borrar esa cuenta.

## 5. Servicios externos de mapas

- **Direcciones (CartoCiudad, IGN):** el backend lo llama directamente, sin clave. Hay que dejar salir el tráfico HTTPS hacia `www.cartociudad.es`. Su licencia exige citar «CartoCiudad cedido por © Instituto Geográfico Nacional» (la app ya lo muestra junto a las sugerencias).
- **Tiles del mapa (OpenStreetMap):** el navegador los pide a `tile.openstreetmap.org`, cuyo uso está limitado a tráfico moderado y con atribución (ya visible en el mapa). Para una demo vale; para un despliegue con usuarios reales, usar un servidor de tiles propio o un proveedor y cambiar `TILES_URL` en `location-modal.ts`.

## 6. Notificaciones push en la web

- **HTTPS obligatorio:** el navegador solo deja usar el *service worker* de las push (`push-sw.js`, en la raíz de la web) con HTTPS o en `localhost`.
- `push-sw.js` tiene que servirse desde la raíz del dominio (`/push-sw.js`) y **sin caché larga**, para que los navegadores recojan sus cambios.
- La configuración web de Firebase y la clave VAPID pública van en los `environment` del frontend (no son secretas). Si se cambia de proyecto de Firebase, hay que cambiarlas allí.
- **Comprobar:** en Mi perfil → Notificaciones, activarlas; con otra cuenta, pedir plaza en un viaje de la primera: le llega la push aunque tenga la pestaña cerrada (con el navegador abierto).

## 7. App Android (Capacitor)

La app nativa empaqueta el frontend (`frontend/www`) en `frontend/android/`. Hace falta Android Studio (trae el SDK, Java y `adb`).

**Para probarla con el backend del ordenador** (emulador o móvil por USB):

    cd frontend
    npm run build:android          # ng build --configuration android + cap sync android
    adb reverse tcp:3000 tcp:3000  # el localhost:3000 del móvil es el del ordenador
    npx cap open android           # y lanzarla desde Android Studio

- **API:** en la app, `/api` (relativa) no llega al backend. La configuración `android` (`environment.android.ts`) usa `http://localhost:3000/api`, que con `adb reverse` llega al backend en marcha del ordenador (`npm run dev`). Las peticiones salen por CapacitorHttp: sin CORS.
- **HTTP sin cifrar:** solo la versión de depuración lo permite (`android/app/src/debug/AndroidManifest.xml`); la de publicación exige HTTPS.
- **Avatares con imagen** (los subidos desde el panel): la WebView (`https://localhost`) no carga imágenes por HTTP, así que con el backend del ordenador no se ven. Con el servidor en HTTPS, sí.
- **Para publicarla** hará falta otra configuración con la dirección HTTPS del servidor.
- **Ubicación en segundo plano** (`@capgo/background-geolocation`): mientras el conductor comparte su ubicación, un servicio en primer plano con la notificación «Compartiendo tu ubicación» sigue enviándola con la app minimizada o la pantalla bloqueada. No usa `ACCESS_BACKGROUND_LOCATION` (no hace falta justificarlo en Google Play). `capacitor.config.ts` activa `android.useLegacyBridge` y `CapacitorHttp` para que no se pare a los 5 min en segundo plano.
- **Notificaciones push** (`@capacitor/push-notifications`): necesitan el `google-services.json` de la app Android del proyecto de Firebase en `frontend/android/app/` (Consola de Firebase → Configuración del proyecto → Tus apps → Android, con el id `es.ual.carpooling`). Está en el `.gitignore`: cada equipo que compile la app lo descarga. Sin él, la app compila pero activar las notificaciones falla. Llegan al canal «Viajes y mensajes» (`trips`), con el icono `ic_stat_notify`. En el emulador, usar una imagen con Google Play.
- **Comprobar en el móvil o el emulador:** que pide el permiso de ubicación y el de notificaciones, que al activar «Notificaciones» en Mi perfil llega la push de una solicitud con la app cerrada y que, al pulsarla, abre su pantalla, que aparece la notificación al iniciar un viaje y que el mapa del pasajero sigue moviéndose con la pantalla del conductor bloqueada.
