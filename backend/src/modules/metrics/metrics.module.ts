import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { MetricsController } from './metrics.controller';
import { UserImpactService } from './user-impact.service';

// Métricas. De momento, el impacto de cada usuario (trips y requests le dan
// sus datos; ninguno de los dos depende de este módulo)
@Module({
  imports: [TripsModule, RequestsModule],
  controllers: [MetricsController],
  providers: [UserImpactService],
})
export class MetricsModule {}
