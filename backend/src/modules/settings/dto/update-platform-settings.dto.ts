import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

// Los ajustes que cambian; los que no llegan siguen igual
export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Drivers can publish the same trip on several days at once',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  multiDayPublishing?: boolean;
}
