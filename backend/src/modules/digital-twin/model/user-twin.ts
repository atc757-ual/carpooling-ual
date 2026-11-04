import { readString, TwinEvent } from './twin-event';

// Los eventos user.* que cambian lo que el gemelo sabe de un usuario
export const USER_EVENTS: ReadonlySet<string> = new Set([
  'user.registered',
  'user.phone_verified',
  'user.deactivated',
  'user.profile_activated',
  'user.profile_deactivated',
  'user.active_mode_changed',
]);

// Gemelo de un usuario (DP-10): sus perfiles, el modo con el que viaja y si
// la cuenta sigue activa. Sin datos personales: los eventos no los llevan.
// Clase pura, como TripTwin y VehicleTwin
export class UserTwin {
  readonly profiles = new Set<string>();
  activeMode: string | null = null;
  isActive = true;
  isPhoneVerified = false;
  updatedAt: Date | null = null;

  constructor(readonly id: string) {}

  // Devuelve false si el evento no le afecta
  apply(event: TwinEvent): boolean {
    if (!USER_EVENTS.has(event.type)) {
      return false;
    }
    const { payload } = event;
    switch (event.type) {
      case 'user.registered':
        this.applyRegistered(payload);
        break;
      case 'user.phone_verified':
        this.isPhoneVerified = true;
        break;
      case 'user.deactivated':
        this.isActive = false;
        break;
      case 'user.active_mode_changed':
        this.activeMode = readString(payload, 'activeMode') ?? this.activeMode;
        break;
      default:
        this.applyProfile(event.type, readString(payload, 'profile'));
    }
    this.updatedAt = event.occurredAt;
    return true;
  }

  private applyRegistered(payload: Record<string, unknown>): void {
    const profiles = payload.profiles;
    if (Array.isArray(profiles)) {
      for (const profile of profiles) {
        if (typeof profile === 'string') {
          this.profiles.add(profile);
        }
      }
    }
  }

  private applyProfile(type: string, profile: string | null): void {
    if (profile === null) {
      return;
    }
    if (type === 'user.profile_activated') {
      this.profiles.add(profile);
    } else {
      this.profiles.delete(profile);
    }
  }
}
