import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { StorageService } from '../storage/storage.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { LlmPolicyService } from './llm-policy.service';
import { LlmActionCard, LlmAllowedActionType, LlmContext, LlmProviderRequest } from './llm-types';

const ACTION_CARD_KEY_PREFIX = 'op_llm_action_cards_v1';
const MAX_ACTION_CARDS = 250;

@Injectable({ providedIn: 'root' })
export class LlmActionCardService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  private readonly policy = inject(LlmPolicyService);
  private readonly orchestrator = inject(LlmOrchestratorService);

  async list(context: LlmContext): Promise<LlmActionCard[]> {
    return this.storage.getJson<LlmActionCard[]>(this.key(context), []);
  }

  async propose(
    context: LlmContext,
    input: {
      residentId: string;
      credentialRefId: string;
      actionType: LlmAllowedActionType;
      model: string;
      prompt: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<{ ok: boolean; card?: LlmActionCard; message?: string }> {
    const userId = this.auth.actualUser()?.id;
    if (!userId) return { ok: false, message: 'llm.workflow.noUser' };
    const prompt = input.prompt.trim();
    const model = input.model.trim();
    if (!prompt || !model) return { ok: false, message: 'llm.workflow.invalidInput' };

    const card: LlmActionCard = {
      id: this.uid('llmcard'),
      universeOwnerId: context.universeOwnerId,
      universeId: context.universeId,
      residentId: input.residentId.trim(),
      credentialRefId: input.credentialRefId.trim(),
      actionType: input.actionType,
      model,
      prompt,
      payload: input.payload,
      status: 'proposed',
      createdBy: userId,
      createdAt: Date.now(),
    };
    const current = await this.list(context);
    const next = [card, ...current].slice(0, MAX_ACTION_CARDS);
    await this.storage.setJson(this.key(context), next);
    return { ok: true, card };
  }

  async approve(
    context: LlmContext,
    cardId: string,
  ): Promise<{ ok: boolean; card?: LlmActionCard }> {
    const userId = this.auth.actualUser()?.id;
    if (!userId) return { ok: false };
    return this.updateCard(context, cardId, (card) => ({
      ...card,
      status: 'approved',
      approvedBy: userId,
      approvedAt: Date.now(),
      deniedAt: undefined,
      deniedBy: undefined,
      errorMessage: undefined,
    }));
  }

  async deny(context: LlmContext, cardId: string): Promise<{ ok: boolean; card?: LlmActionCard }> {
    const userId = this.auth.actualUser()?.id;
    if (!userId) return { ok: false };
    return this.updateCard(context, cardId, (card) => ({
      ...card,
      status: 'denied',
      deniedBy: userId,
      deniedAt: Date.now(),
      errorMessage: undefined,
    }));
  }

  async execute(
    context: LlmContext,
    cardId: string,
  ): Promise<{ ok: boolean; card?: LlmActionCard; message?: string }> {
    const cards = await this.list(context);
    const current = cards.find((card) => card.id === cardId);
    if (!current) return { ok: false, message: 'llm.workflow.notFound' };
    const policy = await this.policy.getPolicy(context);
    if (policy.requireActionConfirmation && current.status !== 'approved') {
      return { ok: false, message: 'llm.workflow.approvalRequired' };
    }

    await this.updateCard(context, cardId, (card) => ({
      ...card,
      status: 'executing',
      errorMessage: undefined,
    }));

    const requestId = `${cardId}_${Date.now().toString(36)}`;
    const request: LlmProviderRequest = {
      model: current.model,
      prompt: current.prompt,
    };
    const result = await this.orchestrator.execute({
      context,
      residentId: current.residentId,
      credentialRefId: current.credentialRefId,
      requestId,
      actionType: current.actionType,
      request,
      payload: current.payload,
    });

    const userId = this.auth.actualUser()?.id ?? 'unknown';
    if (!result.ok) {
      const failed = await this.updateCard(context, cardId, (card) => ({
        ...card,
        status: 'failed',
        executedBy: userId,
        executedAt: Date.now(),
        errorMessage: result.message ?? 'llm.provider.failed',
      }));
      return { ok: false, card: failed.card, message: result.message };
    }

    const executed = await this.updateCard(context, cardId, (card) => ({
      ...card,
      status: 'executed',
      executedBy: userId,
      executedAt: Date.now(),
      responseText: result.response?.text?.slice(0, 2_000) ?? '',
      errorMessage: undefined,
    }));
    return { ok: true, card: executed.card };
  }

  async clear(context: LlmContext): Promise<void> {
    await this.storage.setJson(this.key(context), []);
  }

  private async updateCard(
    context: LlmContext,
    cardId: string,
    updater: (card: LlmActionCard) => LlmActionCard,
  ): Promise<{ ok: boolean; card?: LlmActionCard }> {
    const current = await this.list(context);
    let updated: LlmActionCard | undefined;
    const next = current.map((card) => {
      if (card.id !== cardId) return card;
      updated = updater(card);
      return updated;
    });
    if (!updated) return { ok: false };
    await this.storage.setJson(this.key(context), next);
    return { ok: true, card: updated };
  }

  private key(context: LlmContext): string {
    return `${ACTION_CARD_KEY_PREFIX}:${context.universeOwnerId}:${context.universeId}`;
  }

  private uid(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
