import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { AdminActionType } from './admin-action-type';
import { AdminAction } from './entities/admin-action.entity';

export interface RecordAdminActionInput {
  adminId: string;
  action: AdminActionType;
  targetUserId: string;
  details?: Record<string, unknown>;
  reason: string;
}

// Registra una acción de un administrador con el manager de la MISMA
// transacción que el cambio (como EventsService): o queda todo o nada
@Injectable()
export class AuditService {
  async record(
    manager: EntityManager,
    input: RecordAdminActionInput,
  ): Promise<void> {
    await manager.save(manager.create(AdminAction, { details: {}, ...input }));
  }
}
