import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AdminAction } from './entities/admin-action.entity';

// Auditoría de las acciones de los administradores. Como events, la usa
// cualquier módulo que cambie algo por orden de un administrador
@Module({
  imports: [TypeOrmModule.forFeature([AdminAction])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
