import {
  Body,
  Controller,
  Get,
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
import {
  SimulationSweepResource,
  toSimulationSweepResource,
} from './dto/simulation-sweep.resource';
import { StartSweepDto } from './dto/start-sweep.dto';
import { SimulationSweepsService } from './simulation-sweeps.service';

const ADMIN_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
  [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
};

// Análisis de sensibilidad desde el panel (capítulo 11): un escenario con
// varias variantes de un supuesto, una ejecución por variante. Solo para
// administradores
@ApiTags('simulations')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/simulation-sweeps')
export class SimulationSweepsController {
  constructor(private readonly sweepsService: SimulationSweepsService) {}

  @Post()
  @ApiOperation({
    summary: 'Start a sensitivity analysis',
    description:
      'Runs the scenario once per value of the parameter, one after another, with the same seeds. Only one run at a time.',
  })
  @ApiCreatedResponse({
    type: SimulationSweepResource,
    headers: { Location: { description: 'Link to the new sweep' } },
  })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['SCENARIO_NOT_FOUND'],
    [HttpStatus.CONFLICT]: ['SIMULATION_ALREADY_RUNNING'],
  })
  async start(
    @CurrentUser() admin: AccessTokenPayload,
    @Body() dto: StartSweepDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SimulationSweepResource> {
    const sweep = toSimulationSweepResource(
      await this.sweepsService.start(admin.sub, {
        scenarioCode: dto.scenario,
        baselineCode: dto.baselineScenario ?? 'S0',
        replicas: dto.replicas,
        seed: dto.seed,
        parameter: dto.parameter,
        values: dto.values,
      }),
    );
    response.setHeader('Location', sweep.href);
    return sweep;
  }

  @Get()
  @ApiOperation({
    summary: 'List sensitivity analyses',
    description: 'The most recent first.',
  })
  @ApiPaginatedResponse(SimulationSweepResource)
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
  })
  async list(
    @Query() query: PaginationQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SimulationSweepResource[]> {
    const page = await this.sweepsService.list(query);
    setPaginationHeaders(response, page);
    return page.items.map(toSimulationSweepResource);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a sensitivity analysis',
    description:
      'Its status and, for each value, the run with the vehicles avoided, the requests covered and the hypothesis test.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SimulationSweepResource })
  @ApiErrorResponses({
    ...ADMIN_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['SIMULATION_SWEEP_NOT_FOUND'],
  })
  async get(
    @Param('id', uuidParam('id')) id: string,
  ): Promise<SimulationSweepResource> {
    return toSimulationSweepResource(await this.sweepsService.get(id));
  }
}
