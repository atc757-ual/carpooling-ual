import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

// Qué conversación del viaje: el chat es directo entre el conductor y cada
// pasajero aceptado. El conductor indica el pasajero; el pasajero no hace
// falta que lo indique (es él)
export class ConversationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The passenger of the conversation. Required for the driver (an accepted passenger of the trip); a passenger may leave it out (it is themselves)',
  })
  @IsOptional()
  @IsUUID()
  passengerId?: string;
}
