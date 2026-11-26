import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric';

// Dónde guarda el sistema las credenciales de esta app (Keystore de Android)
const CREDENTIALS_SERVER = 'carpooling-ual';

// Códigos del plugin en los que no hay nada que avisar: quien usa la app
// cancela, el sistema cierra el diálogo, falla la huella o el usuario elige
// otra forma de entrar. 21: no hay credenciales protegidas (se han borrado o
// el sistema las ha invalidado al cambiar las huellas)
const CANCELLED_CODES: ReadonlySet<string> = new Set(['10', '15', '16', '17']);
const NOT_FOUND_CODE = '21';

export interface BiometricCredentials {
  email: string;
  password: string;
}

export type BiometricReadResult = BiometricCredentials | 'cancelled' | 'missing';

// Textos del diálogo del sistema (Android), en el idioma de la app
export interface BiometricPromptTexts {
  title: string;
  subtitle?: string;
  cancel: string;
}

// El correo y la contraseña, cifrados en el Keystore de Android con una clave
// que solo se usa tras poner la huella (o la cara): ni la app puede leerlos
// sin ella. Solo en la app Android; en la web no hay biometría. Como
// servicio, se sustituye fácilmente en los tests
@Injectable({ providedIn: 'root' })
export class BiometricPlugin {
  // Si el dispositivo tiene biometría fuerte configurada
  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const result = await NativeBiometric.isAvailable({ useFallback: false });
    return result.isAvailable;
  }

  // Guarda las credenciales; el sistema pide la huella para protegerlas.
  // false si quien usa la app cancela
  async save(credentials: BiometricCredentials, texts: BiometricPromptTexts): Promise<boolean> {
    try {
      await NativeBiometric.setCredentials({
        server: CREDENTIALS_SERVER,
        username: credentials.email,
        password: credentials.password,
        // Siguen valiendo si se añade otra huella
        accessControl: AccessControl.BIOMETRY_ANY,
        title: texts.title,
        negativeButtonText: texts.cancel,
      });
      return true;
    } catch (error) {
      if (CANCELLED_CODES.has(errorCode(error))) {
        return false;
      }
      throw error;
    }
  }

  // Pide la huella y devuelve las credenciales; 'cancelled' si se cancela y
  // 'missing' si ya no las hay
  async read(texts: BiometricPromptTexts): Promise<BiometricReadResult> {
    try {
      const credentials = await NativeBiometric.getSecureCredentials({
        server: CREDENTIALS_SERVER,
        title: texts.title,
        subtitle: texts.subtitle,
        negativeButtonText: texts.cancel,
      });
      return { email: credentials.username, password: credentials.password };
    } catch (error) {
      const code = errorCode(error);
      if (CANCELLED_CODES.has(code)) {
        return 'cancelled';
      }
      if (code === NOT_FOUND_CODE) {
        return 'missing';
      }
      throw error;
    }
  }

  async remove(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await NativeBiometric.deleteCredentials({ server: CREDENTIALS_SERVER });
  }
}

// Los errores de Capacitor llevan el código del plugin en code (texto o número)
function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return '';
  }
  const { code } = error;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : '';
}
