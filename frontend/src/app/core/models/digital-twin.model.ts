// Estado del gemelo vivo (GET /api/admin/digital-twin)
export interface DigitalTwinState {
  trips: {
    published: number;
    confirmed: number;
    in_progress: number;
    finished: number;
    cancelled: number;
  };
  vehicles: { idle: number; scheduled: number; on_trip: number };
  users: {
    active: number;
    deactivated: number;
    drivers: number;
    passengers: number;
    inDriverMode: number;
  };
  passengersOnBoard: number;
  // false mientras reproduce los eventos desde el principio
  isLive: boolean;
  lastSequence: number;
  appliedEvents: number;
  duplicateEvents: number;
  unsupportedEvents: number;
  lastEventAt: string | null;
  syncedAt: string | null;
  lag: { samples: number; lastMs: number | null; p95Ms: number | null; maxMs: number | null };
}
