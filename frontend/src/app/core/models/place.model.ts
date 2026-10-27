// Lugares de la API (/api/campus-parkings y /api/places)

// Punto GeoJSON: [longitud, latitud]
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

// Un parking del campus (P1–P5), destino de los viajes al campus
export interface CampusParking {
  id: string;
  name: string;
  location: GeoPoint;
}

// Una dirección mientras se escribe, aún sin punto
export interface PlaceSuggestion {
  id: string;
  // «Avenida del Mediterraneo, 120»
  name: string;
  // «La Cañada de San Urbano (Almería)»
  locality: string;
}

// La dirección elegida, con su punto y si está en la zona de servicio
export interface Place extends PlaceSuggestion {
  municipality: string;
  location: GeoPoint;
  isCovered: boolean;
}
