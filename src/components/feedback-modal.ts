// Santypes Feedback & Feature Request Modal
// Captures real launch feedback, 3D Games interest votes (consent-gated GA4 + localStorage), and shareable summaries

import { playTactileClick } from '../utils/sound.ts';
import { escapeHTML } from '../utils/html.ts';
import { trackAnalyticsEvent } from '../utils/privacy.ts';
import {
  captureActiveElement,
  focusInitialDialogControl,
  isTopmostModalBackdrop,
  restoreFocusSafe,
  trapTabWithinModal,
} from '../utils/dialog-host.ts';
import { syncConsentBannerVisibility } from './consent-banner.ts';

export type GamesInterestVote = 'yes' | 'later' | 'no';

export const WEB3FORMS_ACCESS_KEY = 'b76c4626-0a6d-4183-84df-c6a3e0566ea8';

export interface FeedbackEntry {
  rating: number;
  gamesVote: GamesInterestVote;
  topic: string;
  notes: string;
  submittedAt: string;
  contactEmail?: string;
  deliveredToEmail?: boolean;
}

const FEEDBACK_STORAGE_KEY = 'santypes_feedback_history_v1';

const RATING_LABELS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 · Needs Work' },
  { value: 2, label: '2 · Okay' },
  { value: 3, label: '3 · Good' },
  { value: 4, label: '4 · Great' },
  { value: 5, label: '5 · Love It' },
];

const GAMES_OPTIONS: Array<{ value: GamesInterestVote; label: string }> = [
  { value: 'yes', label: 'Yes, add 3D Games!' },
  { value: 'later', label: 'Maybe Later' },
  { value: 'no', label: 'Keep Pure Typing' },
];

const TOPICS = ['Typing Test', 'Curriculum', 'Analytics', 'UI / Themes', 'Bug Report'];

export async function sendFeedbackToEmail(
  entry: FeedbackEntry,
  accessKey: string = WEB3FORMS_ACCESS_KEY
): Promise<boolean> {
  if (!accessKey) return false;
  const voteText =
    GAMES_OPTIONS.find((opt) => opt.value === entry.gamesVote)?.label ?? entry.gamesVote;

  const payload: Record<string, string> = {
    access_key: accessKey,
    subject: `Santypes Feedback [${entry.rating}/5] - ${entry.topic}`,
    from_name: 'Santypes Feedback Widget',
    rating: `${entry.rating} / 5`,
    area: entry.topic,
    roadmap_vote: voteText,
    notes: entry.notes.trim() || '(No notes provided)',
    submitted_at: entry.submittedAt,
  };

  if (entry.contactEmail && entry.contactEmail.includes('@')) {
    payload['reply_to'] = entry.contactEmail.trim();
    payload['email'] = entry.contactEmail.trim();
  }

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json?.success);
  } catch {
    return false;
  }
}

export function buildFeedbackSummaryText(entry: FeedbackEntry): string {
  const voteText =
    GAMES_OPTIONS.find((opt) => opt.value === entry.gamesVote)?.label ?? entry.gamesVote;
  const lines = [
    'Santypes Feedback',
    `Rating: ${entry.rating}/5`,
    `Want 3D Typing Games?: ${voteText}`,
    `Area: ${entry.topic}`,
  ];
  if (entry.notes.trim()) {
    lines.push(`Notes: ${entry.notes.trim()}`);
  }
  lines.push(`Submitted: ${entry.submittedAt}`);
  return lines.join('\n');
}

