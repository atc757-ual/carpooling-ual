import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

const EMAIL_PREFIX = 'chat-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};

interface Session {
  id: string;
  accessToken: string;
}

interface Message {
  id: string;
  kind: string;
  text: string | null;
  quickReply: string | null;
  author: { name: string };
  authorRole: string;
}

describe('Chat API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function api(
    method: 'get' | 'post' | 'put',
    path: string,
    session: Session,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${session.accessToken}`);
  }

  async function sessionFor(
    name: string,
    profiles: string[],
  ): Promise<Session> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, accessToken: body.accessToken };
  }

  // Viaje de dan con pia aceptada y leo pendiente
  async function confirmedTrip(): Promise<{
    tripId: string;
    dan: Session;
    pia: Session;
    leo: Session;
  }> {
    const [dan, pia, leo] = await Promise.all([
      sessionFor('dan', ['driver']),
      sessionFor('pia', ['passenger']),
      sessionFor('leo', ['passenger']),
    ]);
    await dataSource.query(`UPDATE users SET name = 'Pía Ruiz' WHERE id = $1`, [
      pia.id,
    ]);
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app.get(VehiclesService).register(dan.id, {
      plate: '9701BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await app.get(TripsService).publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      originName: 'Almería centro',
      destinationName: 'Campus UAL',
      departureAt: publishableDeparture(),
      offeredSeats: 3,
    });
    const requests = app.get(RequestsService);
    const { request: accepted } = await requests.request(pia.id, trip.id);
    await requests.accept(dan.id, accepted.id);
    await requests.request(leo.id, trip.id);
    return { tripId: trip.id, dan, pia, leo };
  }

  it('lets the driver and the accepted passengers talk, and only them', async () => {
    const { tripId, dan, pia, leo } = await confirmedTrip();

    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: '  Estoy en el portal  ' })
      .expect(201);
    const sent = await api('post', `/trips/${tripId}/messages`, dan)
      .send({ quickReply: 'on_my_way' })
      .expect(201);
    expect(sent.body).toMatchObject({
      '@type': 'ChatMessage',
      kind: 'quick',
      text: null,
      quickReply: 'on_my_way',
      authorRole: 'driver',
    });

    const listed = await api('get', `/trips/${tripId}/messages`, dan).expect(
      200,
    );
    expect(listed.headers['x-total-count']).toBe('2');
    const messages = listed.body as Message[];
    expect(messages.map(({ kind, text }) => [kind, text])).toEqual([
      ['text', 'Estoy en el portal'],
      ['quick', null],
    ]);
    expect(messages[0]).toMatchObject({
      author: { name: 'Pía R.' },
      authorRole: 'passenger',
    });

    const newer = await api(
      'get',
      `/trips/${tripId}/messages?after=${messages[0].id}`,
      pia,
    ).expect(200);
    expect((newer.body as Message[]).map(({ id }) => id)).toEqual([
      messages[1].id,
    ]);

    // leo solo tiene la solicitud pendiente
    const notAllowed = await api('post', `/trips/${tripId}/messages`, leo)
      .send({ text: 'Hola' })
      .expect(403);
    expect(notAllowed.body).toMatchObject({ code: 'CHAT_NOT_ALLOWED' });
    await api('get', `/trips/${tripId}/messages`, leo).expect(403);
    await api(
      'get',
      '/trips/00000000-0000-4000-8000-000000000000/messages',
      dan,
    ).expect(404);
  });

  it('counts the unread messages until the conversation is read', async () => {
    const { tripId, dan, pia } = await confirmedTrip();
    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Hola' })
      .expect(201);
    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: '¿A qué hora?' })
      .expect(201);

    const unread = await api(
      'get',
      '/users/me/conversations?hasUnread=true&limit=1',
      dan,
    ).expect(200);
    expect(unread.headers['x-total-count']).toBe('1');
    expect(unread.body).toEqual([
      expect.objectContaining({
        '@type': 'Conversation',
        id: tripId,
        href: `/api/trips/${tripId}/messages`,
        myRole: 'driver',
        unreadCount: 2,
        isOpen: true,
        lastMessage: expect.objectContaining({
          text: '¿A qué hora?',
        }) as unknown,
        trip: expect.objectContaining({
          originName: 'Almería centro',
          status: 'confirmed',
        }) as unknown,
      }),
    ]);
    // Lo que escribe uno no cuenta como no leído para él
    const own = await api('get', '/users/me/conversations', pia).expect(200);
    expect(own.body).toEqual([
      expect.objectContaining({ myRole: 'passenger', unreadCount: 0 }),
    ]);

    await api('put', `/trips/${tripId}/messages/read`, dan).expect(204);

    const afterRead = await api(
      'get',
      '/users/me/conversations?hasUnread=true',
      dan,
    ).expect(200);
    expect(afterRead.headers['x-total-count']).toBe('0');
  });

  it('only lets the driver send quick replies while the trip is in progress', async () => {
    const { tripId, dan, pia } = await confirmedTrip();
    await setDepartureIn(dataSource, tripId, 5);
    await app.get(TripsService).start(dan.id, tripId);

    const text = await api('post', `/trips/${tripId}/messages`, dan)
      .send({ text: 'Llego ya' })
      .expect(409);
    expect(text.body).toMatchObject({ code: 'CHAT_QUICK_REPLIES_ONLY' });
    await api('post', `/trips/${tripId}/messages`, dan)
      .send({ quickReply: 'at_pickup' })
      .expect(201);
    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Bajo' })
      .expect(201);
  });

  it('closes the chat 24 h after the trip finishes, and keeps it readable', async () => {
    const { tripId, dan, pia } = await confirmedTrip();
    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Gracias' })
      .expect(201);
    await setDepartureIn(dataSource, tripId, 5);
    const trips = app.get(TripsService);
    await trips.start(dan.id, tripId);
    await trips.finish(dan.id, tripId);
    await dataSource.query(
      `UPDATE trips SET finished_at = now() - interval '25 hours' WHERE id = $1`,
      [tripId],
    );

    const closed = await api('post', `/trips/${tripId}/messages`, dan)
      .send({ quickReply: 'on_my_way' })
      .expect(409);
    expect(closed.body).toMatchObject({ code: 'CHAT_CLOSED' });
    const listed = await api('get', `/trips/${tripId}/messages`, pia).expect(
      200,
    );
    expect(listed.body).toHaveLength(1);
    const conversations = await api(
      'get',
      '/users/me/conversations',
      dan,
    ).expect(200);
    expect(conversations.body).toEqual([
      expect.objectContaining({ isOpen: false }),
    ]);
  });

  it('validates the message and limits how many are sent', async () => {
    const { tripId, pia } = await confirmedTrip();
    const invalid = [
      {},
      { text: '   ' },
      { quickReply: 'hurry_up' },
      { text: 'Hola', quickReply: 'on_my_way' },
    ];
    for (const body of invalid) {
      const response = await api('post', `/trips/${tripId}/messages`, pia)
        .send(body)
        .expect(400);
      expect(response.body).toMatchObject({ '@type': 'ValidationError' });
    }

    await dataSource.query(
      `INSERT INTO chat_messages (trip_id, author_id, kind, body)
       SELECT $1, $2, 'text', 'Hola' FROM generate_series(1, 20)`,
      [tripId, pia.id],
    );
    const limited = await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Uno más' })
      .expect(429);
    expect(limited.body).toMatchObject({ code: 'CHAT_RATE_LIMITED' });
  });

  it('records chat_message.sent without the text', async () => {
    const { tripId, pia } = await confirmedTrip();
    const sent = await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Mi portal es el 12' })
      .expect(201);

    const [event] = await dataSource.query<
      { payload: Record<string, unknown> }[]
    >(
      `SELECT payload FROM events WHERE source_entity_id = $1 AND type = 'chat_message.sent'`,
      [(sent.body as { id: string }).id],
    );
    expect(event.payload).toMatchObject({
      tripId,
      authorId: pia.id,
      authorRole: 'passenger',
      kind: 'text',
      quickReply: null,
    });
    expect(JSON.stringify(event.payload)).not.toContain('portal');
  });
});
