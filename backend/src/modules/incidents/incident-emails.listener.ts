import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import type { MailConfig } from '../../config/mail.config';
import { AfterCommitQueue } from '../../shared/database/after-commit-queue';
import { MailMessage, MailSender } from '../../shared/mail/mail-sender';
import { TripsService } from '../trips/trips.service';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { incidentCode } from './dto/incident.resource';
import { Incident } from './entities/incident.entity';
import {
  buildReviewedIncidentMail,
  buildUrgentIncidentMail,
} from './mail/incident-mails';

type PendingIncidentEmail =
  | { kind: 'urgent'; incident: Incident; adminIds: readonly string[] }
  | { kind: 'reviewed'; incident: Incident };

// Correos de las incidencias (RF-19, RF-23): a los administradores que pueden
// gestionarla, al registrarse una del viaje en curso (es urgente: cancela el
// viaje o la plaza); a quien la registró, al atenderla, con la respuesta. Se
// apuntan en la transacción del cambio y solo se envían si se confirma (como
// las push). Un fallo al enviar no deshace nada: se registra en el log, sin el
// correo (dato personal)
@Injectable()
export class IncidentEmailsListener implements EntitySubscriberInterface {
  private readonly logger = new Logger(IncidentEmailsListener.name);
  private readonly pending = new AfterCommitQueue<PendingIncidentEmail>(
    'pendingIncidentEmails',
  );

  constructor(
    dataSource: DataSource,
    private readonly mailSender: MailSender,
    private readonly usersService: UsersService,
    private readonly tripsService: TripsService,
    private readonly configService: ConfigService,
  ) {
    dataSource.subscribers.push(this);
  }

  queueUrgent(
    manager: EntityManager,
    incident: Incident,
    adminIds: readonly string[],
  ): void {
    if (adminIds.length > 0) {
      this.queue(manager, { kind: 'urgent', incident, adminIds });
    }
  }

  queueReviewed(manager: EntityManager, incident: Incident): void {
    this.queue(manager, { kind: 'reviewed', incident });
  }

  afterTransactionCommit({ queryRunner }: TransactionCommitEvent): void {
    for (const email of this.pending.take(queryRunner)) {
      void this.deliver(email);
    }
  }

  afterTransactionRollback({ queryRunner }: TransactionRollbackEvent): void {
    this.pending.take(queryRunner);
  }

  async deliver(email: PendingIncidentEmail): Promise<void> {
    try {
      const messages = await this.messagesOf(email);
      await Promise.all(
        messages.map((message) => this.mailSender.send(message)),
      );
    } catch (error) {
      this.logger.error(
        `Could not send the ${email.kind} email of an incident`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // Dentro de una transacción, al confirmarla; fuera, al momento
  private queue(manager: EntityManager, email: PendingIncidentEmail): void {
    if (!this.pending.add(manager, email)) {
      void this.deliver(email);
    }
  }

  // Solo a cuentas activas (alguna pudo borrarse mientras tanto)
  private async messagesOf(
    email: PendingIncidentEmail,
  ): Promise<MailMessage[]> {
    const { publicWebUrl } = this.configService.getOrThrow<MailConfig>('mail');
    const { incident } = email;
    const code = incidentCode(incident.number);
    if (email.kind === 'reviewed') {
      const reporter = await this.activeUser(incident.reporterId);
      return reporter === null || incident.resolution === null
        ? []
        : [
            buildReviewedIncidentMail({
              to: reporter.email,
              language: reporter.language,
              name: reporter.firstName,
              code,
              resolution: incident.resolution,
              helpUrl: `${publicWebUrl}/tabs/profile/help?incident=${incident.id}`,
            }),
          ];
    }
    const trip = (await this.tripsService.getByIds([incident.tripId])).get(
      incident.tripId,
    );
    const route = `${trip?.originName ?? '—'} → ${trip?.destinationName ?? '—'}`;
    const admins = await Promise.all(
      email.adminIds.map((id) => this.activeUser(id)),
    );
    return admins
      .filter((admin): admin is User => admin !== null)
      .map((admin) =>
        buildUrgentIncidentMail({
          to: admin.email,
          language: admin.language,
          name: admin.firstName,
          code,
          category: incident.category,
          route,
          panelUrl: `${publicWebUrl}/admin/incidents/${incident.id}`,
        }),
      );
  }

  private async activeUser(id: string): Promise<User | null> {
    const user = await this.usersService.findById(id);
    return user !== null && user.deactivatedAt === null ? user : null;
  }
}
