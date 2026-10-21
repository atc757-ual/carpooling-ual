import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

// Swagger UI (documentación interactiva) y el documento OpenAPI en JSON
export const API_DOCS_PATH = 'api/docs';
export const OPENAPI_JSON_PATH = 'api/docs/openapi.json';

// Documento OpenAPI generado a partir del código: los decoradores @Api* de los
// controllers y de los DTOs. Así la documentación no se desfasa del código
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Carpooling UAL API')
    .setDescription(
      'API REST del core-api (TFM, Universidad de Almería). Sigue TMF630: ' +
        'recursos con @type, errores con el objeto Error (códigos en ' +
        'docs/api/errors.md) y cabecera X-Request-Id en todas las respuestas.',
    )
    .setVersion('0.1.0')
    // Botón "Authorize" de Swagger UI: pegar el accessToken del login
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupApiDocs(app: INestApplication): void {
  SwaggerModule.setup(API_DOCS_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });
}
