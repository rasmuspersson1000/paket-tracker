import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailScanner } from '../src/scanner.js';

describe('EmailScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = new EmailScanner();
    vi.resetAllMocks();
  });

  it('returns emails from Gmail API response', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg1' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          payload: {
            headers: [{ name: 'Subject', value: 'Din order SE123456789SE' }],
            body: { data: btoa('Ditt paket SE123456789SE är på väg') },
          },
        }),
      });

    const emails = await scanner.scanGmail('test-access-token');
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Din order SE123456789SE');
    expect(emails[0].source).toBe('gmail');
  });

  it('returns empty array when Gmail API returns no messages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [] }),
    });

    const emails = await scanner.scanGmail('test-token');
    expect(emails).toHaveLength(0);
  });

  it('returns emails from Graph API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [{
          subject: 'FedEx tracking 123456789012',
          body: { content: 'Your package 123456789012 is on its way' },
        }],
      }),
    });

    const emails = await scanner.scanOutlook('test-access-token');
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('FedEx tracking 123456789012');
    expect(emails[0].source).toBe('outlook');
  });
});
