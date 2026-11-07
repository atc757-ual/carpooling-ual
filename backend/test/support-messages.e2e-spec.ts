import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { MailConfig } from '../src/config/mail.config';
import { registerUser, testMailbox } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// «Ayuda y soporte» de punta a punta: el mensaje de un usuario llega por
// correo al buzón de soporte, con respuesta a su correo. Los usuarios llevan
// el prefijo EMAIL_PREFIX y se borran después de cada test
const EMAIL_PREFIX = 'support-e2e-';
const ANA = `${EMAIL_PREFIX}ana@ual.es`;
const PASSWORD = 'secret-password';
const MESSAGE = 'El conductor no ha llegado al punto de recogida <b>hoy</b>.';

describe('Support messages API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let supportTo: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    supportTo = app.get(ConfigService).getOrThrow<MailConfig>('mail').supportTo;
  });

  beforeEach(async () => {
    await registerUser(app, {
      name: 'Ana',
      email: ANA,
      password: PASSWORD,
      profiles: ['passenger'],
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ANA, password: PASSWORD })
      .expect(200);
    accessToken = (login.body as { accessToken: string }).accessToken;
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function send(body: object, token = accessToken): request.Test {
    return request(app.getHttpServer())
      .post('/api/support/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('emails the message to the support mailbox, replying to the user', async () => {
    await send({ topic: 'trip', message: MESSAGE }).expect(202);

    const mail = testMailbox(app).lastSentTo(supportTo);
    expect(mail).toMatchObject({
      replyTo: ANA,
      subject: '[Soporte] Un viaje · Ana Prueba',
    });
    expect(mail?.text).toContain(MESSAGE);
    expect(mail?.html).toContain('&lt;b&gt;hoy&lt;/b&gt;');
    expect(mail?.html).not.toContain('<b>hoy</b>');
  });

  it('rejects an unknown topic or a too short message', async () => {
    await send({ topic: 'spam', message: MESSAGE }).expect(400);
    await send({ topic: 'bug', message: 'Muy corto' })
      .expect(400)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'VALIDATION_FAILED' }),
      );
  });

  it('requires a session and sends nothing without it', async () => {
    const sentBefore = testMailbox(app).sentTo(supportTo).length;

    const response = await send(
      { topic: 'other', message: MESSAGE },
      'not-a-token',
    );

    expect(response.status).toBe(401);
    expect(testMailbox(app).sentTo(supportTo)).toHaveLength(sentBefore);
  });
});
