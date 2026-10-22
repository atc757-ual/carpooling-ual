import { PartialType } from '@nestjs/swagger';
import { PublishTripDto } from './publish-trip.dto';

// Cuerpo de PATCH /api/trips/{id} (RF-05): los mismos campos y reglas que al
// publicar, todos opcionales. Solo se envían los que cambian
export class UpdateTripDto extends PartialType(PublishTripDto) {}
