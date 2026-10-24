import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailModule } from '../../shared/mail/mail.module';
import { EmailCodesService } from './email-codes.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailCode } from './entities/email-code.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ProfilesGuard } from './guards/profiles.guard';
import { RefreshTokensService } from './refresh-tokens.service';

@Module({
  imports: [
    // Da acceso a UsersService, lo único que exporta el módulo users
    UsersModule,
    // Envío de correos (códigos de verificación)
    MailModule,
    // Tablas propias de este módulo: sesiones y códigos enviados por correo
    TypeOrmModule.forFeature([RefreshToken, EmailCode]),
    // Configura el JwtService con el secreto y la duración del token del .env
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn:
            configService.getOrThrow<number>('jwt.accessTtlMinutes') * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensService,
    EmailCodesService,
    EmailVerificationService,
    // Guards globales (se aplican a toda la API, en este orden): primero el
    // token (salvo @Public) y después los perfiles (@Profiles)
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ProfilesGuard },
  ],
})
export class AuthModule {}
