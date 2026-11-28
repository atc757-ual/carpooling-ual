import { Injectable } from '@nestjs/common';
import { SystemTwinSnapshot } from './model/twin-snapshot';
import {
  protectSnapshot,
  summarizeSnapshot,
  TwinSnapshotSummary,
} from './model/twin-snapshot-privacy';
import { DigitalTwinSyncService } from './sync/digital-twin-sync.service';

export interface TwinCopy {
  snapshot: SystemTwinSnapshot;
  summary: TwinSnapshotSummary;
}

// Lo que el gemelo ofrece a otros módulos (la simulación): una copia del
// gemelo vivo, ya minimizada y seudonimizada (twin-snapshot-privacy.ts), con
// su resumen. Quien la pide no ve el gemelo vivo ni sus identificadores
@Injectable()
export class DigitalTwinSnapshotService {
  constructor(private readonly sync: DigitalTwinSyncService) {}

  copyLiveTwin(takenAt: Date): TwinCopy {
    const snapshot = protectSnapshot(this.sync.twin.snapshot(takenAt));
    return { snapshot, summary: summarizeSnapshot(snapshot) };
  }
}
