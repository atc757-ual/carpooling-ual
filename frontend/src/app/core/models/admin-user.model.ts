import { UserConsents } from './user-consent.model';
import { Profile } from './user.model';

// Usuarios en el panel de administración (GET /api/admin/users)
export const ADMIN_USER_STATUSES = [
  'active',
  'email_unverified',
  'open_incidents',
  'suspended',
  'profile_deactivated',
  'deleted',
] as const;
export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

export interface AdminUserRow {
  '@type'?: 'AdminUserRow';
  id: string;
  href: string;
  name: string;
  email: string;
  profiles: { profile: Profile; isActive: boolean }[];
  // Del más grave al más leve; «active» solo si no hay otro
  statuses: AdminUserStatus[];
  tripCount: number;
  openIncidents: number;
  // Hasta cuándo dura la suspensión de cada papel, o null
  suspensions: { driver: string | null; passenger: string | null } | null;
  createdAt: string;
}

export interface AdminUserQuery {
  search?: string;
  profile?: Profile;
  status?: AdminUserStatus;
  offset: number;
  limit: number;
}

export interface AdminTripSummary {
  id: string;
  href: string;
  departureAt: string;
  originName: string | null;
  destinationName: string | null;
  status: string;
}

// Todo lo que ve el administrador de un usuario (GET /api/admin/users/{id})
export interface AdminUserDetail extends Omit<AdminUserRow, '@type'> {
  '@type'?: 'AdminUserDetail';
  phone: string | null;
  isPhoneVerified: boolean;
  avatarKey: string | null;
  ratings: {
    driver: { average: number | null; count: number } | null;
    passenger: { average: number | null; count: number } | null;
  };
  vehicles: {
    id: string;
    plate: string;
    plateCountry: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    capacity: number;
    status: string;
  }[];
  trips: AdminTripSummary[];
  requests: {
    id: string;
    href: string;
    status: string;
    seats: number;
    requestedAt: string;
    trip: AdminTripSummary | null;
  }[];
  incidents: {
    id: string;
    href: string;
    category: string;
    status: string;
    role: 'reporter' | 'driver';
    reportedAt: string;
  }[];
  lateCancellations: {
    tripId: string;
    role: 'driver' | 'passenger';
    cancelledAt: string;
    waivedAt: string | null;
  }[];
  consents: UserConsents | null;
}
