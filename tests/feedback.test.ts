import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildFeedbackSummaryText,
  getSavedFeedbackHistory,
  saveFeedbackEntry,
  sendFeedbackToEmail,
  WEB3FORMS_ACCESS_KEY,
  FeedbackEntry,
} from '../src/components/feedback-modal';

const memStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => memStorage.get(k) ?? null,
    setItem: (k: string, v: string) => memStorage.set(k, v),
    removeItem: (k: string) => memStorage.delete(k),
    clear: () => memStorage.clear(),
  },
  configurable: true,
});

describe('Feedback Modal Helpers', () => {
  beforeEach(() => {
    memStorage.clear();
    vi.restoreAllMocks();
  });

  it('formats feedback summary cleanly with and without notes', () => {
    const entry: FeedbackEntry = {
      rating: 5,
      gamesVote: 'yes',
      topic: 'Typing Test',
      notes: 'Super smooth typing feel!',
      submittedAt: '2026-11-10T10:00:00.000Z',
    };

    const summary = buildFeedbackSummaryText(entry);
    expect(summary).toContain('Rating: 5/5');
    expect(summary).toContain('Want 3D Typing Games?: Yes, add 3D Games!');
    expect(summary).toContain('Area: Typing Test');
    expect(summary).toContain('Notes: Super smooth typing feel!');

    const minimal = buildFeedbackSummaryText({ ...entry, notes: '   ', gamesVote: 'no' });
    expect(minimal).toContain('Want 3D Typing Games?: Keep Pure Typing');
    expect(minimal).not.toContain('Notes:');
  });

  it('persists latest feedback entries capped to 10 records', () => {
    for (let i = 0; i < 12; i++) {
      saveFeedbackEntry({
        rating: 4,
        gamesVote: 'later',
        topic: 'Analytics',
        notes: `entry-${i}`,
        submittedAt: `2026-11-10T10:00:0${i % 10}.000Z`,
      });
    }

    const history = getSavedFeedbackHistory();
    expect(history).toHaveLength(10);
    expect(history[0].notes).toBe('entry-11');
  });

  it('keeps local feedback records free of contact emails or mailto links', () => {
    const summary = buildFeedbackSummaryText({
      rating: 5,
      gamesVote: 'yes',
      topic: 'Typing Test',
      notes: 'Clean and private',
      submittedAt: '2026-11-10T10:00:00.000Z',
    });

    expect(summary).not.toMatch(/mailto:|@/i);
  });

  it('posts feedback payload correctly to Web3Forms API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Form submitted successfully' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const entry: FeedbackEntry = {
      rating: 5,
      gamesVote: 'yes',
      topic: 'Typing Test',
      notes: 'Loving the typing engine!',
      contactEmail: 'tester@example.com',
      submittedAt: '2026-11-10T10:00:00.000Z',
    };

    const ok = await sendFeedbackToEmail(entry, WEB3FORMS_ACCESS_KEY);
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.web3forms.com/submit');
    expect(options.method).toBe('POST');

    const parsed = JSON.parse(options.body);
    expect(parsed.access_key).toBe(WEB3FORMS_ACCESS_KEY);
    expect(parsed.rating).toBe('5 / 5');
    expect(parsed.reply_to).toBe('tester@example.com');
  });

  it('handles Web3Forms failure gracefully without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    const entry: FeedbackEntry = {
      rating: 4,
      gamesVote: 'no',
      topic: 'Bug Report',
      notes: 'Failed network test',
      submittedAt: '2026-11-10T10:00:00.000Z',
    };

    const ok = await sendFeedbackToEmail(entry, WEB3FORMS_ACCESS_KEY);
    expect(ok).toBe(false);
  });
});
