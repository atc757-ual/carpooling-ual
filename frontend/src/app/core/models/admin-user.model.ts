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
