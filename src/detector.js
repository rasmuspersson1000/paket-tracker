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

// Extract tracking number from known carrier tracking URLs.
const URL_PATTERNS = [
  { carrier: 'postnord', pattern: /tracking\.postnord\.[a-z]+\/[^?\s]*?([A-Za-z]{2}\d{9}[A-Za-z]{2})/i },
  { carrier: 'postnord', pattern: /tracking\.postnord\.[a-z]+[^?\s]*[?&]id=([A-Za-z0-9]+)/i },
  { carrier: 'dhl',      pattern: /dhl\.[a-z.]+[^?\s]*[?&](?:tracking-id|trackingNumber|id)=(\d{10,12})/i },
  { carrier: 'dhl',      pattern: /mydhl\+?[^?\s]*[?&](?:trackingNumber|id)=(\d{10,12})/i },
  { carrier: 'ups',      pattern: /ups\.com[^?\s]*[?&](?:tracknum|InquiryNumber1)=(1Z[A-Z0-9]{16})/i },
  { carrier: 'fedex',    pattern: /fedex\.com[^?\s]*[?&](?:trknbr|trackingnumber)=(\d{12,20})/i },
  { carrier: 'bring',    pattern: /tracking\.bring\.[a-z]+\/tracking\/([A-Z0-9]{15,20})/i },
  { carrier: 'schenker', pattern: /schenker\.[a-z]+[^?\s]*[?&](?:id|trackId)=([A-Z]{3}\d{9})/i },
  { carrier: 'airmee',   pattern: /airmee\.[a-z]+[^?\s]*[?&](?:id|order)=(AIR-[A-Z0-9]{7,})/i },
  // Amazon redirects to carrier — extract from their tracking URL
  { carrier: 'postnord', pattern: /amazon\.[a-z.]+[^?\s]*carrier_tracking_id=([A-Za-z]{2}\d{9}[A-Za-z]{2})/i },
  { carrier: 'dhl',      pattern: /amazon\.[a-z.]+[^?\s]*carrier_tracking_id=(\d{10,12})/i },
  { carrier: 'ups',      pattern: /amazon\.[a-z.]+[^?\s]*carrier_tracking_id=(1Z[A-Z0-9]{16})/i },
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

  detectFromUrls(urls) {
    const seen = new Set();
    const results = [];

    for (const url of urls) {
      for (const { carrier, pattern } of URL_PATTERNS) {
        const match = pattern.exec(url);
        if (match) {
          const tn = match[1];
          if (!seen.has(tn)) {
            seen.add(tn);
            results.push({ trackingNumber: tn, carrier });
          }
          break;
        }
      }
    }

    return results;
  }
}
