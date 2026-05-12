function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_LABELS = {
  in_transit:        'På väg',
  out_for_delivery:  'Levereras idag',
  delivered:         'Levererat',
  exception:         'Problem',
  unknown:           'Okänd status',
};

const CARRIER_NAMES = {
  postnord: 'PostNord',
  dhl:      'DHL',
  ups:      'UPS',
  fedex:    'FedEx',
  bring:    'Bring',
  schenker: 'Schenker',
  airmee:   'Airmee',
};

export function renderAccounts(accounts) {
  const el = document.getElementById('accounts');
  el.innerHTML = accounts.map(a =>
    `<span class="account-badge">${a.provider === 'google' ? 'Gmail' : 'Outlook'} ✓</span>`
  ).join('');
}

export function renderPackages(packages) {
  const list = document.getElementById('package-list');
  const empty = document.getElementById('empty');

  const active = packages.filter(p => p.status !== 'delivered');
  const delivered = packages.filter(p => p.status === 'delivered');
  const sorted = [...active, ...delivered];

  if (sorted.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = sorted.map(pkg => {
    const label = esc(STATUS_LABELS[pkg.status] ?? pkg.status);
    const carrier = esc(CARRIER_NAMES[pkg.carrier] ?? pkg.carrier);
    const href = esc(pkg.trackingUrl ?? '#');
    const statusClass = esc(pkg.status);
    return `
      <li>
        <a class="package-item" href="${href}" target="_blank" rel="noopener">
          <div class="package-info">
            <div class="carrier">${carrier} · ${esc(pkg.trackingNumber)}</div>
            <div class="subject">${esc(pkg.emailSubject)}</div>
          </div>
          <span class="status-badge status-${statusClass}">${label}</span>
        </a>
      </li>`;
  }).join('');
}

export function showLoading(visible) {
  document.getElementById('loading').classList.toggle('hidden', !visible);
}

export function showAuthScreen(visible) {
  document.getElementById('auth-screen').classList.toggle('hidden', !visible);
}
