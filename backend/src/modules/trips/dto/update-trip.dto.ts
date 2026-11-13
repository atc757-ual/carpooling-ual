import { OmitType, PartialType } from '@nestjs/swagger';
import { PublishTripDto } from './publish-trip.dto';

// Cuerpo de PATCH /api/trips/{id} (RF-05): los mismos campos y reglas que al
// publicar, todos opcionales. Solo se envían los que cambian. La hora, solo
// la de salida (la llegada se elige al publicar). Cómo recoge y las paradas
// se eligen al publicar: dependen de la ruta y de las plazas ya aceptadas
export class UpdateTripDto extends PartialType(
  OmitType(PublishTripDto, ['arrivalAt', 'pickupMode', 'stops'] as const),
) {}
