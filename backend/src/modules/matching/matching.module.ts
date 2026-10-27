import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { TripCandidatesService } from '../trips/trip-candidates.service';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { CANDIDATE_SOURCE } from './candidate-source';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

// Matching: la puntuación pura (compatibility.ts) y, detrás de la interfaz
// CandidateSource, los candidatos de la plataforma (viajes publicados, en el
// módulo de viajes, dueño de sus tablas)
@Module({
  imports: [TripsModule, PlacesModule, UsersModule],
  controllers: [MatchingController],
  providers: [
    MatchingService,
    { provide: CANDIDATE_SOURCE, useExisting: TripCandidatesService },
  ],
})
export class MatchingModule {}
