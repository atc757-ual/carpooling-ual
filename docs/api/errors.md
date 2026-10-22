# Catálogo de códigos de error

Todas las APIs responden a los errores con el objeto `Error` de **TMF630** (TM Forum REST API Design Guidelines):

```json
{
  "@type": "Error",
  "code": "EMAIL_ALREADY_REGISTERED",
  "reason": "Email already registered",
  "message": "The email ana@ual.es is already registered",
  "status": "409"
}
```

- **`code`:** identificador estable del error. El frontend decide qué hacer a partir de él, nunca a partir del texto.
- **`reason`:** explicación breve del código.
- **`message`:** detalle del caso concreto.
- **`status`:** código HTTP, como texto.

Si los datos de entrada no son válidos, se responde con el tipo derivado **`ValidationError`**, que lista **todos** los campos que fallan (un elemento por regla incumplida):

```json
{
  "@type": "ValidationError",
  "@baseType": "Error",
  "code": "VALIDATION_FAILED",
  "reason": "Validation failed",
  "message": "The request has invalid fields",
  "status": "400",
  "fields": [
    { "field": "email", "reason": "email must be an email" },
    { "field": "password", "reason": "password must be longer than or equal to 8 characters" }
  ]
}
```

Todas las respuestas llevan la cabecera **`X-Request-Id`**. Si el cliente la envía (letras, números, `_`, `.` y `-`, hasta 128 caracteres), se reutiliza; si no, se genera un UUID. Ante un `INTERNAL_ERROR`, el mismo id aparece en el log del servidor junto al detalle del fallo.

## Genéricos

| `code` | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Datos de entrada no válidos o campos no permitidos (`ValidationError` con la lista `fields`) |
| `INTERNAL_ERROR` | 500 | Fallo inesperado. Nunca incluye detalles internos; `message` lleva la referencia (`X-Request-Id`) |
| `NOT_FOUND` | 404 | La ruta no existe |
| `SERVICE_UNAVAILABLE` | 503 | `GET /api/health`: la base de datos no responde |
| *Nombre del status HTTP* | 4xx/5xx | Otros errores de NestJS: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`… |

## Autenticación (`auth`, `users`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `EMAIL_ALREADY_REGISTERED` | 409 | Registro con un correo que ya existe (sin distinguir mayúsculas) |
| `EMAIL_DOMAIN_NOT_ALLOWED` | 400 | Registro con un correo que no es de un dominio permitido (`ALLOWED_EMAIL_DOMAINS`) |
| `INVALID_CREDENTIALS` | 401 | Login con correo o contraseña incorrectos (el mismo error en los dos casos) |
| `INVALID_ACCESS_TOKEN` | 401 | Ruta protegida sin `Authorization: Bearer <token>`, con un token mal formado o de firma no válida, o cuyo usuario ya no existe |
| `ACCESS_TOKEN_EXPIRED` | 401 | El token de acceso ha caducado: hay que renovarlo, no volver a pedir la contraseña |
| `INVALID_REFRESH_TOKEN` | 401 | Renovación con un token de renovación inexistente, caducado, anulado (logout) o ya usado. Reutilizar uno ya usado cierra además toda la sesión. Hay que volver a iniciar sesión |

## Permisos y usuarios

| `code` | HTTP | Cuándo |
|---|---|---|
| `PROFILE_REQUIRED` | 403 | El usuario está autenticado pero no tiene el perfil que exige la acción (p. ej. consultar otro usuario sin ser administrador). `message` indica los perfiles necesarios |
| `USER_NOT_FOUND` | 404 | `GET /api/users/{id}` de un administrador con un id que no existe. A quien no es administrador se le responde `PROFILE_REQUIRED`, para no revelar qué ids existen |

## Vehículos (`users`)

| `code` | HTTP | Cuándo |
|---|---|---|
| `VEHICLE_ALREADY_REGISTERED` | 409 | La matrícula ya está registrada por otro conductor, o activa por el mismo. Si el mismo conductor la había dado de baja, se reactiva en vez de dar error |
| `VEHICLE_NOT_FOUND` | 404 | El vehículo no existe, está dado de baja o es de otro conductor (no se distingue, para no revelar qué ids existen) |
| `VEHICLE_IN_USE` | 409 | Baja de un vehículo que está en un viaje en curso |

## Cómo añadir un código

1. Crea el error de negocio extendiendo `BusinessError` (`backend/src/shared/errors/business-error.ts`) con su `code` y su tipo de fallo: `invalid` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404) o `conflict` (409).
2. Añádelo a la tabla de su módulo en este documento.
