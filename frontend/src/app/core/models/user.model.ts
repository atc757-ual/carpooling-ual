// Usuario de la plataforma tal como lo devuelve la API (recurso TMF630 User)

export type Profile = 'driver' | 'passenger' | 'admin';

export interface User {
  '@type': 'User';
  id: string;
  href: string;
  name: string;
  email: string;
  // Formato internacional (+34600123456); null en quien no pasó por el
  // registro (administrador inicial)
  phone: string | null;
  profiles: Profile[];
  // Modo con el que viaja ahora, el mismo en todos sus dispositivos; null
  // hasta que lo cambia por primera vez
  activeMode: 'passenger' | 'driver' | null;
}
