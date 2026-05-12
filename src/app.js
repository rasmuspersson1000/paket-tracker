import { CONFIG } from '../config.js';
import { AuthManager } from './auth.js';
import { EmailScanner } from './scanner.js';
import { TrackingDetector } from './detector.js';
import { StatusFetcher } from './fetcher.js';
import { PackageStore } from './store.js';
import { renderAccounts, renderPackages, showLoading, showAuthScreen } from './ui.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

const auth = new AuthManager();
const scanner = new EmailScanner();
const detector = new TrackingDetector();
const fetcher = new StatusFetcher(CONFIG);
const store = new PackageStore();

async function getValidAccount(provider) {
  const account = await store.getAccount(provider);
  if (!account) return null;
  if (auth.isExpired(account)) {
    await store.saveAccount({ provider, accessToken: null, expiresAt: 0 });
    return null;
  }
  return account;
}

async function savePackage(trackingNumber, carrier, emailSubject, source) {
  const id = `${carrier}-${trackingNumber}`;
  const statusData = await fetcher.fetchStatus(carrier, trackingNumber);
  await store.upsertPackage({
    id,
    trackingNumber,
    carrier,
    emailSubject,
    source,
    detectedAt: new Date().toISOString(),
    status: statusData.status,
    statusText: statusData.statusText,
    estimatedDelivery: statusData.estimatedDelivery ?? null,
    trackingUrl: statusData.trackingUrl ?? null,
    lastUpdated: new Date().toISOString(),
  });
}

async function scanAndUpdate(account) {
  const emails = account.provider === 'google'
    ? await scanner.scanGmail(account.accessToken)
    : await scanner.scanOutlook(account.accessToken);

  for (const email of emails) {
    const textHits = detector.detect(email.subject + ' ' + email.body);
    const urlHits = detector.detectFromUrls(email.links ?? []);
    const seen = new Set();
    const hits = [];
    for (const h of [...textHits, ...urlHits]) {
      if (!seen.has(h.trackingNumber)) { seen.add(h.trackingNumber); hits.push(h); }
    }
    for (const { trackingNumber, carrier } of hits) {
      await savePackage(trackingNumber, carrier, email.subject, email.source);
    }
  }
}

const DEMO_PACKAGES = [
  {
    id: 'demo-postnord-SE123456789SE',
    trackingNumber: 'SE123456789SE',
    carrier: 'postnord',
    emailSubject: 'Din beställning från Elgiganten har skickats',
    source: 'demo',
    detectedAt: new Date().toISOString(),
    status: 'in_transit',
    statusText: 'På väg till utlämningsställe',
    estimatedDelivery: new Date(Date.now() + 2 * 86400000).toISOString(),
    trackingUrl: 'https://tracking.postnord.com/SE123456789SE',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'demo-dhl-1234567890',
    trackingNumber: '1234567890',
    carrier: 'dhl',
    emailSubject: 'Paket på väg – IKEA order #8823411',
    source: 'demo',
    detectedAt: new Date().toISOString(),
    status: 'out_for_delivery',
    statusText: 'Levereras idag',
    estimatedDelivery: new Date().toISOString(),
    trackingUrl: 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id=1234567890',
    lastUpdated: new Date().toISOString(),
  },
  {
    id: 'demo-ups-1Z999AA10123456784',
    trackingNumber: '1Z999AA10123456784',
    carrier: 'ups',
    emailSubject: 'Your Amazon order has been shipped',
    source: 'demo',
    detectedAt: new Date().toISOString(),
    status: 'delivered',
    statusText: 'Levererat',
    estimatedDelivery: null,
    trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    lastUpdated: new Date().toISOString(),
  },
];

async function seedDemoIfEmpty() {
  if (localStorage.getItem('demo-seeded')) return;
  for (const pkg of DEMO_PACKAGES) await store.upsertPackage(pkg);
  localStorage.setItem('demo-seeded', '1');
}

async function refresh() {
  const googleAccount = await getValidAccount('google');
  const msAccount = await getValidAccount('microsoft');
  const accounts = [googleAccount, msAccount].filter(Boolean);

  if (accounts.length === 0) {
    showAuthScreen(true);
    const cached = await store.getAllPackages();
    renderPackages(cached);
    return;
  }

  showAuthScreen(false);
  renderAccounts(accounts);
  showLoading(true);

  await Promise.allSettled(accounts.map(scanAndUpdate));

  showLoading(false);
  const packages = await store.getAllPackages();
  renderPackages(packages);
}

function initPullToRefresh(onRefresh) {
  let startY = 0;
  let refreshing = false;
  const indicator = document.getElementById('ptr-indicator');

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (refreshing || window.scrollY > 0) return;
    const dist = e.touches[0].clientY - startY;
    if (dist > 10) indicator.classList.remove('hidden');
  }, { passive: true });

  document.addEventListener('touchend', async (e) => {
    if (refreshing) return;
    const dist = e.changedTouches[0].clientY - startY;
    indicator.classList.add('hidden');
    if (dist > 80 && window.scrollY === 0) {
      refreshing = true;
      await onRefresh();
      refreshing = false;
    }
  }, { passive: true });
}

async function main() {
  await store.open();
  await store.pruneDelivered(14);
  await seedDemoIfEmpty();

  document.getElementById('form-manual').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-tracking');
    const raw = input.value.trim();
    if (!raw) return;
    const hits = detector.detect(raw);
    if (hits.length === 0) {
      alert('Tracking-numret kändes inte igen. Kontrollera att det är korrekt.');
      return;
    }
    const { trackingNumber, carrier } = hits[0];
    input.value = '';
    showLoading(true);
    await savePackage(trackingNumber, carrier, 'Manuellt tillagt', 'manual');
    showLoading(false);
    const packages = await store.getAllPackages();
    renderPackages(packages);
  };

  document.getElementById('btn-google').onclick = async () => {
    try {
      const account = await auth.signInGoogle();
      await store.saveAccount(account);
      await refresh();
    } catch (err) {
      console.error('Google sign-in failed', err);
    }
  };

  document.getElementById('btn-microsoft').onclick = async () => {
    try {
      const account = await auth.signInMicrosoft();
      await store.saveAccount(account);
      await refresh();
    } catch (err) {
      console.error('Microsoft sign-in failed', err);
    }
  };

  initPullToRefresh(refresh);
  await refresh();
}

main().catch(err => {
  console.error(err);
  document.getElementById('loading').classList.add('hidden');
});
