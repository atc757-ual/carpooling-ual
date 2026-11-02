import {
  consentLabel,
  formatDate,
  incidentLabel,
  initialsOf,
  ratingLabel,
  requestStatusLabel,
  tripRoute,
  tripStatusLabel,
} from './admin-user-detail-labels';

describe('admin user detail labels', () => {
  it('writes the states in Spanish and keeps unknown ones', () => {
    expect(tripStatusLabel('in_progress')).toBe('En curso');
    expect(tripStatusLabel('teleported')).toBe('teleported');
    expect(requestStatusLabel('accepted')).toBe('Aceptada');
    expect(incidentLabel({ category: 'technical', status: 'open' })).toBe(
      'Problema técnico · Abierta',
    );
    expect(incidentLabel({ category: 'other', status: 'reviewed' })).toBe('Otro motivo · Revisada');
    expect(consentLabel({ type: 'location', action: 'revoked' })).toBe('Ubicación · Retirado');
    expect(consentLabel({ type: 'terms', action: 'granted' })).toBe(
      'Condiciones de uso · Aceptado',
    );
  });

  it('writes the route, the rating, the initials and the date', () => {
    expect(tripRoute({ originName: 'Roquetas', destinationName: null })).toBe('Roquetas → Destino');
    expect(ratingLabel(null)).toBe('Sin valoraciones');
    expect(ratingLabel({ average: null, count: 0 })).toBe('Sin valoraciones');
    expect(ratingLabel({ average: 4.56, count: 12 })).toBe('4,6 ★ (12)');
    expect(initialsOf('Lucía  Cortés Gil')).toBe('LC');
    expect(formatDate('2026-10-25T10:00:00.000Z')).toBe('25 oct 2026');
  });
});
