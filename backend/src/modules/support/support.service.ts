import { fullName } from '../users/user-name';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from '../../config/mail.config';
import { MailSender } from '../../shared/mail/mail-sender';
import { RequestsService } from '../requests/requests.service';
import { tripCode } from '../trips/dto/trip.resource';
import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import { TripsService } from '../trips/trips.service';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import { UsersService } from '../users/users.service';
import type { SendSupportMessageDto } from './dto/send-support-message.dto';
import {
  buildSupportMessageMail,
  SupportTripSummary,
} from './mail/support-message.mail';

// «Ayuda y soporte»: el mensaje de un usuario llega por correo al buzón de
// soporte (SUPPORT_EMAIL), que le responde a su correo. No se guarda en la
// base de datos
@Injectable()
export class SupportService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly mailSender: MailSender,
    private readonly configService: ConfigService,
  ) {}

  async sendMessage(
    userId: string,
    { topic, message, tripId }: SendSupportMessageDto,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user?.deactivatedAt !== null) {
      throw new UserNotFoundError(userId);
    }
    // El viaje, solo con el motivo «Un viaje»
    const trip =
      topic === 'trip' && tripId !== undefined
        ? await this.tripOf(userId, tripId)
        : null;
    const { supportTo } = this.configService.getOrThrow<MailConfig>('mail');
    await this.mailSender.send(
      buildSupportMessageMail({
        to: supportTo,
        user: { id: user.id, name: fullName(user), email: user.email },
        topic,
        message: message.trim(),
        trip,
      }),
    );
  }

  // Un viaje que condujo o en el que pidió plaza (en cualquier estado); otro
  // cualquiera no existe para él
  private async tripOf(
    userId: string,
    tripId: string,
  ): Promise<SupportTripSummary> {
    const trip = (await this.tripsService.getByIds([tripId])).get(tripId);
    const isOwn =
      trip !== undefined &&
      (trip.driverId === userId ||
        (await this.requestsService.tripIdsRequestedBy(userId, [tripId])).has(
          tripId,
        ));
    if (!trip || !isOwn) {
      throw new TripNotFoundError(tripId);
    }
    return {
      id: trip.id,
      code: tripCode(trip.number),
      originName: trip.originName,
      destinationName: trip.destinationName,
      departureAt: trip.departureAt,
    };
  }
}
