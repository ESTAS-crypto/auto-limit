/**
 * src/lib/providers/oauth.ts
 * OAuthProvider: Kerangka kosong untuk autentikasi OAuth mandiri.
 * Catatan: Sesuai spesifikasi Bagian 6, jangan membuat login OAuth Google sendiri
 * di versi pertama untuk mencegah risiko pemblokiran akun.
 */

import { ProviderQuotaResult, QuotaSemantics } from '../types';
import { QuotaProvider } from './types';

export class OAuthProvider implements QuotaProvider {
  readonly id = 'oauth';
  readonly name = 'OAuth Langsung (Kerangka)';
  readonly isMock = false;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async fetchAccounts(_quotaSemantics: QuotaSemantics = 'remaining'): Promise<ProviderQuotaResult[]> {
    throw new Error(
      'OAuthProvider mandiri belum diaktifkan di versi ini. Silakan gunakan CcsProvider atau MockProvider.'
    );
  }
}

