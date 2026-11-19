// Santypes Main Application Bootstrap
// 100% Framework-Free Pure TypeScript

import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/600.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/noto-sans-kannada/400.css';
import '@fontsource/noto-sans-kannada/500.css';
import '@fontsource/noto-sans-kannada/600.css';
import '@fontsource/noto-sans-kannada/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';

import { renderTypingTest } from './views/typing-test-view.ts';
import { renderCurriculum } from './views/curriculum-view.ts';
import { renderAnalytics } from './views/analytics-view.ts';
import { toggleSound, isSoundEnabled, playTactileClick } from './utils/sound.ts';
import { initTactileSystem } from './utils/tactile.ts';
import { ProfileModal } from './components/profile-modal.ts';
import { SettingsModal } from './components/settings-modal.ts';
import { FeedbackModal } from './components/feedback-modal.ts';
import { PrivacyModal } from './components/privacy-modal.ts';
import { FaqModal } from './components/faq-modal.ts';
import { TermsModal } from './components/terms-modal.ts';
import { mountConsentBannerIfNeeded, removeConsentBanner } from './components/consent-banner.ts';
import { initPrivacyAndConsent, eraseAllLocalUserData } from './utils/privacy.ts';
import { getAccountState } from './stubs/account-stub.ts';
import { getLevelProgress } from './core/gamification.ts';
import { applySettingsToDOM, getSettings, ThemeMode, updateSetting } from './stubs/settings-stub.ts';
import { finiteNumber, isSafeRecordKey } from './utils/html.ts';

export function updateHeaderProfilePill(): void {
  const levelEl = document.getElementById('header-profile-level');
  const xpFillEl = document.getElementById('header-profile-xp-fill');
  const streakEl = document.getElementById('header-profile-streak');

  const state = getAccountState();
  const levelInfo = getLevelProgress(state.xp);
  const safeStreak = finiteNumber(state.streak.current, 0, 0);

  if (levelEl) levelEl.textContent = `Lv. ${finiteNumber(levelInfo.level, 1, 1)}`;
  if (xpFillEl) xpFillEl.style.width = `${finiteNumber(levelInfo.progressPercent, 0, 0, 100)}%`;
  if (streakEl) {
    streakEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:3px;color:#f59e0b;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>${safeStreak}d</span></span>`;
  }
}

