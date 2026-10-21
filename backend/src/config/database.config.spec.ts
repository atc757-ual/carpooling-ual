import { buildTypeOrmOptions } from './database.config';

describe('buildTypeOrmOptions', () => {
  const databaseUrl = 'postgresql://u:p@localhost:5432/db';
  const options = buildTypeOrmOptions(databaseUrl);

  it('connects to PostgreSQL using the given URL', () => {
    expect(options).toMatchObject({ type: 'postgres', url: databaseUrl });
  });

  it('never lets TypeORM change the schema on its own', () => {
    expect(options.synchronize).toBe(false);
  });

  it('loads the entities registered by each module', () => {
    expect(options.autoLoadEntities).toBe(true);
  });
});
