import { OmitType, PartialType } from '@nestjs/swagger';
import { RegisterVehicleDto } from './register-vehicle.dto';

// Cuerpo de PATCH /api/vehicles/{id}: el modelo y las plazas, los dos
// opcionales. La matrícula no se cambia: identifica el vehículo
export class UpdateVehicleDto extends PartialType(
  OmitType(RegisterVehicleDto, ['plate'] as const),
) {}