function bootstrapApp(): void {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) {
    console.error('Critical: #app-root container not found in DOM');
    return;
  }

  // 1. Initialize Privacy & Opt-In Analytics Consent before rendering interactive views
  initPrivacyAndConsent();
  mountConsentBannerIfNeeded();

  // 2. Apply User Preferences & Accessibility to DOM
  applySettingsToDOM(getSettings());

  // 3. Initialize Universal Tactile Button Response System
  initTactileSystem();

  // 4. Initialize Header Profile & XP Pill
  updateHeaderProfilePill();
  window.addEventListener('santypes:account-updated', updateHeaderProfilePill);

  const profilePillBtn = document.getElementById('btn-profile-pill');
  if (profilePillBtn) {
    profilePillBtn.addEventListener('click', () => {
      new ProfileModal().show();
    });
  }

  // 5. Initialize Settings, Accessibility, Feedback & Privacy Modals
  const settingsToggleBtn = document.getElementById('btn-settings-toggle');
  if (settingsToggleBtn) {
    settingsToggleBtn.addEventListener('click', () => {
      new SettingsModal().show();
    });
  }

  const feedbackToggleBtn = document.getElementById('btn-feedback-toggle');
  if (feedbackToggleBtn) {
    feedbackToggleBtn.addEventListener('click', () => {
      playTactileClick('button');
      new FeedbackModal().show();
    });
  }

  const openPrivacyModal = () => {
    playTactileClick('button');
    new PrivacyModal().show();
  };
  document.getElementById('btn-footer-faq')?.addEventListener('click', () => {
    playTactileClick('button');
    new FaqModal().show();
  });
  document.getElementById('btn-footer-terms')?.addEventListener('click', () => {
    playTactileClick('button');
    new TermsModal().show();
  });
  document.getElementById('btn-footer-privacy')?.addEventListener('click', openPrivacyModal);
  document.getElementById('btn-footer-cookies')?.addEventListener('click', openPrivacyModal);

  const root = appRoot;

  // 6. Tab Navigation & View Controller
  let currentViewCleanup: (() => void) | null = null;
  let currentTabName: string = 'test';

  function navigateToTab(tabName: string): void {
    // Clean up previous view listeners & engine timers
    if (typeof currentViewCleanup === 'function') {
      currentViewCleanup();
      currentViewCleanup = null;
    }

    currentTabName = tabName;

    // Update nav tab active highlights
    document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    if (tabName === 'test') {
      currentViewCleanup = renderTypingTest(root, navigateToTab);
    } else if (tabName === 'arcade') {
      root.innerHTML = `
        <div class="arcade-loading-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;gap:16px;">
          <div class="settings-spinner" style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.1);border-top-color:var(--accent-cyan,#06b6d4);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span style="font-size:13px;color:var(--text-secondary,#a1a1aa);letter-spacing:1px;text-transform:uppercase;font-family:var(--font-mono,monospace);">Initializing 3D Cyber Engine...</span>
        </div>
      `;
      void import('./views/arcade-view.ts').then(({ renderArcade }) => {
        if (currentTabName === 'arcade') {
          currentViewCleanup = renderArcade(root, navigateToTab);
        }
      });
    } else if (tabName === 'curriculum') {
      currentViewCleanup = renderCurriculum(root, navigateToTab);
    } else if (tabName === 'analytics') {
      currentViewCleanup = renderAnalytics(root, () => navigateToTab('test'));
    }
  }

  window.addEventListener('santypes:data-erased', () => {
    applySettingsToDOM(getSettings());
    updateHeaderProfilePill();
    removeConsentBanner();
    mountConsentBannerIfNeeded();
    navigateToTab(currentTabName);
  });

  // Initial View Mount
  navigateToTab('test');

  // Nav Tab Click Handlers
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabTarget = tab.dataset.tab;
      if (tab.classList.contains('disabled')) {
        showToast(
          `${tab.querySelector('span:not(.tab-icon):not(.coming-soon-pill)')?.textContent || 'Feature'} is queued for next milestone!`
        );
        return;
      }
      if (tabTarget) {
        navigateToTab(tabTarget);
      }
    });
  });

  // Brand click resets to Typing Test
  const brand = document.querySelector('.brand');
  if (brand) {
    brand.addEventListener('click', () => {
      navigateToTab('test');
    });
  }

  // 4. Setup Sound Toggle
  const soundToggleBtn = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const renderSoundIcon = (enabled: boolean) =>
    enabled
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';

  if (soundToggleBtn && soundIcon) {
    soundIcon.innerHTML = renderSoundIcon(isSoundEnabled());
    soundToggleBtn.addEventListener('click', () => {
      const enabled = toggleSound();
      soundIcon.innerHTML = renderSoundIcon(enabled);
      if (enabled) playTactileClick('button');
    });
  }

  // 5. Setup Theme Toggle (Pure Black vs Warm Serika)
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  if (themeToggleBtn) {
    const themeNames: Record<string, string> = {
      oled: 'Pure Black OLED',
      dark: 'Matte Black',
      serika: 'Warm Serika',
    };

    const savedTheme = getSettings().theme || 'oled';
    const initialThemeLabel = isSafeRecordKey(savedTheme) ? themeNames[savedTheme] : undefined;
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleBtn.title = `Theme: ${initialThemeLabel || 'Pure Black OLED'} (Click to switch)`;

    const validThemes: ThemeMode[] = ['oled', 'dark', 'serika'];
    themeToggleBtn.addEventListener('click', () => {
      const currentAttr = document.documentElement.getAttribute('data-theme');
      const currentIndex = validThemes.indexOf(currentAttr as ThemeMode);
      const nextTheme = validThemes[(currentIndex >= 0 ? currentIndex + 1 : 0) % validThemes.length];

      updateSetting('theme', nextTheme);
      const nextLabel = themeNames[nextTheme];
      themeToggleBtn.title = `Theme: ${nextLabel || 'Pure Black OLED'} (Click to switch)`;
    });
  }

  // Listen for settings changes anywhere (e.g. sound/theme updated in settings modal)
  window.addEventListener('santypes:settings-updated', ((e: CustomEvent) => {
    const s = e.detail;
    if (soundIcon && s && typeof s.soundEnabled === 'boolean') {
      soundIcon.innerHTML = renderSoundIcon(s.soundEnabled);
    }
    if (themeToggleBtn && s && s.theme) {
      const themeNames: Record<string, string> = {
        oled: 'Pure Black OLED',
        dark: 'Matte Black',
        serika: 'Warm Serika',
      };
      const updatedLabel = isSafeRecordKey(s.theme) ? themeNames[s.theme] : undefined;
      themeToggleBtn.title = `Theme: ${updatedLabel || 'Pure Black OLED'} (Click to switch)`;
    }
  }) as EventListener);
}

function showToast(msg: string): void {
  const existing = document.querySelector('.app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function renderFatalRecoveryUI(error: unknown): void {
  const host = document.getElementById('app-root') || document.body;
  if (!host) return;

  const message =
    error instanceof Error && error.message
      ? error.message.slice(0, 200)
      : 'An unexpected runtime error prevented Santypes from rendering.';

  host.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'app-fallback-card';
  card.setAttribute('role', 'alert');

  const code = document.createElement('div');
  code.className = 'app-fallback-code';
  code.textContent = 'Runtime Recovery Mode';

  const heading = document.createElement('h2');
  heading.textContent = 'Santypes encountered an unexpected error';

  const copy = document.createElement('p');
  copy.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'app-fallback-actions';

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'btn-primary';
  reloadBtn.textContent = 'Reload App';
  reloadBtn.addEventListener('click', () => window.location.reload());

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'btn-secondary';
  resetBtn.textContent = 'Reset Local Data & Reload';
  resetBtn.addEventListener('click', () => {
    eraseAllLocalUserData();
    window.location.reload();
  });

  actions.append(reloadBtn, resetBtn);
  card.append(code, heading, copy, actions);
  host.appendChild(card);
}

function safeStartApp(): void {
  const isRootRendered = () => {
    const root = document.getElementById('app-root');
    return Boolean(
      root?.querySelector(
        '.typing-container, .curriculum-container, .analytics-container, .app-fallback-card'
      )
    );
  };

  window.addEventListener('error', (event) => {
    if (!isRootRendered()) {
      renderFatalRecoveryUI(event.error || event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (!isRootRendered()) {
      renderFatalRecoveryUI(event.reason);
    }
  });

  try {
    bootstrapApp();
  } catch (err) {
    console.error('Santypes initialization failed:', err);
    renderFatalRecoveryUI(err);
  }
}

// Auto-run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeStartApp);
} else {
  safeStartApp();
}
