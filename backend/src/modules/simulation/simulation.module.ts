import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { Scenario } from './entities/scenario.entity';
import { SimulationResult } from './entities/simulation-result.entity';
import { SimulationRun } from './entities/simulation-run.entity';
import { FakeSimulationRunner } from './runner/fake-simulation-runner';
import { SIMULATION_RUNNER } from './runner/simulation-runner';
import { SimulationsController } from './simulations.controller';
import { SimulationsService } from './simulations.service';

// Simulación de escenarios (RF-15 a RF-18). Hoy con el motor falso; el worker
// real (motor de agentes y gemelo por réplica) se conectará en SIMULATION_RUNNER
@Module({
  imports: [
    TypeOrmModule.forFeature([Scenario, SimulationRun, SimulationResult]),
    EventsModule,
  ],
  controllers: [SimulationsController],
  providers: [
    SimulationsService,
    {
      provide: SIMULATION_RUNNER,
      useFactory: () => new FakeSimulationRunner(),
    },
  ],
})
export class SimulationModule {}
