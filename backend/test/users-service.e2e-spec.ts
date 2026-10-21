import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { EmailAlreadyRegisteredError } from '../src/modules/users/errors/email-already-registered.error';
import { UsersService } from '../src/modules/users/users.service';

// Pruebas de UsersService contra PostgreSQL (requiere npm run migrate): la
// transacción, la restricción UNIQUE y citext solo se pueden comprobar de
// verdad en la base de datos. UsersService abre su propia transacción, así que
// los usuarios de prueba (correos con el prefijo TEST_PREFIX) se borran al final
// de cada test (los perfiles se borran en cascada).
const TEST_PREFIX = 'users-service-test-';

describe('UsersService (e2e)', () => {
  let app: INestApplication;
  let usersService: UsersService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    usersService = app.get(UsersService);
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${TEST_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  function newUser(email: string, profiles: ('driver' | 'passenger')[]) {
    return usersService.createWithProfiles({
      name: 'Ana',
      email: `${TEST_PREFIX}${email}`,
      passwordHash: 'hash',
      profiles,
    });
  }

  it('creates a user with the driver profile', async () => {
    const user = await newUser('ana@ual.es', ['driver']);

    expect(user.driverProfile).toMatchObject({ isActive: true });
    expect(user.passengerProfile).toBeNull();
    expect(usersService.getActiveProfiles(user)).toEqual(['driver']);
  });

  it('creates a user with both driver and passenger profiles', async () => {
    const user = await newUser('ana@ual.es', ['driver', 'passenger']);

    expect(usersService.getActiveProfiles(user)).toEqual([
      'driver',
      'passenger',
    ]);
  });

  it('rejects an email already registered, regardless of capital letters', async () => {
    await newUser('ana@ual.es', ['passenger']);

    await expect(newUser('ANA@UAL.ES', ['driver'])).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it('saves nothing if a profile cannot be created (atomic transaction)', async () => {
    // Simula un fallo al crear el perfil, cuando el usuario ya se ha insertado
    // dentro de la transacción (createProfile es privado: se accede con un cast)
    jest
      .spyOn(
        usersService as unknown as { createProfile: () => Promise<void> },
        'createProfile',
      )
      .mockRejectedValue(new Error('profile insert failed'));

    await expect(newUser('ana@ual.es', ['driver'])).rejects.toThrow(
      'profile insert failed',
    );
    const leftover = await usersService.findByEmailWithPassword(
      `${TEST_PREFIX}ana@ual.es`,
    );
    expect(leftover).toBeNull();
  });

  it('finds a user by email with the password hash (only for login)', async () => {
    await newUser('ana@ual.es', ['driver']);

    const user = await usersService.findByEmailWithPassword(
      `${TEST_PREFIX}ANA@ual.es`,
    );

    expect(user?.passwordHash).toBe('hash');
    expect(user?.driverProfile).toMatchObject({ isActive: true });
  });

  it('finds a user by id with its profiles but without the hash', async () => {
    const { id } = await newUser('ana@ual.es', ['passenger']);

    const user = await usersService.findById(id);

    expect(user?.passengerProfile).toMatchObject({ isActive: true });
    expect(user?.passwordHash).toBeUndefined();
  });
});
