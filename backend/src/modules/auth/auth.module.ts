import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokensService } from './refresh-tokens.service';

@Module({
  imports: [
    // Da acceso a UsersService, lo único que exporta el módulo users
    UsersModule,
    // Repositorio de la tabla refresh_tokens, propia de este módulo
    TypeOrmModule.forFeature([RefreshToken]),
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
  providers: [AuthService, RefreshTokensService, JwtAuthGuard],
})
export class AuthModule {}
