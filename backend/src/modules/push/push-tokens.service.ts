import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { PushRecipients } from '../../shared/push/push-sender';
import { PushToken, type PushPlatform } from './entities/push-token.entity';

// Los dispositivos donde cada usuario activó las push (su token o su FID)
@Injectable()
export class PushTokensService {
  constructor(
    @InjectRepository(PushToken)
    private readonly tokensRepository: Repository<PushToken>,
  ) {}

  // Lo registra o lo renueva. Si el token era de otro usuario (otra sesión en
  // ese dispositivo), pasa a ser de este
  async register(
    userId: string,
    token: string,
    platform: PushPlatform,
  ): Promise<void> {
    await this.tokensRepository.query(
      `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now()`,
      [userId, token, platform],
    );
  }

  // Al desactivarlas o cerrar sesión: solo el suyo
  async unregister(userId: string, token: string): Promise<void> {
    await this.tokensRepository.delete({ userId, token });
  }

  // Los dispositivos de unos usuarios: en la web, lo guardado es su FID; en la
  // app Android, su token de FCM (PushRecipients)
  async recipientsOf(userIds: readonly string[]): Promise<PushRecipients> {
    if (userIds.length === 0) {
      return { tokens: [], fids: [] };
    }
    const rows = await this.tokensRepository.find({
      select: { token: true, platform: true },
      where: { userId: In([...new Set(userIds)]) },
    });
    const idsOf = (platform: PushPlatform) =>
      rows.filter((row) => row.platform === platform).map(({ token }) => token);
    return { tokens: idsOf('android'), fids: idsOf('web') };
  }

  // Los que Firebase dice que ya no valen
  async removeInvalid(tokens: readonly string[]): Promise<void> {
    if (tokens.length > 0) {
      await this.tokensRepository.delete({ token: In([...tokens]) });
    }
  }
}