export function getSavedFeedbackHistory(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFeedbackEntry(entry: FeedbackEntry): void {
  try {
    const existing = getSavedFeedbackHistory();
    const updated = [entry, ...existing].slice(0, 10);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export class FeedbackModal {
  private static activeInstance: FeedbackModal | null = null;
  private backdrop: HTMLElement | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private rating = 5;
  private gamesVote: GamesInterestVote = 'yes';
  private topic = 'Typing Test';
  private notes = '';
  private contactEmail = '';
  private isSubmitting = false;
  private submittedEntry: FeedbackEntry | null = null;
  private hasMounted = false;

  public show(): void {
    if (FeedbackModal.activeInstance && FeedbackModal.activeInstance !== this) {
      FeedbackModal.activeInstance.close();
    }
    this.close();
    FeedbackModal.activeInstance = this;
    this.previouslyFocused = captureActiveElement();

    const previous = getSavedFeedbackHistory()[0];
    if (previous) {
      this.rating = previous.rating;
      this.gamesVote = previous.gamesVote;
      this.topic = previous.topic;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'settings-modal-backdrop modal-backdrop visible feedback-modal-backdrop';
    this.backdrop = backdrop;

    this.render();
    document.body.appendChild(backdrop);
    syncConsentBannerVisibility();
    focusInitialDialogControl(backdrop);

    this.keydownListener = (e: KeyboardEvent) => {
      if (!this.backdrop || !isTopmostModalBackdrop(this.backdrop)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      trapTabWithinModal(e, this.backdrop);
    };
    window.addEventListener('keydown', this.keydownListener, true);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.close();
    });
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const submitBtn = this.backdrop?.querySelector<HTMLButtonElement>('#btn-submit-feedback');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    const entry: FeedbackEntry = {
      rating: this.rating,
      gamesVote: this.gamesVote,
      topic: this.topic,
      notes: this.notes.trim().slice(0, 500),
      contactEmail: this.contactEmail.trim().slice(0, 120),
      submittedAt: new Date().toISOString(),
    };

    const delivered = await sendFeedbackToEmail(entry);
    entry.deliveredToEmail = delivered;

    saveFeedbackEntry(entry);

    // Emit ONLY non-PII enums/booleans and ONLY when user opted in to analytics
    trackAnalyticsEvent('user_feedback', {
      rating: entry.rating,
      games_vote: entry.gamesVote,
      topic: entry.topic,
      has_notes: entry.notes.length > 0,
      has_email: Boolean(entry.contactEmail),
    });
    trackAnalyticsEvent('games_interest_vote', {
      vote: entry.gamesVote,
    });

    this.isSubmitting = false;
    this.submittedEntry = entry;
    this.render();
  }

  private render(): void {
    if (!this.backdrop) return;

    const animClass = this.hasMounted ? 'no-reanimate' : '';
    this.hasMounted = true;
    const priorCount = getSavedFeedbackHistory().length;

    if (this.submittedEntry) {
      const voteLabel =
        GAMES_OPTIONS.find((o) => o.value === this.submittedEntry?.gamesVote)?.label ??
        this.submittedEntry.gamesVote;

      this.backdrop.innerHTML = `
        <div class="settings-card-modal feedback-card-modal ${animClass}" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
          <div class="modal-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="settings-header-icon" style="color:var(--accent-cyan);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div>
                <h2 class="modal-title" id="feedback-modal-title" style="margin:0;font-size:18px;">Thank You for Your Feedback</h2>
                <span style="font-size:11px;color:var(--text-muted);">Recorded to help shape the next Santypes release</span>
              </div>
            </div>
            <button class="modal-close-btn" id="btn-close-feedback" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="settings-scroll-body feedback-body">
            <div class="feedback-confirm-card">
              <div class="feedback-confirm-row">
                <span>Status</span>
                <strong style="color:${this.submittedEntry.deliveredToEmail ? 'var(--accent-green, #10b981)' : 'var(--accent-cyan, #06b6d4)'};">
                  ${this.submittedEntry.deliveredToEmail ? '✓ Sent to Developer Inbox' : '✓ Saved Locally'}
                </strong>
              </div>
              <div class="feedback-confirm-row"><span>Rating</span><strong>${escapeHTML(this.submittedEntry.rating)} / 5</strong></div>
              <div class="feedback-confirm-row"><span>3D Typing Games Vote</span><strong>${escapeHTML(voteLabel)}</strong></div>
              <div class="feedback-confirm-row"><span>Focus Area</span><strong>${escapeHTML(this.submittedEntry.topic)}</strong></div>
              ${
                this.submittedEntry.contactEmail
                  ? `<div class="feedback-confirm-row"><span>Reply-To</span><strong>${escapeHTML(this.submittedEntry.contactEmail)}</strong></div>`
                  : ''
              }
              ${
                this.submittedEntry.notes
                  ? `<div class="feedback-confirm-notes">"${escapeHTML(this.submittedEntry.notes)}"</div>`
                  : ''
              }
            </div>
            <p class="feedback-helper-note">
              ${
                this.submittedEntry.deliveredToEmail
                  ? 'Your feedback was emailed directly to the developer. Thank you!'
                  : 'Saved locally in your browser. (Offline or mail relay unavailable; you can use Copy Summary below).'
              }
            </p>
          </div>

          <div class="settings-modal-footer feedback-footer-actions">
            <button type="button" class="btn-secondary" id="btn-feedback-again">Send Another</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <button type="button" class="btn-secondary" id="btn-copy-feedback">Copy Summary</button>
              <button type="button" class="btn-primary" id="btn-done-feedback">Done</button>
            </div>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#btn-close-feedback')?.addEventListener('click', () => {
        playTactileClick('button');
        this.close();
      });
      this.backdrop.querySelector('#btn-done-feedback')?.addEventListener('click', () => {
        playTactileClick('button');
        this.close();
      });
      this.backdrop.querySelector('#btn-feedback-again')?.addEventListener('click', () => {
        playTactileClick('button');
        this.submittedEntry = null;
        this.notes = '';
        this.render();
      });
      const copyBtn = this.backdrop.querySelector<HTMLButtonElement>('#btn-copy-feedback');
      copyBtn?.addEventListener('click', async () => {
        playTactileClick('button');
        if (!this.submittedEntry) return;
        const summary = buildFeedbackSummaryText(this.submittedEntry);
        try {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            throw new Error('Clipboard API unavailable');
          }
          await navigator.clipboard.writeText(summary);
          copyBtn.textContent = 'Copied Summary!';
          setTimeout(() => {
            if (copyBtn.isConnected) copyBtn.textContent = 'Copy Summary';
          }, 1800);
        } catch {
          copyBtn.textContent = 'Copy Unavailable';
          setTimeout(() => {
            if (copyBtn.isConnected) copyBtn.textContent = 'Copy Summary';
          }, 1800);
        }
      });
      return;
    }

    this.backdrop.innerHTML = `
      <div class="settings-card-modal feedback-card-modal ${animClass}" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="settings-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div>
              <h2 class="modal-title" id="feedback-modal-title" style="margin:0;font-size:18px;">Share Feedback</h2>
              <span style="font-size:11px;color:var(--text-muted);">Directly delivered to developer · Helps prioritize improvements</span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-feedback" title="Close (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="settings-scroll-body feedback-body">
          <div class="settings-group">
            <span class="settings-group-title">1. Overall Experience</span>
            <div class="feedback-pill-row">
              ${RATING_LABELS.map(
                (r) => `
                <button type="button" class="option-pill-btn feedback-rate-btn ${this.rating === r.value ? 'active' : ''}" data-rating="${r.value}">
                  ${r.label}
                </button>`
              ).join('')}
            </div>
          </div>

          <div class="settings-group feedback-games-box">
            <span class="settings-group-title">2. Future Roadmap Vote</span>
            <div class="feedback-poll-question">Would you play 3D Typing Games (combat, racing, extraction) if we add an Arcade mode?</div>
            <div class="feedback-pill-row">
              ${GAMES_OPTIONS.map(
                (opt) => `
                <button type="button" class="option-pill-btn feedback-vote-btn ${this.gamesVote === opt.value ? 'active' : ''}" data-vote="${opt.value}">
                  ${opt.label}
                </button>`
              ).join('')}
            </div>
          </div>

          <div class="settings-group">
            <span class="settings-group-title">3. Topic & Notes (Optional)</span>
            <div class="feedback-pill-row">
              ${TOPICS.map(
                (t) => `
                <button type="button" class="option-pill-btn feedback-topic-btn ${this.topic === t ? 'active' : ''}" data-topic="${t}">
                  ${t}
                </button>`
              ).join('')}
            </div>
            <textarea
              id="feedback-notes-input"
              class="feedback-textarea"
              maxlength="500"
              rows="3"
              placeholder="What felt great, what bugged you, or what should we build next?"
            >${escapeHTML(this.notes)}</textarea>
            <input
              type="email"
              id="feedback-email-input"
              class="feedback-textarea"
              style="margin-top: 8px; resize: none; min-height: unset; height: 38px;"
              maxlength="120"
              placeholder="Your email (optional - if you would like a reply)"
              value="${escapeHTML(this.contactEmail)}"
            />
          </div>
        </div>

        <div class="settings-modal-footer">
          <span style="font-size:12px;color:var(--text-muted);">
            Sent directly to developer${priorCount > 0 ? ` · Logged: ${priorCount}` : ''}
          </span>
          <div style="display:flex;gap:10px;">
            <button type="button" class="btn-secondary" id="btn-cancel-feedback">Cancel</button>
            <button type="button" class="btn-primary" id="btn-submit-feedback">Submit Feedback</button>
          </div>
        </div>
      </div>
    `;

    this.backdrop.querySelector('#btn-close-feedback')?.addEventListener('click', () => {
      playTactileClick('button');
      this.close();
    });
    this.backdrop.querySelector('#btn-cancel-feedback')?.addEventListener('click', () => {
      playTactileClick('button');
      this.close();
    });

    const rateBtns = this.backdrop.querySelectorAll<HTMLButtonElement>('.feedback-rate-btn');
    rateBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        playTactileClick('button');
        this.rating = Number(btn.dataset.rating || 5);
        rateBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    const voteBtns = this.backdrop.querySelectorAll<HTMLButtonElement>('.feedback-vote-btn');
    voteBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        playTactileClick('button');
        this.gamesVote = (btn.dataset.vote as GamesInterestVote) || 'yes';
        voteBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    const topicBtns = this.backdrop.querySelectorAll<HTMLButtonElement>('.feedback-topic-btn');
    topicBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        playTactileClick('button');
        this.topic = btn.dataset.topic || 'Typing Test';
        topicBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    const notesEl = this.backdrop.querySelector<HTMLTextAreaElement>('#feedback-notes-input');
    notesEl?.addEventListener('input', () => {
      this.notes = notesEl.value;
    });
    notesEl?.addEventListener('keydown', (e) => {
      // Allow free typing including Space/Tab/Enter inside feedback notes
      if (e.key !== 'Escape') e.stopPropagation();
    });

    const emailEl = this.backdrop.querySelector<HTMLInputElement>('#feedback-email-input');
    emailEl?.addEventListener('input', () => {
      this.contactEmail = emailEl.value;
    });
    emailEl?.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') e.stopPropagation();
    });

    this.backdrop.querySelector('#btn-submit-feedback')?.addEventListener('click', () => {
      playTactileClick('button');
      void this.submit();
    });
  }

  public close(): void {
    if (FeedbackModal.activeInstance === this) {
      FeedbackModal.activeInstance = null;
    }
    const prevFocus = this.previouslyFocused;
    this.previouslyFocused = null;
    this.hasMounted = false;
    this.isSubmitting = false;
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }
    syncConsentBannerVisibility();
    restoreFocusSafe(prevFocus);
  }
}
