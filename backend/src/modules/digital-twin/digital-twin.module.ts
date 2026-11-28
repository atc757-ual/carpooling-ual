import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { DigitalTwinController } from './digital-twin.controller';
import { DigitalTwinSnapshotService } from './digital-twin-snapshot.service';
import { DigitalTwinSyncService } from './sync/digital-twin-sync.service';

// Gemelo Digital (opción B, DP-10): el gemelo del sistema y sus gemelos de
// entidad (model/, puros) y su sincronización con la plataforma (sync/). Solo
// usa lo que exporta EventsModule, nunca las tablas de otros módulos. Exporta
// la copia del gemelo vivo, ya protegida, para la simulación
@Module({
  imports: [EventsModule],
  controllers: [DigitalTwinController],
  providers: [DigitalTwinSyncService, DigitalTwinSnapshotService],
  exports: [DigitalTwinSnapshotService],
})
export class DigitalTwinModule {}
