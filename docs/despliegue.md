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

Si `JWT_SECRET` o `DATABASE_URL` faltan o no son válidas, el servidor no arranca y explica por qué. Lo mismo con una configuración de correo incompleta (p. ej. `SMTP_USER` sin `SMTP_PASSWORD`).

Sin un servidor SMTP que funcione, el registro sigue funcionando pero **nadie recibe el código** y no puede iniciar sesión: comprobarlo en el paso 4.

## 2. Base de datos

    npm run migrate

Aplica las migraciones pendientes. **No** ejecutar `npm run seed` fuera de desarrollo: carga usuarios de prueba con la contraseña `carpooling`.

## 3. Primer administrador (solo la primera vez)

El perfil de administrador no se puede pedir en el registro (RF-01): el primero se crea en el despliegue.

    npm run create-admin -- --email=nombre@ual.es --name="Nombre Apellido"

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
