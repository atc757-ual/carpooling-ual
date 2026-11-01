import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AccessTokenPayload } from '../../shared/auth/access-token-payload';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import { uuidParam } from '../../shared/http/validation';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { ScenarioResource, toScenarioResource } from './dto/scenario.resource';
import {
  SimulationResultsResource,
  toSimulationResultsResource,
} from './dto/simulation-results.resource';
import {
  SimulationRunResource,
  toSimulationRunResource,
} from './dto/simulation-run.resource';
import { StartSimulationDto } from './dto/start-simulation.dto';
import { SimulationsService } from './simulations.service';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};
const RUN_ERRORS = {
  ...ADMIN_ERRORS,
  [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  [HttpStatus.NOT_FOUND]: ['SIMULATION_NOT_FOUND'],
};

// Simulación de escenarios desde el panel (RF-15 a RF-18 y RF-20, CU-09 y
// CU-10). Solo para administradores
@ApiTags('simulations')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Get('scenarios')
  @ApiOperation({
    summary: 'List the predefined scenarios',
    description:
      'RF-16: users, adoption, modal split, time window and other parameters of each scenario (S0-S5).',
  })
  @ApiOkResponse({ type: [ScenarioResource] })
  @ApiErrorResponses(ADMIN_ERRORS)
  async listScenarios(): Promise<ScenarioResource[]> {
    return (await this.simulationsService.listScenarios()).map(
      toScenarioResource,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Start a simulation run',
    description:
      'RF-15: a scenario against its baseline (S0 by default). Only one run at a time.',
  })
  @ApiCreatedResponse({
    type: SimulationRunResource,
    headers: { Location: { description: 'Link to the new simulation run' } },
  })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['SCENARIO_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['SIMULATION_ALREADY_RUNNING'],
  })
  async start(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() dto: StartSimulationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SimulationRunResource> {
    const run = toSimulationRunResource(
      await this.simulationsService.start(admin.sub, {
        scenarioCode: dto.scenario,
        baselineCode: dto.baselineScenario ?? 'S0',
        replicas: dto.replicas,
        seed: dto.seed,
      }),
    );
    response.setHeader('Location', run.href);
    return run;
  }

  @Get()
  @ApiOperation({
    summary: 'List simulation runs',
    description: 'The most recent first.',
  })
  @ApiPaginatedResponse(SimulationRunResource)
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SimulationRunResource[]> {
    const page = await this.simulationsService.list(query);
    setPaginationHeaders(response, page);
    return page.items.map(toSimulationRunResource);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a simulation run with its status and progress',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SimulationRunResource })
  @ApiErrorResponses(RUN_ERRORS)
  async get(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SimulationRunResource> {
    return toSimulationRunResource(await this.simulationsService.get(id));
  }

  @Get(':id/results')
  @ApiOperation({
    summary: 'Get the results of a finished run',
    description:
      'RF-18: aggregated metrics (mean, SD and 95 % CI), series by time slot and success criterion.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SimulationResultsResource })
  @ApiErrorResponses({
    ...RUN_ERRORS,
    [HttpStatus.CONFLICT]: ['SIMULATION_NOT_FINISHED'],
  })
  async getResults(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SimulationResultsResource> {
    return toSimulationResultsResource(
      await this.simulationsService.getFinished(id),
    );
  }

  @Get(':id/results.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    summary: 'Export the metrics of each replica as CSV',
    description: 'RF-20.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('text/csv')
  @ApiOkResponse({
    schema: { type: 'string' },
    description: 'One row per replica',
  })
  @ApiErrorResponses({
    ...RUN_ERRORS,
    [HttpStatus.CONFLICT]: ['SIMULATION_NOT_FINISHED'],
  })
  async exportCsv(
    @Param('id', uuidParam('id')) id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const csv = await this.simulationsService.exportCsv(id);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="simulation-${id}.csv"`,
    );
    return csv;
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a queued or running simulation' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SimulationRunResource })
  @ApiErrorResponses({
    ...RUN_ERRORS,
    [HttpStatus.CONFLICT]: ['INVALID_SIMULATION_TRANSITION'],
  })
  async cancel(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SimulationRunResource> {
    return toSimulationRunResource(
      await this.simulationsService.cancel(admin.sub, id),
    );
  }
}
