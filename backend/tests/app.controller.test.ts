import { Test } from '@nestjs/testing';
import { AppController } from '../src/app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  it('reports the service as healthy with an ISO timestamp', () => {
    const health = appController.getHealth();

    expect(health.status).toBe('ok');
    expect(new Date(health.timestamp).toISOString()).toBe(health.timestamp);
  });
});
