import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusFetcher } from '../src/fetcher.js';

const CONFIG = {
  postnord: { apiKey: 'test-key' },
  dhl: { apiKey: 'test-key' },
};

describe('StatusFetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new StatusFetcher(CONFIG);
    vi.resetAllMocks();
  });

  it('returns postnord status from API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        TrackingInformationResponse: {
          shipmentTrackingNumber: ['SE123456789SE'],
          Shipment: [{
            Item: [{ event: [{ eventDescription: ['Sorteras på terminal'] }] }]
          }]
        }
      }),
    });

    const result = await fetcher.fetchStatus('postnord', 'SE123456789SE');
    expect(result.status).toBe('in_transit');
    expect(result.statusText).toBeTruthy();
  });

  it('returns link fallback on CORS/fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetcher.fetchStatus('dhl', '1234567890');
    expect(result.status).toBe('unknown');
    expect(result.trackingUrl).toContain('1234567890');
  });

  it('returns dhl status from API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shipments: [{
          status: 'transit',
          events: [{ description: 'Shipment in transit' }],
          estimatedTimeOfDelivery: null,
        }],
      }),
    });

    const result = await fetcher.fetchStatus('dhl', '1234567890');
    expect(result.status).toBe('in_transit');
    expect(result.statusText).toBe('Shipment in transit');
  });

  it('returns link fallback for carriers without API', async () => {
    global.fetch = vi.fn();
    const result = await fetcher.fetchStatus('bring', '12345678901234567');
    expect(result.status).toBe('unknown');
    expect(result.trackingUrl).toContain('12345678901234567');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
