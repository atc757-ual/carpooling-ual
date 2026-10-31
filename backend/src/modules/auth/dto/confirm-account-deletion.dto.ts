import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

// Cuerpo de POST /api/users/me/account-deletion/confirm
export class ConfirmAccountDeletionDto {
  @ApiProperty({ pattern: String.raw`^\d{6}$`, example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
