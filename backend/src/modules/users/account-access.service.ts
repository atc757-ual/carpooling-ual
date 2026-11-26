import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { EventsService } from '../../events/events.service';
import { AdminProfile } from './entities/admin-profile.entity';
import { User } from './entities/user.entity';
import { AccountHasActiveTripsError } from './errors/account-has-active-trips.error';
import { AccountIsAdminError } from './errors/account-is-admin.error';
import { CannotDisableOwnAccountError } from './errors/cannot-disable-own-account.error';
import { UserHasActiveTripsError } from './errors/user-has-active-trips.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { UsersService } from './users.service';

// Cambio de acceso pedido por un administrador, con su motivo (auditoría)
export interface AccountAccessChange {
  userId: string;
  isDisabled: boolean;
  reason: string;
}

// Inhabilitar y rehabilitar cuentas desde el panel (RF-25). Las cuentas no se
// borran: inhabilitar es la forma de dejar fuera a un usuario, y se puede
// deshacer (a diferencia de la baja que pide el propio usuario)
@Injectable()
export class AccountAccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
    private readonly audit: AuditService,
  ) {}

  // Idempotente: si la cuenta ya estaba así, no cambia nada. Al inhabilitarla,
  // los suscriptores de la baja bloquean si tiene viajes activos, cancelan
  // sus solicitudes pendientes y cierran sus sesiones (el token de acceso
  // caduca en como mucho 15 minutos y no se puede renovar)
  async setDisabled(
    adminId: string,
    change: AccountAccessChange,
  ): Promise<void> {
    const { userId, isDisabled, reason } = change;
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user?.deactivatedAt !== null) {
        throw new UserNotFoundError(userId);
      }
      if ((user.disabledAt !== null) === isDisabled) {
        return;
      }
      if (isDisabled) {
        await this.assertCanDisable(manager, adminId, userId);
        await this.notifyDeactivating(manager, userId);
      }
      await manager.update(
        User,
        { id: userId },
        { disabledAt: isDisabled ? new Date() : null },
      );
      await this.eventsService.record(manager, {
        type: isDisabled ? 'user.disabled' : 'user.enabled',
        sourceEntityId: userId,
        payload: {},
      });
      await this.audit.record(manager, {
        adminId,
        action: isDisabled ? 'account.disabled' : 'account.enabled',
        targetUserId: userId,
        reason,
      });
    });
  }

  // Los suscriptores de la baja hablan al usuario (ACCOUNT_HAS_ACTIVE_TRIPS):
  // aquí se le dice lo mismo al administrador. Solo se traduce ese caso
  private async notifyDeactivating(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    try {
      await this.usersService.notifyDeactivating(manager, userId);
    } catch (error) {
      if (error instanceof AccountHasActiveTripsError) {
        throw new UserHasActiveTripsError();
      }
      throw error;
    }
  }

  // Ni la propia cuenta ni la de un administrador activo (antes se le retira
  // el perfil): la plataforma nunca se queda sin quien la gestione
  private async assertCanDisable(
    manager: EntityManager,
    adminId: string,
    userId: string,
  ): Promise<void> {
    if (userId === adminId) {
      throw new CannotDisableOwnAccountError();
    }
    if (await manager.existsBy(AdminProfile, { userId, isActive: true })) {
      throw new AccountIsAdminError();
    }
  }
}
