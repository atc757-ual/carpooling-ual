import { formatWalkingDistance } from './distance.util';

describe('formatWalkingDistance', () => {
  it('rounds short distances to tens of metres', () => {
    expect(formatWalkingDistance(347)).toBe('350 m');
    expect(formatWalkingDistance(0)).toBe('0 m');
  });

  it('gives kilometres with a decimal comma from 1 km', () => {
    expect(formatWalkingDistance(1000)).toBe('1 km');
    expect(formatWalkingDistance(1234)).toBe('1,2 km');
  });
});
