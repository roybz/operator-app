import { UsageQuotaService } from './usage-quota.service';

describe('UsageQuotaService', () => {
  afterEach(() => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    delete w.__OP_CONFIG__;
  });

  it('returns sane defaults when runtime quotas are missing', () => {
    const service = new UsageQuotaService();
    const limits = service.getLimits();
    expect(limits.requestsPerMinute).toBeGreaterThan(0);
    expect(limits.vaultAttachmentAssetBytes).toBeGreaterThan(0);
  });

  it('uses runtime quota overrides when provided', () => {
    const w = window as Window & { __OP_CONFIG__?: Record<string, unknown> };
    w.__OP_CONFIG__ = {
      quotaRequestsPerMinute: 321,
      quotaVaultAttachmentAssetBytes: 654321,
    };
    const service = new UsageQuotaService();
    const limits = service.getLimits();
    expect(limits.requestsPerMinute).toBe(321);
    expect(limits.vaultAttachmentAssetBytes).toBe(654321);
  });

  it('tracks runtime request and realtime usage counters', () => {
    const service = new UsageQuotaService();
    service.updateRequestRateUsage(12, 240);
    service.setRealtimeChannelsInUse(2);
    expect(service.usage().requestRateCount).toBe(12);
    expect(service.usage().requestRateLimit).toBe(240);
    expect(service.usage().realtimeChannelsInUse).toBe(2);
  });
});
