import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEvent } from './entities/domain-event.entity';
import { EventsService } from './events.service';

// Eventos hacia el Gemelo Digital. Lo importan los módulos que cambian el
// estado de la plataforma (viajes, solicitudes, incidencias…)
@Module({
  imports: [TypeOrmModule.forFeature([DomainEvent])],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
