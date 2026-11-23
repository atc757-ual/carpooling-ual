import type { ScenarioConfig } from '../scenario-config';
import {
  ARRIVAL_FROM_MIN,
  ARRIVAL_TO_MIN,
  createRandom,
  generatePopulation,
} from './population';

function config(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    code: 'S1',
    name: 'Test',
    users: 1000,
    adoptionRate: 0.3,
    modalSplit: { own_car: 0.3, public_transport: 0.7 },
    timeWindowMin: 15,
    parameters: {},
    ...overrides,
  };
}

describe('generatePopulation', () => {
  it('takes the car users and splits the adopters into drivers and passengers', () => {
    const { drivers, passengers, soloCommuters } = generatePopulation(
      config(),
      createRandom(1),
    );

    expect(drivers.length + passengers.length + soloCommuters.length).toBe(300);
    const adopters = drivers.length + passengers.length;
    expect(adopters).toBeGreaterThan(60);
    expect(adopters).toBeLessThan(120);
    expect(drivers.length).toBeLessThan(passengers.length);
    expect(drivers.every((driver) => driver.seats === 3)).toBe(true);
  });

  it('keeps arrivals in the morning band and origins within 20 km', () => {
    const { soloCommuters } = generatePopulation(config(), createRandom(2));

    for (const commuter of soloCommuters) {
      expect(commuter.desiredArrivalMin).toBeGreaterThanOrEqual(
        ARRIVAL_FROM_MIN,
      );
      expect(commuter.desiredArrivalMin).toBeLessThan(ARRIVAL_TO_MIN);
      expect(
        Math.hypot(commuter.origin.x, commuter.origin.y),
      ).toBeLessThanOrEqual(20);
      expect(commuter.windowMin).toBe(15);
    }
  });

  it('gives the same people with the same seed, whatever the adoption', () => {
    const shared = generatePopulation(config(), createRandom(3));
    const baseline = generatePopulation(
      config({ adoptionRate: 0 }),
      createRandom(3),
    );

    expect(baseline.drivers).toHaveLength(0);
    expect(baseline.passengers).toHaveLength(0);
    const byId = new Map(baseline.soloCommuters.map((c) => [c.id, c]));
    for (const passenger of shared.passengers) {
      expect(byId.get(passenger.id)).toEqual(passenger);
    }
  });

  it('draws each window (S3) and each capacity (S4) from the scenario', () => {
    const { drivers, passengers, soloCommuters } = generatePopulation(
      config({
        adoptionRate: 1,
        parameters: { timeWindowRangeMin: [5, 60], vehicleCapacities: [2, 6] },
      }),
      createRandom(4),
    );

    expect(soloCommuters).toHaveLength(0);
    const windows = [...drivers, ...passengers].map((c) => c.windowMin);
    expect(Math.min(...windows)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...windows)).toBeLessThanOrEqual(60);
    expect(new Set(drivers.map((d) => d.seats))).toEqual(new Set([1, 5]));
  });

  it('has no car users without the own_car share', () => {
    const population = generatePopulation(
      config({ modalSplit: { public_transport: 1 } }),
      createRandom(5),
    );

    expect(population.soloCommuters).toHaveLength(0);
  });

  it('adds who comes by another mode and joins, without changing the car users', () => {
    const withOthers = generatePopulation(
      config({
        parameters: { nonCarAdoptionRate: 0.2, nonCarDriverShare: 0.1 },
      }),
      createRandom(6),
    );
    const carOnly = generatePopulation(config(), createRandom(6));
    const isOther = (commuter: { isOtherMode?: boolean }): boolean =>
      commuter.isOtherMode === true;

    // Los de coche, los mismos (se generan antes)
    expect(withOthers.soloCommuters).toEqual(carOnly.soloCommuters);
    expect(withOthers.drivers.filter((d) => !isOther(d))).toEqual(
      carOnly.drivers,
    );
    // De los 700 de otros modos, se apunta en torno al 20 %, casi todos como
    // pasajeros; quien no se apunta no cuenta (sigue en su modo)
    const otherPassengers = withOthers.passengers.filter(isOther);
    const otherDrivers = withOthers.drivers.filter(isOther);
    expect(otherPassengers.length + otherDrivers.length).toBeGreaterThan(100);
    expect(otherPassengers.length + otherDrivers.length).toBeLessThan(180);
    expect(otherDrivers.length).toBeLessThan(otherPassengers.length / 4);
    expect(withOthers.soloCommuters.some(isOther)).toBe(false);
  });

  it('keeps the population of always without the other modes assumption', () => {
    const population = generatePopulation(
      config({ parameters: { nonCarDriverShare: 0.5 } }),
      createRandom(7),
    );

    expect(population).toEqual(generatePopulation(config(), createRandom(7)));
  });
});
