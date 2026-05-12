import { describe, it, expect } from 'vitest';
import { TrackingDetector } from '../src/detector.js';

const detector = new TrackingDetector();

describe('TrackingDetector', () => {
  it('detects PostNord SE-format', () => {
    const results = detector.detect('Din försändelse SE123456789SE är på väg');
    expect(results).toContainEqual({ trackingNumber: 'SE123456789SE', carrier: 'postnord' });
  });

  it('detects UPS 1Z format', () => {
    const results = detector.detect('Your UPS tracking number is 1ZA1B2C3D4E5F6G78H');
    expect(results).toContainEqual({ trackingNumber: '1ZA1B2C3D4E5F6G78H', carrier: 'ups' });
  });

  it('detects Airmee AIR- format', () => {
    const results = detector.detect('Spåra ditt paket: AIR-ABC12345');
    expect(results).toContainEqual({ trackingNumber: 'AIR-ABC12345', carrier: 'airmee' });
  });

  it('detects DHL 10-digit number', () => {
    const results = detector.detect('DHL tracking: 1234567890');
    expect(results).toContainEqual({ trackingNumber: '1234567890', carrier: 'dhl' });
  });

  it('detects FedEx 12-digit number', () => {
    const results = detector.detect('FedEx tracking number 123456789012');
    expect(results).toContainEqual({ trackingNumber: '123456789012', carrier: 'fedex' });
  });

  it('returns empty array for text with no tracking numbers', () => {
    const results = detector.detect('Tack för din beställning! Vi återkommer med mer info.');
    expect(results).toHaveLength(0);
  });

  it('detects PostNord lowercase format', () => {
    const results = detector.detect('Din försändelse se123456789se är på väg');
    expect(results).toContainEqual({ trackingNumber: 'se123456789se', carrier: 'postnord' });
  });

  it('deduplicates identical tracking numbers', () => {
    const results = detector.detect('SE123456789SE SE123456789SE');
    const found = results.filter(r => r.trackingNumber === 'SE123456789SE');
    expect(found).toHaveLength(1);
  });
});
