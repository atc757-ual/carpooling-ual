import { PickType } from '@nestjs/swagger';
import { RegisterDto } from './register.dto';

// Datos del comando create-admin: el nombre y el correo, con las MISMAS reglas
// que el registro (PickType copia los campos con sus validaciones)
export class CreateAdminDto extends PickType(RegisterDto, [
  'name',
  'email',
] as const) {}
