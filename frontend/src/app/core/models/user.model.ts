// Usuario de la plataforma tal como lo devuelve la API (recurso TMF630 User)

export type Profile = 'driver' | 'passenger' | 'admin';

export interface User {
  '@type': 'User';
  id: string;
  href: string;
  name: string;
  email: string;
  profiles: Profile[];
}
