import { Injectable } from '@angular/core';
import { getOpConfig } from '../op-config';

export interface QuotaLimits {
  storageBytes: number;
  requestsPerMinute: number;
  realtimeChannels: number;
  vaultTotalBytes: number;
  vaultAttachmentTotalBytes: number;
  vaultAttachmentAssetBytes: number;
}

const DEFAULT_LIMITS: QuotaLimits = {
  storageBytes: 24 * 1024 * 1024,
  requestsPerMinute: 240,
  realtimeChannels: 6,
  vaultTotalBytes: 6 * 1024 * 1024,
  vaultAttachmentTotalBytes: 1_572_864,
  vaultAttachmentAssetBytes: 393_216,
};

@Injectable({ providedIn: 'root' })
export class UsageQuotaService {
  getLimits(): QuotaLimits {
    const cfg = getOpConfig();
    return {
      storageBytes: this.clampQuota(cfg.quotaStorageBytes, DEFAULT_LIMITS.storageBytes, 256 * 1024),
      requestsPerMinute: this.clampQuota(
        cfg.quotaRequestsPerMinute,
        DEFAULT_LIMITS.requestsPerMinute,
        30,
      ),
      realtimeChannels: this.clampQuota(
        cfg.quotaRealtimeChannels,
        DEFAULT_LIMITS.realtimeChannels,
        1,
      ),
      vaultTotalBytes: this.clampQuota(
        cfg.quotaVaultTotalBytes,
        DEFAULT_LIMITS.vaultTotalBytes,
        512 * 1024,
      ),
      vaultAttachmentTotalBytes: this.clampQuota(
        cfg.quotaVaultAttachmentTotalBytes,
        cfg.cloudVaultAttachmentUploadMaxTotalBytes ?? DEFAULT_LIMITS.vaultAttachmentTotalBytes,
        64 * 1024,
      ),
      vaultAttachmentAssetBytes: this.clampQuota(
        cfg.quotaVaultAttachmentAssetBytes,
        cfg.cloudVaultAttachmentUploadMaxAssetBytes ?? DEFAULT_LIMITS.vaultAttachmentAssetBytes,
        32 * 1024,
      ),
    };
  }

  private clampQuota(value: unknown, fallback: number, min: number) {
    const numeric = Number(value ?? fallback);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.max(min, Math.floor(numeric));
  }
}

