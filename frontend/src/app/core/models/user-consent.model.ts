export type ConsentType = 'terms' | 'privacy' | 'location';
export type ConsentAction = 'granted' | 'revoked';
export type ConsentSource = 'registration' | 'settings' | 'account_deletion';

export interface ConsentRecord {
  id: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: string;
  fingerprint: string;
}

export interface UserConsents {
  '@type'?: 'UserConsents';
  current: {
    terms: ConsentRecord | null;
    privacy: ConsentRecord | null;
    location: ConsentRecord | null;
  };
  history: ConsentRecord[];
}
