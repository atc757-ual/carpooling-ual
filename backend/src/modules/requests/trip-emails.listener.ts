import type { AppLanguage } from '../../shared/i18n/app-language';
import { translate } from '../../shared/i18n/translate';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntitySubscriberInterface,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import type { MailConfig } from '../../config/mail.config';
import { MailSender } from '../../shared/mail/mail-sender';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import {
  buildSeatConfirmedMail,
  buildTripFinishedMail,
  TripMailData,
} from './mail/trip-mails';
import { RequestChangesRecorder } from './request-changes';

// Clave en los datos del QueryRunner de la transacción
const PENDING_KEY = 'pendingTripEmails';

type TripEmailKind = 'seat_confirmed' | 'trip_finished';

interface PendingTripEmail {
  kind: TripEmailKind;
  requestId: string;
  tripId: string;
  passengerId: string;
  pickupName: string | null;
  pickupAt: Date | null;
}

// Correos del viaje al pasajero: al
// confirmarse su plaza y al terminar su viaje (con el enlace para valorar).
// Sin SMS: el inicio, la recogida y el fin ya van por push. Observa los
// cambios de las solicitudes, apunta el correo en la transacción del cambio y
// solo lo envía si se confirma (como las push). Un fallo al enviar no deshace
// nada: se registra en el log, sin el correo (dato personal)
@Injectable()
export class TripEmailsListener
  implements OnModuleInit, EntitySubscriberInterface
{
  private readonly logger = new Logger(TripEmailsListener.name);

  constructor(
    dataSource: DataSource,
    private readonly changes: RequestChangesRecorder,
    private readonly mailSender: MailSender,
    private readonly usersService: UsersService,
    private readonly tripsService: TripsService,
    private readonly configService: ConfigService,
  ) {
    dataSource.subscribers.push(this);
  }

  onModuleInit(): void {
    this.changes.onRequestChanged((manager, { type, request }) => {
      const kind = KIND_BY_EVENT[type];
      const queryRunner = manager.queryRunner;
      if (kind && queryRunner?.isTransactionActive) {
        pendingOf(queryRunner).push({
          kind,
          requestId: request.id,
          tripId: request.tripId,
          passengerId: request.passengerId,
          pickupName: request.pickupName,
          pickupAt: request.pickupAt,
        });
      }
      return Promise.resolve();
    });
  }

  afterTransactionCommit({ queryRunner }: TransactionCommitEvent): void {
    for (const email of takePending(queryRunner)) {
      void this.deliver(email);
    }
  }

  afterTransactionRollback({ queryRunner }: TransactionRollbackEvent): void {
    takePending(queryRunner);
  }

  async deliver(email: PendingTripEmail): Promise<void> {
    try {
      const data = await this.mailDataOf(email);
      if (data === null) {
        return;
      }
      await this.mailSender.send(
        email.kind === 'seat_confirmed'
          ? buildSeatConfirmedMail(data)
          : buildTripFinishedMail(data),
      );
    } catch (error) {
      this.logger.error(
        `Could not send the ${email.kind} email of a seat request`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Sin cuenta activa (la borró mientras tanto), no se envía
  private async mailDataOf(
    email: PendingTripEmail,
  ): Promise<TripMailData | null> {
    const [passenger, { trip }] = await Promise.all([
      this.usersService.findById(email.passengerId),
      this.tripsService.getById(email.tripId),
    ]);
    if (passenger?.deactivatedAt !== null) {
      return null;
    }
    const driverNames = await this.usersService.getNames([trip.driverId]);
    const { publicWebUrl } = this.configService.getOrThrow<MailConfig>('mail');
    return {
      to: passenger.email,
      language: passenger.language,
      passengerName: passenger.firstName,
      driverFirstName: firstName(
        driverNames.get(trip.driverId) ?? '',
        passenger.language,
      ),
      departureAt: trip.departureAt,
      originName: trip.originName,
      destinationName: trip.destinationName,
      pickupName: email.pickupName,
      pickupAt: email.pickupAt,
      requestUrl: `${publicWebUrl}/tabs/trips/requests/${email.requestId}`,
    };
  }
}

const KIND_BY_EVENT: Readonly<Partial<Record<string, TripEmailKind>>> = {
  'request.accepted': 'seat_confirmed',
  'request.completed': 'trip_finished',
};

// Sin nombre (cuenta borrada), «tu conductor» en su idioma
function firstName(name: string, language: AppLanguage): string {
  const fallback = translate(language, 'mail.trip.yourDriver');
  return name.trim().split(/\s+/)[0] || fallback;
}

function pendingOf(queryRunner: QueryRunner): PendingTripEmail[] {
  const data = queryRunner.data as Record<string, unknown>;
  const pending = (data[PENDING_KEY] as PendingTripEmail[] | undefined) ?? [];
  data[PENDING_KEY] = pending;
  return pending;
}

function takePending(queryRunner: QueryRunner): PendingTripEmail[] {
  const data = queryRunner.data as Record<string, unknown>;
  const pending = (data[PENDING_KEY] as PendingTripEmail[] | undefined) ?? [];
  delete data[PENDING_KEY];
  return pending;
}
