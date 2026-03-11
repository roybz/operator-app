import { Component, Input, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, InviteeRecord, UserPreferences } from '../../../core/auth.service';
import { SettingsDraftService } from '../settings-draft.service';
import { SharedTableComponent, TableColumn } from '../../../shared/table/table.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LlmActionCardService } from '../../../core/llm/llm-action-card.service';
import { LlmActionLogService } from '../../../core/llm/llm-action-log.service';
import { LlmCredentialRefService } from '../../../core/llm/llm-credential-ref.service';
import { LlmPencilLease } from '../../../core/llm/llm-pencil-lease.service';
import { LlmResidentAdminService } from '../../../core/llm/llm-resident-admin.service';
import {
  DEFAULT_LLM_POLICY,
  LlmActionCard,
  LlmActionEnvelope,
  LlmAllowedActionType,
  LlmContext,
  LlmPolicy,
  LlmProvider,
  LlmResident,
  LlmResidentPermissions,
  LlmResidentRole,
} from '../../../core/llm/llm-types';

@Component({
  selector: 'app-multi-user-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SharedTableComponent, ConfirmDialogComponent],
  template: `
    <section>
      <h3>
        {{
          mode === 'llm' ? ('settings.llmLink' | translate) : ('settings.multiUserLink' | translate)
        }}
      </h3>

      @if (showCollaborationSection()) {
        <div style="display:grid; gap:12px; max-width: 560px;">
          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="prefs().multiUserEnabled"
              (change)="onMultiUserToggle($event)"
            />
            {{ 'universe.multiUser' | translate }}
          </label>

          <div style="display:flex; flex-direction:column; gap:6px;">
            <span>{{ 'universe.linkLabel' | translate }}</span>
            <code>{{ universeLink() }}</code>
            <button
              (click)="openLinkConfirm()"
              [disabled]="!prefs().multiUserEnabled || !canManageInvites()"
            >
              {{ 'universe.changeLink' | translate }}
            </button>
          </div>

          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="prefs().allowUniverseGuests"
              (change)="onGuestToggle($event)"
              [disabled]="!prefs().multiUserEnabled"
            />
            {{ 'universe.allowGuests' | translate }}
          </label>

          @if (prefs().allowUniverseGuests) {
            <label>
              {{ 'universe.guestPassword' | translate }}
              <input
                type="password"
                [value]="guestPassword()"
                (input)="guestPassword.set($any($event.target).value)"
              />
              <button style="margin-left:8px;" (click)="applyGuestPassword()">
                {{ 'universe.savePassword' | translate }}
              </button>
            </label>
          }

          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="prefs().allowUniverseObservers"
              (change)="onObserverToggle($event)"
              [disabled]="!prefs().multiUserEnabled"
            />
            {{ 'universe.allowObservers' | translate }}
          </label>

          @if (prefs().allowUniverseObservers) {
            <label>
              {{ 'universe.observerPassword' | translate }}
              <input
                type="password"
                [value]="observerPassword()"
                (input)="observerPassword.set($any($event.target).value)"
              />
              <button style="margin-left:8px;" (click)="applyObserverPassword()">
                {{ 'universe.savePassword' | translate }}
              </button>
            </label>
          }

          <label style="display:flex; gap:8px; align-items:center;">
            <input
              type="checkbox"
              [checked]="prefs().allowUniverseChat"
              (change)="onChatToggle($event)"
              [disabled]="!prefs().multiUserEnabled"
            />
            {{ 'universe.allowChat' | translate }}
          </label>
        </div>

        <section style="margin-top: 24px;">
          <h4>{{ 'universe.inviteesTitle' | translate }}</h4>

          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width: 320px;">
              <app-shared-table
                [columns]="columns"
                [rows]="invitees()"
                [actionsTemplate]="actionsTpl"
                [searchPlaceholder]="'users.search' | translate"
                [emptyMessage]="'users.empty'"
              />
              <ng-template #actionsTpl let-row>
                <button [disabled]="!canManageInvites()" (click)="startEdit(row)">
                  {{ 'users.edit' | translate }}
                </button>
                <button [disabled]="!canManageInvites()" (click)="remove(row)">
                  {{ 'users.delete' | translate }}
                </button>
              </ng-template>
            </div>

            <div style="flex:1; min-width: 280px;">
              <h4 style="margin-top:0;">{{ formTitle() }}</h4>

              <label for="invitee-username" style="display:block; margin: 8px 0 4px;">
                {{ 'users.username' | translate }}
              </label>
              <input
                id="invitee-username"
                #inviteeUsernameInput
                type="text"
                [value]="username()"
                (input)="username.set(inviteeUsernameInput.value)"
                style="width:100%; padding:8px;"
              />

              <label for="invitee-password" style="display:block; margin: 8px 0 4px;">
                {{ 'users.password' | translate }}
              </label>
              <input
                id="invitee-password"
                #inviteePasswordInput
                type="password"
                [value]="password()"
                (input)="password.set(inviteePasswordInput.value)"
                style="width:100%; padding:8px;"
              />

              @if (error()) {
                <p style="color:#b00020; margin-top: 8px;">{{ error() }}</p>
              }

              <div style="display:flex; gap:8px; margin-top: 12px;">
                <button [disabled]="!canManageInvites()" (click)="save()">{{ saveLabel() }}</button>
                <button [disabled]="!canManageInvites()" (click)="reset()">
                  {{ 'users.reset' | translate }}
                </button>
              </div>
            </div>
          </div>
        </section>
      }

      @if (showLlmSection() && canManageInvites()) {
        <section style="margin-top: 24px;">
          <h4 style="margin:0 0 8px;">LLM residents (beta)</h4>
          <p style="margin:0 0 12px; opacity:0.8;">
            Residents are disabled in guest mode and in test mode.
          </p>

          @if (llmError()) {
            <p style="color:#b00020; margin:0 0 10px;">{{ llmError() }}</p>
          }
          @if (llmNotice()) {
            <p style="color:#00695c; margin:0 0 10px;">{{ llmNotice() }}</p>
          }

          <fieldset style="border:1px solid #ddd; border-radius:8px; padding:12px;">
            <legend>Policy</legend>
            <label style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
              <input
                type="checkbox"
                [checked]="llmPolicy().enabled"
                (change)="setPolicyEnabled($event)"
              />
              Enable LLM residents
            </label>
            <label style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
              <input
                type="checkbox"
                [checked]="llmPolicy().requireActionConfirmation"
                (change)="setPolicyRequireConfirmation($event)"
              />
              Require action confirmation
            </label>
            <label style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
              <input
                type="checkbox"
                [checked]="llmPolicy().allowDestructiveActions"
                (change)="setPolicyDestructive($event)"
              />
              Allow destructive actions
            </label>
            <div
              style="display:grid; gap:8px; grid-template-columns: repeat(2, minmax(180px, 1fr));"
            >
              <label>
                Max actions / minute
                <input
                  type="number"
                  min="1"
                  [value]="llmPolicy().maxActionsPerMinute"
                  (input)="setPolicyActionsPerMinute($event)"
                  style="width:100%; padding:8px;"
                />
              </label>
              <label>
                Max tokens / minute
                <input
                  type="number"
                  min="200"
                  [value]="llmPolicy().maxTokensPerMinute"
                  (input)="setPolicyTokensPerMinute($event)"
                  style="width:100%; padding:8px;"
                />
              </label>
            </div>
            <button style="margin-top:10px;" (click)="saveLlmPolicy()">Save policy</button>
          </fieldset>

          <fieldset
            style="border:1px solid #ddd; border-radius:8px; padding:12px; margin-top:12px;"
          >
            <legend>{{ residentEditId() ? 'Edit resident' : 'Create resident' }}</legend>
            <div
              style="display:grid; gap:8px; grid-template-columns: repeat(2, minmax(180px, 1fr));"
            >
              <label>
                Resident ID
                <input
                  type="text"
                  [value]="residentId()"
                  (input)="residentId.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  [value]="residentName()"
                  (input)="residentName.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                />
              </label>
              <label>
                Provider
                <select
                  [value]="residentProvider()"
                  (change)="residentProvider.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                >
                  @for (provider of llmProviders; track provider) {
                    <option [value]="provider">{{ provider }}</option>
                  }
                </select>
              </label>
              <label>
                Model
                <input
                  type="text"
                  [value]="residentModel()"
                  (input)="residentModel.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                />
              </label>
              <label>
                Role
                <select
                  [value]="residentRole()"
                  (change)="residentRole.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                >
                  <option value="observer">observer</option>
                  <option value="editor">editor</option>
                </select>
              </label>
              <label style="display:flex; gap:8px; align-items:center; margin-top:20px;">
                <input
                  type="checkbox"
                  [checked]="residentActive()"
                  (change)="residentActive.set($any($event.target).checked)"
                />
                Active
              </label>
            </div>
            <div
              style="display:grid; gap:8px; grid-template-columns: repeat(2, minmax(200px, 1fr)); margin-top:8px;"
            >
              <label style="display:flex; gap:8px; align-items:center;">
                <input
                  type="checkbox"
                  [checked]="residentPermissions().canWrite"
                  (change)="setResidentPermission('canWrite', $any($event.target).checked)"
                />
                Can write
              </label>
              <label style="display:flex; gap:8px; align-items:center;">
                <input
                  type="checkbox"
                  [checked]="residentPermissions().canMoveDialogs"
                  (change)="setResidentPermission('canMoveDialogs', $any($event.target).checked)"
                />
                Can move dialogs
              </label>
              <label style="display:flex; gap:8px; align-items:center;">
                <input
                  type="checkbox"
                  [checked]="residentPermissions().canCreateInstances"
                  (change)="
                    setResidentPermission('canCreateInstances', $any($event.target).checked)
                  "
                />
                Can create instances
              </label>
              <label style="display:flex; gap:8px; align-items:center;">
                <input
                  type="checkbox"
                  [checked]="residentPermissions().canComment"
                  (change)="setResidentPermission('canComment', $any($event.target).checked)"
                />
                Can comment/chat
              </label>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button (click)="saveResident()">
                {{ residentEditId() ? 'Update resident' : 'Create resident' }}
              </button>
              <button (click)="resetResidentEditor()">Reset</button>
            </div>
          </fieldset>

          <div style="display:grid; gap:8px; margin-top:12px;">
            @for (resident of llmResidents(); track resident.id) {
              <article style="border:1px solid #ddd; border-radius:8px; padding:10px;">
                <div
                  style="display:flex; align-items:center; justify-content:space-between; gap:8px;"
                >
                  <strong>{{ resident.name }}</strong>
                  <small
                    >{{ resident.provider }} | {{ resident.role }} |
                    {{ resident.active ? 'active' : 'inactive' }}</small
                  >
                </div>
                <div style="margin-top:4px; opacity:0.85;">
                  {{ resident.id }} | {{ resident.model }}
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                  <span>write={{ resident.permissions.canWrite ? 'yes' : 'no' }}</span>
                  <span>move={{ resident.permissions.canMoveDialogs ? 'yes' : 'no' }}</span>
                  <span>create={{ resident.permissions.canCreateInstances ? 'yes' : 'no' }}</span>
                  <span>comment={{ resident.permissions.canComment ? 'yes' : 'no' }}</span>
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                  <button (click)="editResident(resident)">Edit</button>
                  <button (click)="removeResident(resident.id)">Delete</button>
                  <button (click)="grantResidentLease(resident.id, resident.name)">
                    Grant pencil
                  </button>
                </div>
              </article>
            }
          </div>

          <fieldset
            style="border:1px solid #ddd; border-radius:8px; padding:12px; margin-top:12px;"
          >
            <legend>Pencil lease</legend>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <label>
                TTL (seconds)
                <input
                  type="number"
                  min="15"
                  [value]="leaseTtlSeconds()"
                  (input)="leaseTtlSeconds.set(parsePositiveInt($any($event.target).value, 300))"
                  style="width:120px; padding:8px;"
                />
              </label>
              <button (click)="revokeResidentLease()">Revoke lease</button>
            </div>
            @if (llmLease()) {
              <p style="margin:10px 0 0;">
                Active lease: {{ llmLease()!.residentName }} ({{ llmLease()!.residentId }}) until
                {{ formatTimestamp(llmLease()!.expiresAt) }}
              </p>
            } @else {
              <p style="margin:10px 0 0; opacity:0.8;">No active resident pencil lease.</p>
            }
          </fieldset>

          <fieldset
            style="border:1px solid #ddd; border-radius:8px; padding:12px; margin-top:12px;"
          >
            <legend>Action log</legend>
            <div style="display:flex; gap:8px; margin-bottom:10px;">
              <button (click)="refreshLlmState()">Refresh</button>
              <button (click)="clearActionLog()">Clear</button>
            </div>
            <div style="display:grid; gap:8px; max-height:240px; overflow:auto;">
              @for (entry of llmActionLog(); track entry.id + '-' + entry.createdAt) {
                <article style="border:1px solid #ddd; border-radius:8px; padding:8px;">
                  <div style="display:flex; justify-content:space-between; gap:8px;">
                    <strong>{{ entry.actionType }}</strong>
                    <small>{{ entry.success ? 'ok' : 'error' }}</small>
                  </div>
                  <div style="margin-top:4px; opacity:0.85;">
                    {{ entry.residentId }} | {{ formatTimestamp(entry.createdAt) }}
                  </div>
                  @if (entry.errorMessage) {
                    <div style="margin-top:4px; color:#b00020;">{{ entry.errorMessage }}</div>
                  }
                  <pre style="margin:8px 0 0; white-space:pre-wrap;">{{
                    formatPayload(entry)
                  }}</pre>
                </article>
              } @empty {
                <p style="margin:0; opacity:0.8;">No resident actions yet.</p>
              }
            </div>
          </fieldset>

          <fieldset
            style="border:1px solid #ddd; border-radius:8px; padding:12px; margin-top:12px;"
          >
            <legend>Resident workflow cards</legend>
            <p style="margin:0 0 10px; opacity:0.8;">
              Propose actions, approve them, then execute for this universe.
            </p>
            <div
              style="display:grid; gap:8px; grid-template-columns: repeat(2, minmax(180px, 1fr));"
            >
              <label>
                Resident
                <select
                  [value]="workflowResidentId()"
                  (change)="workflowResidentId.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                >
                  <option value="">Select resident</option>
                  @for (resident of llmResidents(); track resident.id) {
                    <option [value]="resident.id">{{ resident.name }} ({{ resident.id }})</option>
                  }
                </select>
              </label>
              <label>
                Credential ref
                <select
                  [value]="workflowCredentialRefId()"
                  (change)="workflowCredentialRefId.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                >
                  <option value="">Select credential</option>
                  @for (ref of llmCredentialRefs(); track ref.id) {
                    <option [value]="ref.id">
                      {{ ref.alias }} ({{ ref.provider }} | {{ ref.mode }})
                    </option>
                  }
                </select>
              </label>
              <label>
                Action
                <select
                  [value]="workflowActionType()"
                  (change)="workflowActionType.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                >
                  @for (action of llmActionTypes; track action) {
                    <option [value]="action">{{ action }}</option>
                  }
                </select>
              </label>
              <label>
                Model
                <input
                  type="text"
                  [value]="workflowModel()"
                  (input)="workflowModel.set($any($event.target).value)"
                  style="width:100%; padding:8px;"
                />
              </label>
              <label style="grid-column:1 / -1;">
                Prompt
                <textarea
                  [value]="workflowPrompt()"
                  (input)="workflowPrompt.set($any($event.target).value)"
                  style="width:100%; padding:8px; min-height:84px;"
                ></textarea>
              </label>
              <label style="grid-column:1 / -1;">
                Payload JSON (optional)
                <textarea
                  [value]="workflowPayloadJson()"
                  (input)="workflowPayloadJson.set($any($event.target).value)"
                  style="width:100%; padding:8px; min-height:72px;"
                ></textarea>
              </label>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button (click)="proposeActionCard()">Propose card</button>
              <button (click)="clearActionCards()">Clear cards</button>
            </div>
            <div style="display:grid; gap:8px; margin-top:12px; max-height:340px; overflow:auto;">
              @for (card of llmActionCards(); track card.id) {
                <article style="border:1px solid #ddd; border-radius:8px; padding:10px;">
                  <div
                    style="display:flex; justify-content:space-between; gap:8px; align-items:center;"
                  >
                    <strong>{{ card.actionType }}</strong>
                    <small>{{ card.status }}</small>
                  </div>
                  <div style="margin-top:4px; opacity:0.8;">
                    {{ card.residentId }} | {{ card.credentialRefId }} | {{ card.model }}
                  </div>
                  <pre style="margin:8px 0 0; white-space:pre-wrap;">{{ card.prompt }}</pre>
                  @if (card.responseText) {
                    <pre style="margin:8px 0 0; white-space:pre-wrap; color:#0b4f2f;">{{
                      card.responseText
                    }}</pre>
                  }
                  @if (card.errorMessage) {
                    <div style="margin-top:8px; color:#b00020;">{{ card.errorMessage }}</div>
                  }
                  <div style="display:flex; gap:8px; margin-top:10px;">
                    <button (click)="approveActionCard(card.id)">Approve</button>
                    <button (click)="denyActionCard(card.id)">Deny</button>
                    <button (click)="executeActionCard(card.id)">Execute</button>
                  </div>
                </article>
              } @empty {
                <p style="margin:0; opacity:0.8;">No cards yet.</p>
              }
            </div>
          </fieldset>
        </section>
      }

      @if (confirmLinkChange()) {
        <app-confirm-dialog
          [message]="'universe.changeLinkConfirm' | translate"
          [confirmLabel]="'universe.updateLink' | translate"
          [cancelLabel]="'dialogs.cancel' | translate"
          (confirmed)="changeLink()"
          (canceled)="confirmLinkChange.set(false)"
        />
      }
    </section>
  `,
})
export class MultiUserSettingsComponent {
  @Input() mode: 'collab' | 'llm' = 'collab';

