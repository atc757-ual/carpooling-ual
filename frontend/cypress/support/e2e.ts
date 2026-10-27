// Se carga antes de cada fichero de tests e2e.

// Tamaños de pantalla en los que se prueba cada pantalla: el móvil del diseño
// y un escritorio (el layout cambia desde 768px)
export const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

// Municipio que en los tests queda fuera de la zona de servicio
export const UNCOVERED_PLACE = 'Vera';

// API de lugares simulada en todos los tests (sin backend ni CartoCiudad):
// - los parkings P1 y P3;
// - cada texto escrito se sugiere tal cual, como una dirección de Almería;
// - al elegirla, está en la zona salvo si empieza por UNCOVERED_PLACE
beforeEach(() => {
  cy.intercept('GET', '/api/campus-parkings*', [
    { id: 'p1', name: 'Parking P1', location: { type: 'Point', coordinates: [-2.4045, 36.8322] } },
    { id: 'p3', name: 'Parking P3', location: { type: 'Point', coordinates: [-2.4068, 36.8291] } },
  ]);
  cy.intercept('GET', /\/api\/places\?/, (req) => {
    const text = String(req.query['q']);
    req.reply([{ id: encodeURIComponent(text), name: text, locality: 'Almería' }]);
  });
  // La dirección de un punto (ubicación del dispositivo o pin del mapa)
  cy.intercept('GET', /\/api\/places\/reverse\?/, {
    id: 'lachambre-4',
    name: 'Calle Lachambre, 4',
    locality: 'Almería',
    municipality: 'Almería',
    location: { type: 'Point', coordinates: [-2.46381, 36.8381] },
    isCovered: true,
  });
  // Los tiles del mapa, vacíos (sin pedirlos a OpenStreetMap)
  cy.intercept('GET', 'https://tile.openstreetmap.org/**', { statusCode: 204 });
  cy.intercept('GET', /\/api\/places\/[^?/]+$/, (req) => {
    const name = decodeURIComponent(req.url.split('/').pop() ?? '');
    const isCovered = !name.startsWith(UNCOVERED_PLACE);
    req.reply({
      id: encodeURIComponent(name),
      name,
      locality: 'Almería',
      municipality: isCovered ? 'Almería' : UNCOVERED_PLACE,
      location: { type: 'Point', coordinates: [-2.46, 36.84] },
      isCovered,
    });
  });
});

// Escribe una dirección en el campo de dirección de ese bloque y elige la
// sugerencia
export function choosePlace(scope: string, place: string): void {
  cy.get(`${scope} app-place-field input`).clear();
  cy.get(`${scope} app-place-field input`).type(place);
  cy.contains(`${scope} .place-field__suggestion`, place).click();
}

// La ubicación del navegador simulada (Calle Lachambre, Almería) y el estado
// de su permiso: 'prompt' (aún no se ha preguntado) o 'granted' (ya se dio)
export function stubLocation(permission: PermissionState): void {
  cy.window().then((win) => {
    cy.stub(win.navigator.permissions, 'query').resolves({ state: permission });
    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(
      (onSuccess: PositionCallback) =>
        onSuccess({
          coords: { latitude: 36.8381, longitude: -2.4637, accuracy: 5 },
          timestamp: Date.now(),
        } as GeolocationPosition),
    );
  });
}
