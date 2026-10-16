## Descripción

Implementa el módulo de autenticación con registro y login de usuarios. Incluye validación de email, hash de contraseñas con bcrypt, y generación de JWT.

## Tipo de cambio

- [x] `feat`: nueva funcionalidad
- [ ] `fix`: corrección de bug
- [ ] `docs`: documentación
- [ ] `style`: formato sin cambio de lógica
- [ ] `refactor`: refactorización sin cambio de comportamiento
- [ ] `perf`: mejora de rendimiento
- [ ] `test`: tests añadidos o corregidos
- [ ] `build`: cambios en build o dependencias
- [ ] `ci`: cambios en CI/CD
- [ ] `chore`: mantenimiento
- [ ] `revert`: reversión de un commit anterior

## ¿Qué issue cierra?

Closes #1

## ¿Cómo probarlo?

1. Levantar el backend: `cd backend && npm run dev`
2. Ejecutar tests: `npm test`
3. Probar endpoint de registro: `POST /api/auth/register` con body `{ email, password, name }`
4. Probar endpoint de login: `POST /api/auth/login` con body `{ email, password }`
5. Verificar que devuelve un JWT válido

## Capturas / GIFs (si aplica)

No aplica (cambios en backend).

## Cambios importantes

- [x] Requiere migración de base de datos
- [x] Añade variables de entorno nuevas (documentadas en `.env.example`)
- [ ] Cambia la API pública (breaking change)
- [x] Actualiza dependencias (`bcrypt`, `jsonwebtoken`)
- [ ] Otro:

## Checklist del autor

- [x] La rama está actualizada con `dev` y sin conflictos
- [x] Lint, formato y tests pasan en local y en CI
- [x] Los commits siguen Conventional Commits
- [x] Sin `any`, sin imports sin usar, sin `console.log`
- [x] Tests añadidos o actualizados (cobertura ≥ 80 % en lógica de negocio)
- [x] Documentación/README/CHANGELOG actualizados si procede
- [x] Sin secretos ni datos sensibles
- [x] He leído mi propio diff en GitHub antes de pedir revisión

## Notas para el revisor

- El endpoint de registro devuelve 201 Created con el usuario creado (sin password).
- El endpoint de login devuelve 200 OK con `{ token, user }`.
- Los tests cubren casos de éxito y error (email duplicado, password débil).