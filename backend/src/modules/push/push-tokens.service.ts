import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushToken, type PushPlatform } from './entities/push-token.entity';

// Los tokens de los dispositivos donde cada usuario activó las push
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

  async tokensOf(userIds: readonly string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.tokensRepository.find({
      select: { token: true },
      where: { userId: In([...new Set(userIds)]) },
    });
    return rows.map(({ token }) => token);
  }

  // Los que Firebase dice que ya no valen
  async removeInvalid(tokens: readonly string[]): Promise<void> {
    if (tokens.length > 0) {
      await this.tokensRepository.delete({ token: In([...tokens]) });
    }
  }
}
