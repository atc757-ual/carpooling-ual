import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { EventsService } from '../src/events/events.service';

// Sobre común de los eventos (DP-05): secuencia creciente en el orden de
// guardado, versión del contrato y lectura en orden para el Gemelo Digital.
// Los eventos del test llevan una entidad de origen inventada y se borran
describe('Events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let events: EventsService;
  const sourceEntityId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    events = app.get(EventsService);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM events WHERE source_entity_id = $1', [
      sourceEntityId,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function lastSequence(): Promise<number> {
    const [row]: { last: string | null }[] = await dataSource.query(
      'SELECT max(sequence) AS last FROM events',
    );
    return Number(row.last ?? 0);
  }

  it('numbers the events in the order they are saved, with their version', async () => {
    const before = await lastSequence();

    const ids = await dataSource.transaction(async (manager) => [
      await events.record(manager, {
        type: 'trip.published',
        sourceEntityId,
        payload: { step: 1 },
      }),
      await events.record(manager, {
        type: 'trip.confirmed',
        sourceEntityId,
        payload: { step: 2 },
      }),
    ]);
    const third = await dataSource.transaction((manager) =>
      events.record(manager, {
        type: 'trip.started',
        sourceEntityId,
        payload: { step: 3 },
      }),
    );

    const read = (await events.readAfter(before)).filter(
      (event) => event.sourceEntityId === sourceEntityId,
    );
    expect(read.map(({ id }) => id)).toEqual([...ids, third]);
    // trip.started va por su v2 (las versiones de las declaraciones)
    expect(read.map(({ version }) => version)).toEqual([1, 1, 2]);
    const sequences = read.map(({ sequence }) => sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(sequences[0]).toBeGreaterThan(before);
  });

  it('reads only after the given sequence and up to the limit', async () => {
    const before = await lastSequence();
    await dataSource.transaction(async (manager) => {
      for (const step of [1, 2, 3]) {
        await events.record(manager, {
          type: 'trip.updated',
          sourceEntityId,
          payload: { step },
        });
      }
    });

    // Otros tests pueden guardar eventos a la vez: se comprueba el límite y
    // el orden, y solo después se filtran los de este test
    const firstTwo = await events.readAfter(before, 2);
    expect(firstTwo).toHaveLength(2);
    expect(firstTwo[0].sequence).toBeGreaterThan(before);
    const rest = await events.readAfter(firstTwo[1].sequence);
    expect(rest.every(({ sequence }) => sequence > firstTwo[1].sequence)).toBe(
      true,
    );
    expect(
      [...firstTwo, ...rest]
        .filter((event: DomainEvent) => event.sourceEntityId === sourceEntityId)
        .map(({ payload }) => payload['step']),
    ).toEqual([1, 2, 3]);
  });
});
