import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  pngHeader,
  webpLosslessHeader,
} from '../src/modules/users/avatar-image.testing';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Avatares subidos desde el panel: PNG o WebP comprobados por su contenido,
// servidos sin sesión y gestionados como un catálogo. Los usuarios llevan el
// prefijo EMAIL_PREFIX; los avatares del test, nombres que empiezan por «E2E
// Avatar» (clave e2e-avatar-…). Se borran al terminar con sus eventos
const EMAIL_PREFIX = 'admin-avatars-e2e-';
const PASSWORD = 'secret-password';
const AVATAR_KEYS = "key LIKE 'e2e-avatar-%'";

interface Avatar {
  id: string;
  name: string;
  svg: string | null;
  imageHref: string | null;
  isActive?: boolean;
}

describe('Admin avatar uploads (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    adminToken = await login('admin', true);
    userToken = await login('pia', false);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT id FROM avatars WHERE ${AVATAR_KEYS})`,
    );
    await dataSource.query(`DELETE FROM avatars WHERE ${AVATAR_KEYS}`);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(name: string, isAdmin: boolean): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles: ['passenger'],
    });
    if (isAdmin) {
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
    }
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  function upload(
    name: string,
    image: Buffer,
    filename = 'avatar.png',
    token = adminToken,
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/admin/catalogs/avatars')
      .set('Authorization', `Bearer ${token}`)
      .field('name', name)
      .attach('image', image, filename);
  }

  it('uploads a PNG avatar that anyone can load and users can choose', async () => {
    const image = pngHeader(256, 256);
    const created = await upload('E2E Avatar Búho', image).expect(201);
    expect(created.body).toMatchObject({
      id: 'e2e-avatar-buho',
      svg: null,
      imageHref: expect.stringContaining(
        '/api/avatars/e2e-avatar-buho/image?v=',
      ) as string,
      isActive: true,
    });

    // Sin token: la pide una etiqueta <img>
    const served = await request(app.getHttpServer())
      .get('/api/avatars/e2e-avatar-buho/image')
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['cache-control']).toContain('max-age');
    expect(Buffer.compare(served.body as Buffer, image)).toBe(0);

    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ avatarKey: 'e2e-avatar-buho' })
      .expect(200);
  });

  it('accepts WebP and serves it with its type', async () => {
    await upload(
      'E2E Avatar Gato',
      webpLosslessHeader(128, 128),
      'gato.webp',
    ).expect(201);
    const served = await request(app.getHttpServer())
      .get('/api/avatars/e2e-avatar-gato/image')
      .expect(200);
    expect(served.headers['content-type']).toBe('image/webp');
  });

  it('rejects SVG, other formats and images of the wrong size (422)', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    for (const [image, filename] of [
      [svg, 'avatar.svg'],
      [svg, 'disguised.png'],
      [pngHeader(256, 200), 'wide.png'],
      [pngHeader(64, 64), 'tiny.png'],
    ] as const) {
      const response = await upload('E2E Avatar Malo', image, filename).expect(
        422,
      );
      expect((response.body as { code: string }).code).toBe(
        'INVALID_AVATAR_IMAGE',
      );
    }
    await upload('E2E Avatar Grande', Buffer.alloc(200 * 1024)).expect(422);
  });

  it('lets only admins upload and manages the avatar as a catalog item', async () => {
    await upload(
      'E2E Avatar Nope',
      pngHeader(256, 256),
      'a.png',
      userToken,
    ).expect(403);
    await upload('E2E Avatar Uno', pngHeader(256, 256)).expect(201);

    await request(app.getHttpServer())
      .patch('/api/admin/catalogs/avatars/e2e-avatar-uno')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
    const active = await request(app.getHttpServer())
      .get('/api/avatars?limit=100')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(
      (active.body as Avatar[]).some(({ id }) => id === 'e2e-avatar-uno'),
    ).toBe(false);
    // Quien ya lo tenía lo sigue viendo
    await request(app.getHttpServer())
      .get('/api/avatars/e2e-avatar-uno/image')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ avatarKey: 'e2e-avatar-uno' })
      .expect(404);
  });

  it('replaces the image and changes its link, only for an admin', async () => {
    const created = await upload(
      'E2E Avatar Cambio',
      pngHeader(256, 256),
    ).expect(201);
    const { imageHref } = created.body as Avatar;
    const replace = (key: string, image: Buffer, token = adminToken) =>
      request(app.getHttpServer())
        .put(`/api/admin/catalogs/avatars/${key}/image`)
        .set('Authorization', `Bearer ${token}`)
        .attach('image', image, 'avatar.png');
    const image = pngHeader(128, 128);

    await replace('e2e-avatar-cambio', image, userToken).expect(403);
    await replace('e2e-avatar-nada', image).expect(404);
    await replace('e2e-avatar-cambio', pngHeader(64, 64)).expect(422);

    const replaced = await replace('e2e-avatar-cambio', image).expect(200);
    expect((replaced.body as Avatar).imageHref).not.toBe(imageHref);
    const served = await request(app.getHttpServer())
      .get('/api/avatars/e2e-avatar-cambio/image')
      .buffer(true)
      .expect(200);
    expect(served.body).toEqual(image);
  });

  it('has no image for an SVG avatar', async () => {
    await dataSource.query(
      `INSERT INTO avatars (key, name, svg, sort_order)
       VALUES ('e2e-avatar-svg', 'SVG', '<svg/>', 999)`,
    );
    const response = await request(app.getHttpServer())
      .get('/api/avatars/e2e-avatar-svg/image')
      .expect(404);
    expect((response.body as { code: string }).code).toBe('AVATAR_NOT_FOUND');
  });
});
