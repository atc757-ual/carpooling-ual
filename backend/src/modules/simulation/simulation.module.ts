import { existsSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { Scenario } from './entities/scenario.entity';
import { SimulationResult } from './entities/simulation-result.entity';
import { SimulationRun } from './entities/simulation-run.entity';
import { agentReplica } from './engine/agent-replica';
import { FakeSimulationRunner } from './runner/fake-simulation-runner';
import { SIMULATION_RUNNER } from './runner/simulation-runner';
import {
  WORKER_FILE,
  WorkerSimulationRunner,
} from './runner/worker-simulation-runner';
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
      // En un hilo aparte si está compilado (dist/); si no (tests con
      // TypeScript), el mismo motor de agentes en el propio proceso
      useFactory: () =>
        existsSync(WORKER_FILE)
          ? new WorkerSimulationRunner()
          : new FakeSimulationRunner(0, agentReplica),
    },
  ],
})
export class SimulationModule {}
