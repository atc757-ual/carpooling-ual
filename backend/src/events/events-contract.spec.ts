import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMAIN_EVENT_TYPES, EVENT_VERSIONS } from './event-versions';

// El contrato de eventos (RNF-13) no se puede quedar atrás: todo tipo tiene su
// versión y su fila en docs/api/events.md
const CONTRACT = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'api', 'events.md'),
  'utf8',
);

describe('events contract', () => {
  it('documents every event type', () => {
    const missing = DOMAIN_EVENT_TYPES.filter(
      (type) => !CONTRACT.includes(`| \`${type}\``),
    );
    expect(missing).toEqual([]);
  });

  it('gives every event type a positive version', () => {
    expect(Object.values(EVENT_VERSIONS).every((v) => v >= 1)).toBe(true);
  });
});
