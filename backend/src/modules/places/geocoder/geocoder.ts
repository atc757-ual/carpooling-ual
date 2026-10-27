// Geocodificador: traduce texto a direcciones y coordenadas, y coordenadas a
// direcciones. Es una interfaz para no depender del proveedor (hoy
// CartoCiudad); en los tests se sustituye por uno falso

export interface GeoPoint {
  lon: number;
  lat: number;
}

// Una sugerencia mientras se escribe: aún sin coordenadas (CartoCiudad solo
// las da al elegirla). ref es la referencia del proveedor para encontrarla
export interface GeocodedSuggestion {
  ref: string;
  // «Avenida del Mediterraneo, 120»
  name: string;
  // «La Cañada de San Urbano (Almería)»
  locality: string;
}

export interface GeocodedPlace extends GeocodedSuggestion {
  municipality: string;
  location: GeoPoint;
}

export interface Geocoder {
  suggest(text: string, limit: number): Promise<GeocodedSuggestion[]>;
  // null si la referencia ya no lleva a ninguna dirección
  find(ref: string): Promise<GeocodedPlace | null>;
  // La dirección más cercana a ese punto; null si no hay ninguna
  reverse(point: GeoPoint): Promise<GeocodedPlace | null>;
}

export const GEOCODER = Symbol('GEOCODER');
