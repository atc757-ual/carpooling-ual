import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { PlatformSetting } from './entities/platform-setting.entity';

// Los ajustes de la plataforma, con su tipo. Cada uno es una fila de
// platform_settings (su clave, en SETTING_KEYS)
export interface PlatformSettings {
  // Publicar varios días a la vez (viajes recurrentes, opción A)
  multiDayPublishing: boolean;
}

// Los ajustes y su último cambio (el más reciente de cualquiera de ellos;
// sin fecha si nadie los ha cambiado desde la migración, y sin quién si su
// cuenta ya no existe)
export interface PlatformSettingsState {
  settings: PlatformSettings;
  updatedAt: Date | null;
  updatedBy: string | null;
}

type SettingName = keyof PlatformSettings;

const SETTING_KEYS: Record<SettingName, string> = {
  multiDayPublishing: 'multi_day_publishing',
};

// El valor si la fila falta o no es del tipo esperado: el más prudente
const DEFAULTS: PlatformSettings = {
  multiDayPublishing: false,
};

const SETTING_NAMES = Object.keys(SETTING_KEYS) as SettingName[];

// Ajustes de la plataforma: los lee cualquiera (la app, para saber qué
// enseña; otros módulos, para aplicarlos) y los cambia el administrador.
// Cada cambio queda en la auditoría, en la misma transacción
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepository: Repository<PlatformSetting>,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<PlatformSettings> {
    return (await this.getState()).settings;
  }

  async getState(): Promise<PlatformSettingsState> {
    const rows = await this.settingsRepository.findBy({
      key: In(Object.values(SETTING_KEYS)),
    });
    return toState(rows);
  }

  // Cambia los ajustes que llegan (los demás siguen igual). Solo registra
  // en la auditoría los que cambian de verdad
  async update(
    adminId: string,
    change: Partial<PlatformSettings>,
  ): Promise<PlatformSettingsState> {
    await this.settingsRepository.manager.transaction(async (manager) => {
      const names = SETTING_NAMES.filter((name) => change[name] !== undefined);
      await names.reduce<Promise<void>>(
        (chain, name) =>
          chain.then(() =>
            this.updateOne(manager, adminId, name, change[name] as boolean),
          ),
        Promise.resolve(),
      );
    });
    return this.getState();
  }

  private async updateOne(
    manager: EntityManager,
    adminId: string,
    name: SettingName,
    value: boolean,
  ): Promise<void> {
    const key = SETTING_KEYS[name];
    const row = await manager.findOne(PlatformSetting, {
      where: { key },
      lock: { mode: 'pessimistic_write' },
    });
    const previous = row === null ? DEFAULTS[name] : valueOf(name, row);
    if (previous === value) {
      return;
    }
    await manager.save(
      manager.create(PlatformSetting, {
        key,
        value,
        updatedAt: new Date(),
        updatedBy: adminId,
      }),
    );
    await this.audit.record(manager, {
      adminId,
      action: 'setting.changed',
      targetUserId: null,
      details: { setting: name, previous, value },
    });
  }
}

function valueOf(name: SettingName, row: PlatformSetting): boolean {
  return typeof row.value === typeof DEFAULTS[name]
    ? (row.value as boolean)
    : DEFAULTS[name];
}

function toState(rows: PlatformSetting[]): PlatformSettingsState {
  const settings = { ...DEFAULTS };
  for (const name of SETTING_NAMES) {
    const row = rows.find(({ key }) => key === SETTING_KEYS[name]);
    if (row !== undefined) {
      settings[name] = valueOf(name, row);
    }
  }
  const changes = rows.filter(
    (row): row is PlatformSetting & { updatedAt: Date } =>
      row.updatedAt !== null,
  );
  const latest = changes.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )[0];
  return {
    settings,
    updatedAt: latest?.updatedAt ?? null,
    updatedBy: latest?.updatedBy ?? null,
  };
}
