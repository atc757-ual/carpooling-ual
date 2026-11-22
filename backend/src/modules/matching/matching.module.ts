import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { RequestsModule } from '../requests/requests.module';
import { TripCandidatesService } from '../trips/trip-candidates.service';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { CANDIDATE_SOURCE } from './candidate-source';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { RelocationController } from './relocation.controller';
import { RelocationService } from './relocation.service';

// Matching: la puntuación pura (compatibility.ts) y, detrás de la interfaz
// CandidateSource, los candidatos de la plataforma (viajes publicados, en el
// módulo de viajes, dueño de sus tablas). La reubicación tras la cancelación
// del conductor usa el matching y pide la plaza con el módulo de solicitudes
@Module({
  imports: [TripsModule, PlacesModule, UsersModule, RequestsModule],
  controllers: [MatchingController, RelocationController],
  providers: [
    MatchingService,
    RelocationService,
    { provide: CANDIDATE_SOURCE, useExisting: TripCandidatesService },
  ],
})
export class MatchingModule {}
