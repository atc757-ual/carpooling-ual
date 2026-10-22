// Perfiles que puede tener un usuario (modelo de dominio de la memoria)
export const PROFILE_TYPES = ['driver', 'passenger', 'admin'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

// RF-01: al registrarse solo se activan conductor y/o pasajero. El perfil de
// administrador no se autoactiva: ni el tipo ni la validación permiten pedirlo
export const REGISTRABLE_PROFILES = ['driver', 'passenger'] as const;
export type RegistrableProfile = (typeof REGISTRABLE_PROFILES)[number];
