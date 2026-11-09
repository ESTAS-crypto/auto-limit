/**
 * src/lib/providers/index.ts
 * Registri dan Factory Provider Kuota Antigravity.
 */

import { QuotaProvider } from './types';
import { MockProvider } from './mock';
import { CcsProvider } from './ccs';
import { AntigravityCliProvider } from './antigravity-cli';
import { OAuthProvider } from './oauth';

export * from './types';
export * from './mock';
export * from './ccs';
export * from './antigravity-cli';
export * from './oauth';

export async function getActiveProvider(): Promise<QuotaProvider> {
  const providerEnv = (process.env.QUOTA_PROVIDER || 'mock').toLowerCase().trim();

  if (providerEnv === 'ccs') {
    const ccs = new CcsProvider();
    if (await ccs.isAvailable()) {
      return ccs;
    }
    console.warn('[Provider] CCS tidak tersedia, fallback ke MockProvider.');
  }

  if (providerEnv === 'antigravity-cli') {
    const agCli = new AntigravityCliProvider();
    if (await agCli.isAvailable()) {
      return agCli;
    }
    console.warn('[Provider] antigravity-cli tidak tersedia, fallback ke MockProvider.');
  }

  if (providerEnv === 'oauth') {
    return new OAuthProvider();
  }

  // Bawaan: MockProvider
  return new MockProvider();
}

