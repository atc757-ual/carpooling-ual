import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponses } from '../../shared/http/api-error-responses.decorator';
import {
  ApiPaginatedResponse,
  setPaginationHeaders,
} from '../../shared/pagination/paginated';
import {
  ReversePlaceQueryDto,
  SearchPlacesQueryDto,
} from './dto/place-queries.dto';
import {
  PlaceResource,
  PlaceSuggestionResource,
  toPlaceResource,
  toPlaceSuggestionResource,
} from './dto/place.resource';
import { PlacesService } from './places.service';

const AUTH_ERRORS = {
  [HttpStatus.UNAUTHORIZED]: ['INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED'],
};

// Direcciones (CartoCiudad): sugerencias mientras se escribe, la dirección
// elegida con su punto, y la dirección de un punto (la ubicación del
// dispositivo). Para cualquier usuario con sesión
@ApiTags('places')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @ApiOperation({
    summary: 'Suggest addresses',
    description:
      'Addresses of the province of Almería that match the text, without coordinates. Get one by its href to know its point and whether it is covered.',
  })
  @ApiPaginatedResponse(PlaceSuggestionResource)
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.SERVICE_UNAVAILABLE]: ['GEOCODER_UNAVAILABLE'],
  })
  async search(
    @Query() query: SearchPlacesQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlaceSuggestionResource[]> {
    const suggestions = await this.placesService.suggest(query.q, query.limit);
    setPaginationHeaders(response, {
      items: suggestions,
      total: suggestions.length,
    });
    return suggestions.map(toPlaceSuggestionResource);
  }

  // Antes que :id, para que «reverse» no se tome por un id
  @Get('reverse')
  @ApiOperation({
    summary: 'Get the address of a point',
    description:
      'The nearest address to the point (e.g. the location of the device), and whether it is covered. Outside the service area, an anonymous coverage.gap_reported event is recorded.',
  })
  @ApiOkResponse({ type: PlaceResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.BAD_REQUEST]: ['VALIDATION_FAILED'],
    [HttpStatus.NOT_FOUND]: ['PLACE_NOT_FOUND'],
    [HttpStatus.SERVICE_UNAVAILABLE]: ['GEOCODER_UNAVAILABLE'],
  })
  async reverse(@Query() query: ReversePlaceQueryDto): Promise<PlaceResource> {
    return toPlaceResource(
      await this.placesService.reverse({ lon: query.lon, lat: query.lat }),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get an address',
    description:
      'The suggested address with its point, and whether it is covered. Outside the service area, an anonymous coverage.gap_reported event is recorded.',
  })
  @ApiParam({ name: 'id', description: 'Id of a suggestion' })
  @ApiOkResponse({ type: PlaceResource })
  @ApiErrorResponses({
    ...AUTH_ERRORS,
    [HttpStatus.NOT_FOUND]: ['PLACE_NOT_FOUND'],
    [HttpStatus.SERVICE_UNAVAILABLE]: ['GEOCODER_UNAVAILABLE'],
  })
  async getOne(@Param('id') id: string): Promise<PlaceResource> {
    return toPlaceResource(await this.placesService.getPlace(id));
  }
}
