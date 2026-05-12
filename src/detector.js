// Patterns ordered from most-specific to least-specific to avoid cross-matching.
const CARRIERS = [
  { carrier: 'postnord', pattern: /\b[A-Za-z]{2}\d{9}[A-Za-z]{2}\b/g },
  { carrier: 'ups',      pattern: /\b1Z[A-Z0-9]{16}\b/g },
  { carrier: 'airmee',   pattern: /\bAIR-[A-Z0-9]{7,}\b/g },
  { carrier: 'fedex',    pattern: /\b(\d{15}|\d{12}|\d{20})\b/g },
  { carrier: 'dhl',      pattern: /\b\d{10,11}\b/g },
  { carrier: 'bring',    pattern: /\b\d{17}\b/g },
  { carrier: 'schenker', pattern: /\b[A-Z]{3}\d{9}\b/g },
];

export class TrackingDetector {
  detect(text) {
    const seen = new Set();
    const results = [];

    for (const { carrier, pattern } of CARRIERS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        const tn = match[0];
        if (!seen.has(tn)) {
          seen.add(tn);
          results.push({ trackingNumber: tn, carrier });
        }
      }
    }

    return results;
  }
}
