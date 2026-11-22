import {
  buildSeatConfirmedMail,
  buildTripFinishedMail,
  formatMailDateTime,
  TripMailData,
} from './trip-mails';

const DATA: TripMailData = {
  to: 'mario@ual.es',
  language: 'es',
  passengerName: 'Mario',
  driverFirstName: 'Lucía',
  // 08:00 en Madrid (UTC+1 en noviembre)
  departureAt: new Date('2026-11-20T07:00:00.000Z'),
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1',
  pickupName: 'Av. Carlos III',
  pickupAt: new Date('2026-11-20T07:05:00.000Z'),
  requestUrl: 'https://carpooling.test/tabs/trips/requests/r1',
};

describe('trip mails', () => {
  it('formats the date in Madrid time', () => {
    expect(formatMailDateTime(DATA.departureAt)).toMatch(
      /viernes, 20 de noviembre.*08:00/,
    );
  });

  it('confirms the seat with the route, the pickup and the link', () => {
    const mail = buildSeatConfirmedMail(DATA);

    expect(mail.to).toBe('mario@ual.es');
    expect(mail.subject).toBe('Tienes plaza en el viaje de Lucía');
    expect(mail.text).toContain('Lucía ha confirmado tu plaza.');
    expect(mail.text).toContain('Roquetas de Mar → Campus UAL · Parking P1');
    expect(mail.text).toContain('Te recoge en Av. Carlos III a las 08:05.');
    expect(mail.text).toContain(DATA.requestUrl);
    expect(mail.html).toContain(`href="${DATA.requestUrl}"`);
    expect(mail.html).toContain('Ver tu plaza');
  });

  it('leaves out the pickup when there is none and names the unknown places', () => {
    const mail = buildSeatConfirmedMail({
      ...DATA,
      pickupName: null,
      pickupAt: null,
      originName: null,
      destinationName: null,
    });

    expect(mail.text).not.toContain('Te recoge');
    expect(mail.text).toContain('Origen → Destino');
  });

  it('escapes the names in the html', () => {
    const mail = buildSeatConfirmedMail({
      ...DATA,
      passengerName: '<script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('closes the trip with the link to rate the driver', () => {
    const mail = buildTripFinishedMail(DATA);

    expect(mail.subject).toBe('Tu viaje con Lucía ha terminado');
    expect(mail.text).toContain('Gracias por compartir coche.');
    expect(mail.text).toContain('Tienes 7 días');
    expect(mail.html).toContain('Valorar a Lucía');
    expect(mail.html).toContain(`href="${DATA.requestUrl}"`);
  });

  it('writes in English to a passenger who uses the app in English', () => {
    const english = { ...DATA, language: 'en' as const };

    const confirmed = buildSeatConfirmedMail(english);
    const finished = buildTripFinishedMail(english);

    expect(confirmed.subject).toBe("You have a seat on Lucía's ride");
    expect(confirmed.text).toContain('Hi Mario,');
    expect(confirmed.text).toMatch(/It leaves on Friday 20 November.*08:00/);
    expect(confirmed.text).toContain(
      'You are picked up at Av. Carlos III at 08:05.',
    );
    expect(confirmed.html).toContain('See your seat');
    expect(finished.subject).toBe('Your ride with Lucía is over');
    expect(finished.html).toContain('Rate Lucía');
  });
});
