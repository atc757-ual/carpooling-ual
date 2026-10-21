import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';
import { CreateAdminDto } from './modules/auth/dto/create-admin.dto';
import { BusinessError } from './shared/errors/business-error';
import { toFieldErrors } from './shared/http/validation';

// npm run create-admin -- --email=ana@ual.es --name="Ana García"
// Crea el PRIMER administrador en el despliegue (RF-01). Si ya hay uno, no
// hace nada. La contraseña se genera aleatoria y se muestra UNA sola vez.
// Solo lee los argumentos y llama a AuthService: la regla está en el service
const USAGE =
  'Uso: npm run create-admin -- --email=ana@ual.es --name="Ana García"';

async function createAdmin(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });
  const input = plainToInstance(CreateAdminDto, values);
  const invalidFields = toFieldErrors(validateSync(input));
  if (invalidFields.length > 0) {
    const reasons = invalidFields.map(({ reason }) => `  - ${reason}`);
    fail([USAGE, ...reasons].join('\n'));
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const { user, password } = await app
      .get(AuthService)
      .createFirstAdmin(input);
    process.stdout.write(
      [
        `Administrador creado: ${user.name} <${user.email}>`,
        `Contraseña: ${password}`,
        'Guárdala ahora en un lugar seguro: no se volverá a mostrar.',
        '',
      ].join('\n'),
    );
  } catch (error) {
    // Errores de negocio (ya hay un admin, dominio no permitido, correo
    // repetido): se explican sin traza. Cualquier otro error sí se lanza
    if (!(error instanceof BusinessError)) {
      throw error;
    }
    fail(`No se ha creado el administrador: ${error.message}`);
  } finally {
    await app.close();
  }
}

function fail(message: string): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

void createAdmin();
