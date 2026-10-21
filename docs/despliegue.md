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

Si `JWT_SECRET` o `DATABASE_URL` faltan o no son válidas, el servidor no arranca y explica por qué.

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
- Iniciar sesión con el administrador del paso 3 (`POST /api/auth/login`).
