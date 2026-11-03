import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Profiles } from '../../shared/auth/profiles.decorator';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  DigitalTwinResource,
  toDigitalTwinResource,
} from './dto/digital-twin.resource';
import { DigitalTwinSyncService } from './sync/digital-twin-sync.service';

// El Gemelo Digital en el panel (RF-13, RF-14). Solo para administradores
@ApiTags('digital twin')
@ApiBearerAuth()
@Profiles('admin')
@Controller('admin/digital-twin')
export class DigitalTwinController {
  constructor(private readonly sync: DigitalTwinSyncService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the state of the live digital twin',
    description:
      'Trips and vehicles by status, the last event applied and the lag between an event and the twin (RNF-07).',
  })
  @ApiOkResponse({ type: DigitalTwinResource })
  @ApiErrorResponses({
    [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
    [HttpStatus.FORBIDDEN]: ['PROFILE_REQUIRED'],
  })
  get(): DigitalTwinResource {
    return toDigitalTwinResource(this.sync.twin.summary(), this.sync.status());
  }
}
