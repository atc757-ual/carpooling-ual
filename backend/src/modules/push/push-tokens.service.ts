import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  APP_LANGUAGES,
  type AppLanguage,
} from '../../shared/i18n/app-language';
import type { PushRecipients } from '../../shared/push/push-sender';
import { PushToken, type PushPlatform } from './entities/push-token.entity';

// Un dispositivo que se registra: su token (o FID), dónde está y el idioma
// de la app en él
export interface PushDevice {
  token: string;
  platform: PushPlatform;
  language: AppLanguage;
}

// Los dispositivos donde cada usuario activó las push (su token o su FID)
@Injectable()
export class PushTokensService {
  constructor(
    @InjectRepository(PushToken)
    private readonly tokensRepository: Repository<PushToken>,
  ) {}

  // Lo registra o lo renueva (también al cambiar de idioma). Si el token era
  // de otro usuario (otra sesión en ese dispositivo), pasa a ser de este
  async register(
    userId: string,
    { token, platform, language }: PushDevice,
  ): Promise<void> {
    await this.tokensRepository.query(
      `INSERT INTO push_tokens (user_id, token, platform, language)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
             language = EXCLUDED.language, last_seen_at = now()`,
      [userId, token, platform, language],
    );
  }

  // Al desactivarlas o cerrar sesión: solo el suyo
  async unregister(userId: string, token: string): Promise<void> {
    await this.tokensRepository.delete({ userId, token });
  }

  // Los dispositivos de unos usuarios, por idioma (cada uno recibe la push en
  // el suyo): en la web, lo guardado es su FID; en la app Android, su token
  // de FCM (PushRecipients). Los idiomas sin dispositivos no salen
  async recipientsByLanguage(
    userIds: readonly string[],
  ): Promise<Map<AppLanguage, PushRecipients>> {
    const byLanguage = new Map<AppLanguage, PushRecipients>();
    if (userIds.length === 0) {
      return byLanguage;
    }
    const rows = await this.tokensRepository.find({
      select: { token: true, platform: true, language: true },
      where: { userId: In([...new Set(userIds)]) },
    });
    for (const language of APP_LANGUAGES) {
      const idsOf = (platform: PushPlatform) =>
        rows
          .filter((row) => row.language === language)
          .filter((row) => row.platform === platform)
          .map(({ token }) => token);
      const recipients = { tokens: idsOf('android'), fids: idsOf('web') };
      if (recipients.tokens.length > 0 || recipients.fids.length > 0) {
        byLanguage.set(language, recipients);
      }
    }
    return byLanguage;
  }

  // Los que Firebase dice que ya no valen
  async removeInvalid(tokens: readonly string[]): Promise<void> {
    if (tokens.length > 0) {
      await this.tokensRepository.delete({ token: In([...tokens]) });
    }
  }
}
