import {
  buildReviewedIncidentMail,
  buildUrgentIncidentMail,
} from './incident-mails';

describe('incident mails', () => {
  it('tells the admins about an urgent incident, with the link to the panel', () => {
    const mail = buildUrgentIncidentMail({
      to: 'ada@ual.es',
      language: 'es',
      name: 'Ada',
      code: 'INC-0042',
      category: 'safety',
      route: 'Roquetas de Mar → Campus UAL',
      panelUrl: 'https://carpooling.test/admin/incidents/i1',
    });

    expect(mail.subject).toBe(
      'Incidencia urgente INC-0042 en un viaje en curso',
    );
    expect(mail.text).toContain('Hola, Ada:');
    expect(mail.text).toContain(
      'Es por un problema de seguridad, en el viaje Roquetas de Mar → Campus UAL.',
    );
    expect(mail.text).toContain('https://carpooling.test/admin/incidents/i1');
    expect(mail.html).toContain('Abrir en el panel');
  });

  it('gives the reporter the answer in their language, escaping it in the HTML', () => {
    const mail = buildReviewedIncidentMail({
      to: 'pia@ual.es',
      language: 'en',
      name: 'Pia',
      code: 'INC-0007',
      resolution: 'We spoke to the driver <b>today</b>',
      helpUrl: 'https://carpooling.test/tabs/profile/help?incident=i7',
    });

    expect(mail.subject).toBe('We have dealt with your report INC-0007');
    expect(mail.text).toContain(
      'Our reply:\nWe spoke to the driver <b>today</b>',
    );
    expect(mail.html).toContain(
      'We spoke to the driver &lt;b&gt;today&lt;/b&gt;',
    );
    expect(mail.html).toContain('See my report');
  });
});
