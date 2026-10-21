import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DriverProfile } from '../src/modules/users/entities/driver-profile.entity';
import { PassengerProfile } from '../src/modules/users/entities/passenger-profile.entity';
import { User } from '../src/modules/users/entities/user.entity';

// Comprueba que las entidades encajan con las tablas creadas por la migración.
// Usa la base de datos real (requiere npm run migrate) y trabaja dentro de una
// transacción que se deshace al final: no deja datos en la base de datos.
describe('Users entities (e2e)', () => {
  let app: INestApplication;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    queryRunner = app.get(DataSource).createQueryRunner();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  afterAll(async () => {
    await app.close();
  });

  async function saveUserWithProfiles(email: string): Promise<User> {
    const manager = queryRunner.manager;
    const user = await manager.save(
      manager.create(User, { name: 'Ana', email, passwordHash: 'hash' }),
    );
    await manager.save(
      manager.create(DriverProfile, { userId: user.id, averageRating: 4.5 }),
    );
    await manager.save(manager.create(PassengerProfile, { userId: user.id }));
    return user;
  }

  it('saves a user with driver and passenger profiles and reads them back', async () => {
    const { id } = await saveUserWithProfiles('ana@ual.es');

    const user = await queryRunner.manager.findOneOrFail(User, {
      where: { id },
      relations: { driverProfile: true, passengerProfile: true },
    });

    expect(user).toMatchObject({ email: 'ana@ual.es', timeToleranceMin: 15 });
    expect(user.driverProfile).toMatchObject({
      isActive: true,
      averageRating: 4.5,
      hasLicenseDeclared: false,
    });
    expect(user.passengerProfile).toMatchObject({ hasHighPriority: false });
  });

  it('never loads the password hash unless it is explicitly selected', async () => {
    const { id } = await saveUserWithProfiles('ana@ual.es');

    const user = await queryRunner.manager.findOneByOrFail(User, { id });
    const withHash = await queryRunner.manager.findOneOrFail(User, {
      where: { id },
      select: { id: true, passwordHash: true },
    });

    expect(user.passwordHash).toBeUndefined();
    expect(withHash.passwordHash).toBe('hash');
  });

  it('treats emails as case-insensitive (citext)', async () => {
    await saveUserWithProfiles('ana@ual.es');

    const found = await queryRunner.manager.findOneBy(User, {
      email: 'ANA@UAL.ES',
    });

    expect(found?.email).toBe('ana@ual.es');
  });
});
