import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MailSender } from '../../src/shared/mail/mail-sender';
import { MemoryMailSender } from '../../src/shared/mail/memory-mail-sender';

// Teléfono válido para los registros de prueba (formato internacional E.164)
export const TEST_PHONE = '+34600123456';

export interface TestAccount {
  name: string;
  email: string;
  password: string;
  // Modos que elige después de registrarse (conductor y/o pasajero)
  profiles: string[];
}

// Buzón en memoria de la aplicación de pruebas (Jest pone NODE_ENV=test)
export function testMailbox(app: INestApplication<App>): MemoryMailSender {
  const mailSender = app.get(MailSender);
  if (!(mailSender instanceof MemoryMailSender)) {
    throw new Error('The tests need MAIL_TRANSPORT=memory');
  }
  return mailSender;
}

// Código de 6 cifras del último correo recibido por esa dirección, como lo
// leería el usuario
export function lastCodeSentTo(
  app: INestApplication<App>,
  email: string,
): string {
  const code = /\b\d{6}\b/.exec(testMailbox(app).lastSentTo(email)?.text ?? '');
  if (code === null) {
    throw new Error(`No verification code was sent to ${email}`);
  }
  return code[0];
}

// Alta de un usuario por la API, como lo hará la app: registro público
// (teléfono y normas, sin perfiles), verificación del correo con el código
// recibido (abre la sesión) y elección de cada modo
// (PUT /api/users/me/profiles/{profile}). Devuelve el id. Para tener un token
// con los perfiles, hay que iniciar sesión después
export async function registerUser(
  app: INestApplication<App>,
  account: TestAccount,
): Promise<string> {
  const server = app.getHttpServer();
  const registered = await request(server)
    .post('/api/auth/register')
    .send({
      name: account.name,
      email: account.email,
      password: account.password,
      phone: TEST_PHONE,
      acceptedTerms: true,
    })
    .expect(201);
  const verified = await request(server)
    .post('/api/auth/verify-email')
    .send({
      email: account.email,
      code: lastCodeSentTo(app, account.email),
    })
    .expect(200);
  const { accessToken } = verified.body as { accessToken: string };
  // A la vez: el backend bloquea la fila del usuario y las hace por turnos
  await Promise.all(
    account.profiles.map((profile) =>
      request(server)
        .put(`/api/users/me/profiles/${profile}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200),
    ),
  );
  return (registered.body as { id: string }).id;
}
