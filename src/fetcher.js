const TRACKING_URLS = {
  postnord: tn => `https://www.postnord.se/vara-verktyg/spara-brev-paket-och-pall?shipmentId=${tn}`,
  dhl:      tn => `https://www.dhl.com/se-sv/home/tracking.html?tracking-id=${tn}`,
  ups:      tn => `https://www.ups.com/track?tracknum=${tn}`,
  fedex:    tn => `https://www.fedex.com/fedextrack/?tracknumbers=${tn}`,
  bring:    tn => `https://tracking.bring.com/tracking/${tn}`,
  schenker: tn => `https://www.dbschenker.com/global/track-shipment?id=${tn}`,
  airmee:   tn => `https://airmee.com/track/${tn}`,
};

function postnordStatus(json) {
  try {
    const items = json.TrackingInformationResponse?.Shipment?.[0]?.Item ?? [];
    const event = items[0]?.event?.[0]?.eventDescription?.[0] ?? '';
    const lower = event.toLowerCase();
    let status = 'in_transit';
    if (lower.includes('levererat') || lower.includes('utlämnat')) status = 'delivered';
    else if (lower.includes('utbärning') || lower.includes('på väg')) status = 'out_for_delivery';
    return { status, statusText: event, estimatedDelivery: null };
  } catch {
    return { status: 'unknown', statusText: '', estimatedDelivery: null };
  }
}

function dhlStatus(json) {
  try {
    const shipment = json.shipments?.[0];
    const desc = shipment?.events?.[0]?.description ?? '';
    const statusMap = {
      'delivered': 'delivered',
      'out_for_delivery': 'out_for_delivery',
      'transit': 'in_transit',
      'pre-transit': 'in_transit',
      'failure': 'exception',
      'unknown': 'unknown',
    };
    const status = statusMap[shipment?.status?.toLowerCase()] ?? 'in_transit';
    const est = shipment?.estimatedTimeOfDelivery ?? null;
    return { status, statusText: desc, estimatedDelivery: est };
  } catch {
    return { status: 'unknown', statusText: '', estimatedDelivery: null };
  }
}

export class StatusFetcher {
  constructor(config) {
    this.config = config;
  }

  async fetchStatus(carrier, trackingNumber) {
    const fallback = {
      status: 'unknown',
      statusText: '',
      estimatedDelivery: null,
      trackingUrl: TRACKING_URLS[carrier]?.(trackingNumber) ?? null,
    };

    try {
      if (carrier === 'postnord') {
        const url = `https://api2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json` +
          `?apikey=${this.config.postnord.apiKey}&id=${trackingNumber}&locale=sv`;
        const res = await fetch(url);
        if (!res.ok) return fallback;
        const json = await res.json();
        return { ...fallback, ...postnordStatus(json) };
      }

      if (carrier === 'dhl') {
        const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${trackingNumber}`;
        const res = await fetch(url, { headers: { 'DHL-API-Key': this.config.dhl.apiKey } });
        if (!res.ok) return fallback;
        const json = await res.json();
        return { ...fallback, ...dhlStatus(json) };
      }

      return fallback;
    } catch {
      return fallback;
    }
  }
}