  private readonly auth = inject(AuthService);
  private readonly draft = inject(SettingsDraftService);
  private readonly translate = inject(TranslateService);
  private readonly llmAdmin = inject(LlmResidentAdminService);
  private readonly llmActionLogStore = inject(LlmActionLogService);
  private readonly llmActionCardsStore = inject(LlmActionCardService);
  private readonly llmCredentialRefsStore = inject(LlmCredentialRefService);
  readonly prefs = signal<UserPreferences>(this.draft.preferences());
  readonly confirmLinkChange = signal(false);
  readonly guestPassword = signal('');
  readonly observerPassword = signal('');
  readonly llmError = signal<string | null>(null);
  readonly llmNotice = signal<string | null>(null);
  readonly llmResidents = signal<LlmResident[]>([]);
  readonly llmPolicy = signal<LlmPolicy>({ ...DEFAULT_LLM_POLICY });
  readonly llmLease = signal<LlmPencilLease | null>(null);
  readonly llmActionLog = signal<LlmActionEnvelope[]>([]);
  readonly llmActionCards = signal<LlmActionCard[]>([]);
  readonly llmCredentialRefs = signal<
    Awaited<ReturnType<LlmCredentialRefService['listForCurrentUser']>>
  >([]);
  readonly llmProviders: LlmProvider[] = ['openai', 'anthropic', 'ollama', 'custom'];
  readonly llmActionTypes: LlmAllowedActionType[] = [
    'chat.post',
    'comment.create',
    'instance.create',
    'instance.write',
    'dialog.move',
    'dialog.resize',
  ];
  readonly leaseTtlSeconds = signal(300);
  readonly residentEditId = signal<string | null>(null);
  readonly residentId = signal('');
  readonly residentName = signal('');
  readonly residentProvider = signal<LlmProvider>('openai');
  readonly residentModel = signal('gpt-4.1-mini');
  readonly residentRole = signal<LlmResidentRole>('observer');
  readonly residentActive = signal(true);
  readonly residentPermissions = signal<LlmResidentPermissions>({
    canWrite: false,
    canMoveDialogs: false,
    canCreateInstances: false,
    canComment: true,
  });
  readonly workflowResidentId = signal('');
  readonly workflowCredentialRefId = signal('');
  readonly workflowActionType = signal<LlmAllowedActionType>('chat.post');
  readonly workflowModel = signal('gpt-4.1-mini');
  readonly workflowPrompt = signal('');
  readonly workflowPayloadJson = signal('');

