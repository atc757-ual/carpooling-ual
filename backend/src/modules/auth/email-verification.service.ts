import { Injectable, Logger } from '@nestjs/common';
import { MailSender } from '../../shared/mail/mail-sender';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CODE_TTL_MINUTES } from './email-codes.service';
import { buildVerificationCodeMail } from './mail/verification-code.mail';
import {
  IssuedCode,
  PendingRegistrationInput,
  PendingRegistrationsService,
} from './pending-registrations.service';

// Verificación del correo al registrarse: la cuenta solo se crea cuando se
// comprueba el código. Hasta entonces, los datos esperan como registro
// pendiente (PendingRegistrationsService). AuthService la usa en el registro y
// para abrir la sesión al verificar
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly pendingRegistrations: PendingRegistrationsService,
    private readonly mailSender: MailSender,
  ) {}

  // Guarda el registro pendiente (o sustituye el que hubiera con ese correo) y
  // envía el código, si no se envió otro hace menos de un minuto
  async register(input: PendingRegistrationInput): Promise<void> {
    const issued = await this.pendingRegistrations.save(input);
    if (issued !== null) {
      await this.sendCode(issued);
    }
  }

  // Reenvío. Si no hay registro pendiente con ese correo no hace nada, sin
  // decirlo (la API responde siempre igual): así nadie puede averiguar qué
  // correos se están registrando
  async resendCode(email: string): Promise<void> {
    const issued = await this.pendingRegistrations.reissue(email);
    if (issued !== null) {
      await this.sendCode(issued);
    }
  }

  // Comprueba el código y crea el usuario, ya verificado, en la misma
  // transacción que borra el registro pendiente. Devuelve el usuario para
  // abrirle la sesión. Un correo sin registro pendiente da el mismo error que
  // un código incorrecto
  verify(email: string, code: string): Promise<User> {
    return this.pendingRegistrations.consume(email, code, (manager, pending) =>
      this.usersService.createWithProfiles(
        {
          name: pending.name,
          email: pending.email,
          passwordHash: pending.passwordHash,
          phone: pending.phone,
          termsAcceptedAt: pending.termsAcceptedAt,
          isEmailVerified: true,
          // Nace como pasajero; el perfil de conductor se activa al registrar
          // su primer vehículo (VehiclesService.register)
          profiles: ['passenger'],
        },
        manager,
      ),
    );
  }

  // Si el envío falla, no se lanza el error: el registro ya está guardado y se
  // puede pedir otro código. Se registra en el log sin el correo (dato
  // personal)
  private async sendCode({ code, email, name }: IssuedCode): Promise<void> {
    try {
      await this.mailSender.send(
        buildVerificationCodeMail({
          to: email,
          name,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Could not send the verification code of a pending registration',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
