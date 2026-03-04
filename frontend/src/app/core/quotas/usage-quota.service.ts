import { Injectable, signal } from '@angular/core';
import { getOpConfig } from '../op-config';

export interface QuotaLimits {
  storageBytes: number;
  requestsPerMinute: number;
  realtimeChannels: number;
  vaultTotalBytes: number;
  vaultAttachmentTotalBytes: number;
  vaultAttachmentAssetBytes: number;
}

export interface QuotaUsageSnapshot {
  requestRateCount: number;
  requestRateLimit: number;
  realtimeChannelsInUse: number;
  updatedAt: number;
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
  readonly usage = signal<QuotaUsageSnapshot>({
    requestRateCount: 0,
    requestRateLimit: 0,
    realtimeChannelsInUse: 0,
    updatedAt: Date.now(),
  });

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

  updateRequestRateUsage(count: number, limit: number) {
    const nextCount = this.asNonNegativeInt(count);
    const nextLimit = this.asNonNegativeInt(limit);
    this.usage.update((prev) => ({
      ...prev,
      requestRateCount: nextCount,
      requestRateLimit: nextLimit,
      updatedAt: Date.now(),
    }));
  }

  setRealtimeChannelsInUse(count: number) {
    const nextCount = this.asNonNegativeInt(count);
    this.usage.update((prev) => ({
      ...prev,
      realtimeChannelsInUse: nextCount,
      updatedAt: Date.now(),
    }));
  }

  private clampQuota(value: unknown, fallback: number, min: number) {
    const numeric = Number(value ?? fallback);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return Math.max(min, Math.floor(numeric));
  }

  private asNonNegativeInt(value: unknown) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return 0;
    return Math.floor(numeric);
  }
}