  columns: TableColumn<InviteeRecord>[] = [
    { header: 'users.username', cell: (row) => row.username },
    { header: 'users.role', cell: () => 'invitee' },
  ];

  readonly editingId = signal<string | null>(null);
  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.prefs.set(this.draft.preferences());
    });
    void this.refreshLlmState();
  }

  invitees() {
    const ownerId = this.auth.session().universeOwnerId ?? this.auth.actualUser()?.id ?? '';
    return ownerId ? this.auth.getInviteesForOwner(ownerId) : [];
  }

  canManageInvites() {
    return this.auth.canInvite({ universeOwnerId: this.auth.session().universeOwnerId ?? null });
  }

  universeLink() {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin;
    return `${base}/${this.prefs().universeId}/`;
  }

  onMultiUserToggle(event: Event) {
    const multiUserEnabled = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), multiUserEnabled });
  }

  onGuestToggle(event: Event) {
    const allowUniverseGuests = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseGuests });
  }

  onObserverToggle(event: Event) {
    const allowUniverseObservers = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseObservers });
  }

  onChatToggle(event: Event) {
    const allowUniverseChat = (event.target as HTMLInputElement).checked;
    this.draft.updatePreferences({ ...this.prefs(), allowUniverseChat });
  }

  openLinkConfirm() {
    this.confirmLinkChange.set(true);
  }

  changeLink() {
    const ownerId = this.auth.session().universeOwnerId ?? this.auth.actualUser()?.id;
    if (!ownerId) return;
    if (!this.canManageInvites()) return;
    const nextId = Math.random().toString(36).slice(2, 10);
    this.auth.setUniverseId(ownerId, nextId);
    this.draft.updatePreferences({ ...this.prefs(), universeId: nextId });
    this.confirmLinkChange.set(false);
  }

  async applyGuestPassword() {
    const raw = this.guestPassword().trim();
    const hashed = raw ? await this.auth.hashPassword(raw) : '';
    this.draft.updatePreferences({ ...this.prefs(), universeGuestPassword: hashed });
    this.guestPassword.set('');
  }

  async applyObserverPassword() {
    const raw = this.observerPassword().trim();
    const hashed = raw ? await this.auth.hashPassword(raw) : '';
    this.draft.updatePreferences({ ...this.prefs(), universeObserverPassword: hashed });
    this.observerPassword.set('');
  }

  formTitle() {
    return this.editingId()
      ? this.translate.instant('universe.editInviteeTitle')
      : this.translate.instant('universe.createInviteeTitle');
  }

  saveLabel() {
    return this.editingId()
      ? this.translate.instant('universe.saveInvitee')
      : this.translate.instant('universe.createInvitee');
  }

  startEdit(user: InviteeRecord) {
    this.editingId.set(user.id);
    this.username.set(user.username);
    this.password.set('');
    this.error.set(null);
  }

  reset() {
    this.editingId.set(null);
    this.username.set('');
    this.password.set('');
    this.error.set(null);
  }

  async save() {
    this.error.set(null);
    const ownerId = this.auth.session().universeOwnerId ?? this.auth.actualUser()?.id;
    if (!ownerId) return;
    if (!this.canManageInvites()) return;
    const payload = {
      username: this.username(),
      password: this.password(),
    };

    const result = this.editingId()
      ? await this.auth.updateInvitee(ownerId, this.editingId()!, payload)
      : await this.auth.createInvitee(ownerId, payload.username, payload.password);

    if (!result.ok) {
      this.error.set(this.translate.instant(result.message ?? 'users.error.generic'));
      return;
    }
    this.reset();
  }

  remove(user: InviteeRecord) {
    const ownerId = this.auth.session().universeOwnerId ?? this.auth.actualUser()?.id;
    if (!ownerId) return;
    if (!this.canManageInvites()) return;
    this.auth.deleteInvitee(ownerId, user.id);
  }

  setPolicyEnabled(event: Event) {
    this.llmPolicy.update((current) => ({
      ...current,
      enabled: (event.target as HTMLInputElement).checked,
    }));
  }

  setPolicyRequireConfirmation(event: Event) {
    this.llmPolicy.update((current) => ({
      ...current,
      requireActionConfirmation: (event.target as HTMLInputElement).checked,
    }));
  }

  setPolicyDestructive(event: Event) {
    this.llmPolicy.update((current) => ({
      ...current,
      allowDestructiveActions: (event.target as HTMLInputElement).checked,
    }));
  }

  setPolicyActionsPerMinute(event: Event) {
    const value = this.parsePositiveInt((event.target as HTMLInputElement).value, 20);
    this.llmPolicy.update((current) => ({ ...current, maxActionsPerMinute: value }));
  }

  setPolicyTokensPerMinute(event: Event) {
    const value = this.parsePositiveInt((event.target as HTMLInputElement).value, 12000);
    this.llmPolicy.update((current) => ({ ...current, maxTokensPerMinute: value }));
  }

  setResidentPermission(key: keyof LlmResidentPermissions, next: boolean) {
    this.residentPermissions.update((current) => ({ ...current, [key]: next }));
  }

  async saveLlmPolicy() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const result = await this.llmAdmin.setPolicy(context, this.llmPolicy());
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to save policy.');
      return;
    }
    this.llmNotice.set('LLM policy saved.');
    await this.refreshLlmState();
  }

  async saveResident() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;

    const id = this.residentId().trim();
    const name = this.residentName().trim();
    const model = this.residentModel().trim();
    if (!id || !name || !model) {
      this.llmError.set('Resident ID, name, and model are required.');
      return;
    }

    const result = await this.llmAdmin.upsertResident(context, {
      id,
      name,
      provider: this.residentProvider(),
      model,
      role: this.residentRole(),
      active: this.residentActive(),
      permissions: this.residentPermissions(),
    });
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to save resident.');
      return;
    }

    this.llmNotice.set('Resident saved.');
    this.resetResidentEditor();
    await this.refreshLlmState();
  }

  editResident(resident: LlmResident) {
    this.residentEditId.set(resident.id);
    this.residentId.set(resident.id);
    this.residentName.set(resident.name);
    this.residentProvider.set(resident.provider);
    this.residentModel.set(resident.model);
    this.residentRole.set(resident.role);
    this.residentActive.set(resident.active);
    this.residentPermissions.set({ ...resident.permissions });
  }

  resetResidentEditor() {
    this.residentEditId.set(null);
    this.residentId.set('');
    this.residentName.set('');
    this.residentProvider.set('openai');
    this.residentModel.set('gpt-4.1-mini');
    this.residentRole.set('observer');
    this.residentActive.set(true);
    this.residentPermissions.set({
      canWrite: false,
      canMoveDialogs: false,
      canCreateInstances: false,
      canComment: true,
    });
  }

  async removeResident(residentId: string) {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;

    const result = await this.llmAdmin.removeResident(context, residentId);
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to remove resident.');
      return;
    }
    this.llmNotice.set('Resident removed.');
    await this.refreshLlmState();
  }

  async grantResidentLease(residentId: string, residentName: string) {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const result = await this.llmAdmin.grantLease(
      context,
      residentId,
      residentName,
      this.leaseTtlSeconds() * 1000,
    );
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to grant lease.');
      return;
    }
    this.llmNotice.set('Lease granted.');
    await this.refreshLlmState();
  }

  async revokeResidentLease() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    await this.llmAdmin.revokeLease(context);
    this.llmNotice.set('Lease revoked.');
    await this.refreshLlmState();
  }

  async clearActionLog() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    await this.llmActionLogStore.clear(context);
    this.llmNotice.set('Action log cleared.');
    await this.refreshLlmState();
  }

  async proposeActionCard() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const residentId = this.workflowResidentId().trim();
    const credentialRefId = this.workflowCredentialRefId().trim();
    const model = this.workflowModel().trim();
    const prompt = this.workflowPrompt().trim();
    if (!residentId || !credentialRefId || !model || !prompt) {
      this.llmError.set('Resident, credential, model, and prompt are required.');
      return;
    }
    const payload = this.parsePayloadJson();
    if (payload === null) return;
    const result = await this.llmActionCardsStore.propose(context, {
      residentId,
      credentialRefId,
      actionType: this.workflowActionType(),
      model,
      prompt,
      payload,
    });
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to propose action card.');
      return;
    }
    this.workflowPrompt.set('');
    this.workflowPayloadJson.set('');
    this.llmNotice.set('Action card proposed.');
    await this.refreshLlmState();
  }

  async approveActionCard(cardId: string) {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const result = await this.llmActionCardsStore.approve(context, cardId);
    if (!result.ok) {
      this.llmError.set('Failed to approve action card.');
      return;
    }
    this.llmNotice.set('Action card approved.');
    await this.refreshLlmState();
  }

  async denyActionCard(cardId: string) {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const result = await this.llmActionCardsStore.deny(context, cardId);
    if (!result.ok) {
      this.llmError.set('Failed to deny action card.');
      return;
    }
    this.llmNotice.set('Action card denied.');
    await this.refreshLlmState();
  }

  async executeActionCard(cardId: string) {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    const result = await this.llmActionCardsStore.execute(context, cardId);
    if (!result.ok) {
      this.llmError.set(result.message ?? 'Failed to execute action card.');
      await this.refreshLlmState();
      return;
    }
    this.llmNotice.set('Action card executed.');
    await this.refreshLlmState();
  }

  async clearActionCards() {
    this.llmError.set(null);
    this.llmNotice.set(null);
    const context = this.getLlmContext();
    if (!context) return;
    await this.llmActionCardsStore.clear(context);
    this.llmNotice.set('Action cards cleared.');
    await this.refreshLlmState();
  }

  async refreshLlmState() {
    const context = this.getLlmContext();
    if (!context) return;
    const [state, log, cards, refs] = await Promise.all([
      this.llmAdmin.loadState(context),
      this.llmActionLogStore.list(context),
      this.llmActionCardsStore.list(context),
      this.llmCredentialRefsStore.listForCurrentUser(),
    ]);
    this.llmResidents.set(state.residents);
    this.llmPolicy.set(state.policy);
    this.llmLease.set(state.lease);
    this.llmActionLog.set(log);
    this.llmActionCards.set(cards);
    this.llmCredentialRefs.set(refs);
  }

  formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  formatPayload(entry: LlmActionEnvelope): string {
    try {
      return JSON.stringify(entry.payload, null, 2);
    } catch {
      return '{}';
    }
  }

  parsePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private parsePayloadJson(): Record<string, unknown> | undefined | null {
    const raw = this.workflowPayloadJson().trim();
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.llmError.set('Payload JSON must be an object.');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      this.llmError.set('Payload JSON is invalid.');
      return null;
    }
  }

  private getLlmContext(): LlmContext | null {
    const universeOwnerId = this.auth.session().universeOwnerId ?? this.auth.actualUser()?.id;
    const universeId = this.prefs().universeId?.trim();
    if (!universeOwnerId || !universeId) {
      this.llmError.set('Missing universe context.');
      return null;
    }
    return { universeOwnerId, universeId };
  }

  showCollaborationSection() {
    return this.mode !== 'llm';
  }

  showLlmSection() {
    return this.mode !== 'collab';
  }
}
