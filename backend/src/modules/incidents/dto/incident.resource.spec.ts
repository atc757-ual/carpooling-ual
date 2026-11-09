import { incidentCode } from './incident.resource';

describe('incidentCode', () => {
  it('pads the number to four digits and grows beyond them', () => {
    expect(incidentCode(1)).toBe('INC-0001');
    expect(incidentCode(42)).toBe('INC-0042');
    expect(incidentCode(12345)).toBe('INC-12345');
  });
});
