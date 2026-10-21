import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;
  // DataSource falso (mock): permite simular la base de datos arriba o caída
  // sin necesitar Docker
  const query = jest.fn();

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: DataSource, useValue: { query } }],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  it('reports ok when the database answers', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    const health = await appController.getHealth();

    expect(health).toMatchObject({ status: 'ok', database: 'up' });
    expect(new Date(health.timestamp).toISOString()).toBe(health.timestamp);
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('responds 503 when the database does not answer', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    const error = await appController.getHealth().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      database: 'down',
    });
  });
});
