import { Injectable, inject } from '@angular/core';
import {
  LlmActionEnvelope,
  LlmAllowedActionType,
  LlmContext,
  LlmCredentialRef,
  LlmProviderRequest,
  LlmProviderResponse,
} from './llm-types';
import { LlmActionLogService } from './llm-action-log.service';
import { LlmCredentialRefService } from './llm-credential-ref.service';
import { LlmEnvelopeGuardService } from './llm-envelope-guard.service';
import { LlmModeGuardService } from './llm-mode-guard.service';
import { LlmPolicyService } from './llm-policy.service';
import { LlmProviderRegistryService } from './llm-provider-registry.service';
import { LlmResidentService } from './llm-resident.service';
import { LlmSecretBrokerService } from './llm-secret-broker.service';

export interface LlmExecutionInput {
  context: LlmContext;
  residentId: string;
  credentialRefId: string;
  requestId: string;
  actionType: LlmAllowedActionType;
  request: LlmProviderRequest;
  payload?: Record<string, unknown>;
}

interface LlmExecutionResult {
  ok: boolean;
  message?: string;
  response?: LlmProviderResponse;
  deduplicated?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LlmOrchestratorService {
  private readonly modeGuard = inject(LlmModeGuardService);
  private readonly policy = inject(LlmPolicyService);
  private readonly credentialRefs = inject(LlmCredentialRefService);
  private readonly providers = inject(LlmProviderRegistryService);
  private readonly residents = inject(LlmResidentService);
  private readonly envelopeGuard = inject(LlmEnvelopeGuardService);
  private readonly actionLog = inject(LlmActionLogService);
  private readonly secretBroker = inject(LlmSecretBrokerService);

  private readonly actionWindow = new Map<string, number[]>();
  private readonly tokenWindow = new Map<string, { ts: number; tokens: number }[]>();

  // Backward-compatible wrapper while the UI wiring migrates to explicit execution envelopes.
  async complete(
    context: LlmContext,
    credentialRefId: string,
    request: LlmProviderRequest,
  ): Promise<LlmExecutionResult> {
    const generatedRequestId = `llmreq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return this.execute({
      context,
      residentId: 'r_system',
      credentialRefId,
      requestId: generatedRequestId,
      actionType: 'chat.post',
      request,
      payload: { promptPreview: request.prompt.slice(0, 120) },
    });
  }

  async execute(input: LlmExecutionInput): Promise<LlmExecutionResult> {
    const { context, residentId, requestId, actionType, request } = input;
    const guard = this.modeGuard.assertCloudLlmAllowed();
    if (!guard.ok) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        guard.message,
        input.payload,
      );
      return guard;
    }

    const policy = await this.policy.getPolicy(context);
    if (!policy.enabled) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.policy.disabled',
        input.payload,
      );
      return { ok: false, message: 'llm.policy.disabled' };
    }

    const seen = await this.envelopeGuard.hasSeen(
      context.universeOwnerId,
      context.universeId,
      requestId,
    );
    if (seen) {
      return { ok: true, deduplicated: true, message: 'llm.request.duplicate' };
    }

    const resident = (await this.residents.list(context)).find((entry) => entry.id === residentId);
    if (!resident || !resident.active) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.resident.notActive',
        input.payload,
      );
      return { ok: false, message: 'llm.resident.notActive' };
    }
    if (!this.isActionAllowedByResident(actionType, resident.permissions)) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.resident.actionDenied',
        input.payload,
      );
      return { ok: false, message: 'llm.resident.actionDenied' };
    }

    const refs = await this.credentialRefs.listForCurrentUser();
    const ref = refs.find((entry) => entry.id === input.credentialRefId);
    if (!ref) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.credentials.notFound',
        input.payload,
      );
      return { ok: false, message: 'llm.credentials.notFound' };
    }
    if (ref.status === 'revoked') {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.credentials.revoked',
        input.payload,
      );
      return { ok: false, message: 'llm.credentials.revoked' };
    }

    const rateAllowed = this.consumeActionAllowance(context, policy.maxActionsPerMinute);
    if (!rateAllowed) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.rate.actionLimit',
        input.payload,
      );
      return { ok: false, message: 'llm.rate.actionLimit' };
    }

    const estimatedRequestTokens = this.estimateTokens(request.prompt);
    const tokenAllowed = this.consumeTokenAllowance(
      context,
      policy.maxTokensPerMinute,
      estimatedRequestTokens,
    );
    if (!tokenAllowed) {
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.rate.tokenLimit',
        input.payload,
      );
      return { ok: false, message: 'llm.rate.tokenLimit' };
    }

    try {
      await this.envelopeGuard.markSeen(context.universeOwnerId, context.universeId, requestId);
      const response = await this.completeRequest({
        ref,
        input,
        context,
        residentId,
        requestId,
      });
      if (!response.ok) {
        await this.log(
          context,
          residentId,
          requestId,
          actionType,
          false,
          response.message ?? 'llm.provider.failed',
          input.payload,
        );
        return response;
      }
      await this.log(context, residentId, requestId, actionType, true, undefined, input.payload);
      return response;
    } catch {
      // Do not include provider secrets or request details in surfaced errors.
      await this.log(
        context,
        residentId,
        requestId,
        actionType,
        false,
        'llm.provider.failed',
        input.payload,
      );
      return { ok: false, message: 'llm.provider.failed' };
    }
  }

  private async completeRequest(args: {
    ref: LlmCredentialRef;
    input: LlmExecutionInput;
    context: LlmContext;
    residentId: string;
    requestId: string;
  }): Promise<LlmExecutionResult> {
    const { ref, input, context, residentId, requestId } = args;
    if (ref.mode === 'serverHeld') {
      return this.secretBroker.execute({
        context,
        residentId,
        credentialRef: ref,
        requestId,
        actionType: input.actionType,
        request: input.request,
      });
    }

    const secret = this.credentialRefs.getSecret(input.credentialRefId);
    if (!secret) {
      return { ok: false, message: 'llm.credentials.secretMissing' };
    }

    const adapter = this.providers.resolve(ref.provider);
    if (!adapter.supportsClientHeld) {
      return { ok: false, message: 'llm.credentials.modeUnsupported' };
    }
    const validation = await adapter.validateCredential(secret);
    if (!validation.ok) {
      return { ok: false, message: validation.message ?? 'llm.credentials.invalid' };
    }
    const providerResponse = await adapter.complete(input.request, secret);
    return { ok: true, response: providerResponse };
  }

  private consumeActionAllowance(context: LlmContext, maxActionsPerMinute: number): boolean {
    const key = `${context.universeOwnerId}:${context.universeId}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const current = (this.actionWindow.get(key) ?? []).filter(
      (timestamp) => timestamp >= oneMinuteAgo,
    );
    if (current.length >= maxActionsPerMinute) {
      this.actionWindow.set(key, current);
      return false;
    }
    current.push(now);
    this.actionWindow.set(key, current);
    return true;
  }

  private consumeTokenAllowance(
    context: LlmContext,
    maxTokensPerMinute: number,
    estimatedRequestTokens: number,
  ): boolean {
    const key = `${context.universeOwnerId}:${context.universeId}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const current = (this.tokenWindow.get(key) ?? []).filter((entry) => entry.ts >= oneMinuteAgo);
    const used = current.reduce((sum, entry) => sum + entry.tokens, 0);
    if (used + estimatedRequestTokens > maxTokensPerMinute) {
      this.tokenWindow.set(key, current);
      return false;
    }
    current.push({ ts: now, tokens: estimatedRequestTokens });
    this.tokenWindow.set(key, current);
    return true;
  }

  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private isActionAllowedByResident(
    actionType: LlmAllowedActionType,
    permissions: {
      canWrite: boolean;
      canMoveDialogs: boolean;
      canCreateInstances: boolean;
      canComment: boolean;
    },
  ): boolean {
    switch (actionType) {
      case 'instance.write':
        return permissions.canWrite;
      case 'instance.create':
        return permissions.canCreateInstances;
      case 'dialog.move':
      case 'dialog.resize':
        return permissions.canMoveDialogs;
      case 'chat.post':
      case 'comment.create':
        return permissions.canComment;
      default:
        return false;
    }
  }

  private async log(
    context: LlmContext,
    residentId: string,
    requestId: string,
    actionType: LlmAllowedActionType,
    success: boolean,
    errorMessage?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const entry: LlmActionEnvelope = {
      id: requestId,
      requestId,
      residentId,
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      actionType,
      payload: this.redact(payload ?? {}),
      success,
      errorMessage,
      createdAt: Date.now(),
    };
    await this.actionLog.append(context, entry);
  }

  private redact(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (/secret|token|password|api[_-]?key|credential/i.test(key)) {
        out[key] = '[REDACTED]';
        continue;
      }
      if (typeof value === 'object' && value && !Array.isArray(value)) {
        out[key] = this.redact(value as Record<string, unknown>);
        continue;
      }
      out[key] = value;
    }
    return out;
  }
}
