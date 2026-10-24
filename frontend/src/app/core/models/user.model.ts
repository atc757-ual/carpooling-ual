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
}
