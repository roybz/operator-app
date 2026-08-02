import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { vi } from 'vitest';
import { AuthService, UserPreferences } from '../../../core/auth.service';
import { LlmActionCardService } from '../../../core/llm/llm-action-card.service';
import { LlmActionLogService } from '../../../core/llm/llm-action-log.service';
import { LlmCredentialRefService } from '../../../core/llm/llm-credential-ref.service';
import { LlmResidentAdminService } from '../../../core/llm/llm-resident-admin.service';
import { SettingsDraftService } from '../settings-draft.service';
import { MultiUserSettingsComponent } from './multi-user.component';

describe('MultiUserSettingsComponent', () => {
  const basePrefs = {
    universeId: 'univ_1',
    multiUserEnabled: true,
    allowUniverseGuests: false,
    allowUniverseObservers: false,
    allowUniverseChat: true,
    universeGuestPassword: '',
    universeObserverPassword: '',
  } as unknown as UserPreferences;

  const authStub = {
    session: vi.fn(() => ({ universeOwnerId: 'owner_1', userId: 'owner_1' })),
    actualUser: vi.fn(() => ({ id: 'owner_1', role: 'admin' })),
    canInvite: vi.fn(() => true),
    canGrantPencil: vi.fn(() => true),
    getInviteesForOwner: vi.fn(() => []),
    hashPassword: vi.fn(async (value: string) => `hash_${value}`),
    setUniverseId: vi.fn(),
    createInvitee: vi.fn(async () => ({ ok: true })),
    updateInvitee: vi.fn(async () => ({ ok: true })),
    deleteInvitee: vi.fn(),
  };

  const draftStub = {
    preferences: vi.fn(() => ({ ...basePrefs })),
    updatePreferences: vi.fn(),
  };

  const llmAdminStub = {
    loadState: vi.fn(async () => ({
      residents: [],
      policy: {
        enabled: false,
        requireActionConfirmation: true,
        maxActionsPerMinute: 20,
        maxTokensPerMinute: 12000,
        allowDestructiveActions: false,
      },
      lease: null,
    })),
    setPolicy: vi.fn(async () => ({ ok: true })),
    upsertResident: vi.fn(async () => ({ ok: true, residents: [] })),
    removeResident: vi.fn(async () => ({ ok: true, residents: [] })),
    grantLease: vi.fn(async () => ({ ok: true })),
    revokeLease: vi.fn(async () => ({ ok: true })),
  };

  const llmActionLogStub = {
    list: vi.fn(async () => []),
    clear: vi.fn(async () => undefined),
  };
  const llmActionCardsStub = {
    list: vi.fn(async () => []),
    clear: vi.fn(async () => undefined),
    propose: vi.fn(async () => ({ ok: true })),
    approve: vi.fn(async () => ({ ok: true })),
    deny: vi.fn(async () => ({ ok: true })),
    execute: vi.fn(async () => ({ ok: true })),
  };
  const llmCredentialRefsStub = {
    listForCurrentUser: vi.fn(async () => []),
  };

  const translateStub = {
    instant: vi.fn((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [MultiUserSettingsComponent],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: SettingsDraftService, useValue: draftStub },
        { provide: LlmResidentAdminService, useValue: llmAdminStub },
        { provide: LlmActionLogService, useValue: llmActionLogStub },
        { provide: LlmActionCardService, useValue: llmActionCardsStub },
        { provide: LlmCredentialRefService, useValue: llmCredentialRefsStub },
        { provide: TranslateService, useValue: translateStub },
      ],
    })
      .overrideComponent(MultiUserSettingsComponent, {
        set: { template: '<section>stub</section>' },
      })
      .compileComponents();
  });

  it('loads llm resident state for current universe', async () => {
    const fixture = TestBed.createComponent(MultiUserSettingsComponent);
    const component = fixture.componentInstance;

    await component.refreshLlmState();

    expect(llmAdminStub.loadState).toHaveBeenCalledWith({
      universeOwnerId: 'owner_1',
      universeId: 'univ_1',
    });
    expect(llmActionLogStub.list).toHaveBeenCalledWith({
      universeOwnerId: 'owner_1',
      universeId: 'univ_1',
    });
    expect(llmActionCardsStub.list).toHaveBeenCalledWith({
      universeOwnerId: 'owner_1',
      universeId: 'univ_1',
    });
    expect(llmCredentialRefsStub.listForCurrentUser).toHaveBeenCalled();
  });

  it('rejects invalid resident save requests without id, name, and model', async () => {
    const fixture = TestBed.createComponent(MultiUserSettingsComponent);
    const component = fixture.componentInstance;

    component.residentId.set('');
    component.residentName.set('Agent');
    component.residentModel.set('gpt-5.4');
    await component.saveResident();
    expect(component.llmError()).toBe('Resident ID, name, and model are required.');
    expect(llmAdminStub.upsertResident).not.toHaveBeenCalled();
  });

  it('persists resident and policy through admin service', async () => {
    const fixture = TestBed.createComponent(MultiUserSettingsComponent);
    const component = fixture.componentInstance;

    component.llmPolicy.set({
      enabled: true,
      requireActionConfirmation: false,
      maxActionsPerMinute: 10,
      maxTokensPerMinute: 5000,
      allowDestructiveActions: false,
    });
    await component.saveLlmPolicy();
    expect(llmAdminStub.setPolicy).toHaveBeenCalledTimes(1);

    component.residentId.set('res_1');
    component.residentName.set('Agent One');
    component.residentModel.set('gpt-5.4');
    await component.saveResident();
    expect(llmAdminStub.upsertResident).toHaveBeenCalledTimes(1);
  });
});
