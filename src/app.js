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

const auth = new AuthManager(CONFIG);
const scanner = new EmailScanner();
const detector = new TrackingDetector();
const fetcher = new StatusFetcher(CONFIG);
const store = new PackageStore();

async function getValidAccount(provider) {
  let account = await store.getAccount(provider);
  if (!account) return null;
  if (auth.isExpired(account)) {
    account = await auth.refreshAccessToken(account);
    if (!account) { await store.saveAccount({ provider, accessToken: null, refreshToken: null, expiresAt: 0 }); return null; }
    await store.saveAccount(account);
  }
  return account;
}

async function scanAndUpdate(account) {
  const emails = account.provider === 'google'
    ? await scanner.scanGmail(account.accessToken)
    : await scanner.scanOutlook(account.accessToken);

  for (const email of emails) {
    const hits = detector.detect(email.subject + ' ' + email.body);
    for (const { trackingNumber, carrier } of hits) {
      const id = `${carrier}-${trackingNumber}`;
      const statusData = await fetcher.fetchStatus(carrier, trackingNumber);
      await store.upsertPackage({
        id,
        trackingNumber,
        carrier,
        emailSubject: email.subject,
        source: email.source,
        detectedAt: new Date().toISOString(),
        status: statusData.status,
        statusText: statusData.statusText,
        estimatedDelivery: statusData.estimatedDelivery ?? null,
        trackingUrl: statusData.trackingUrl ?? null,
        lastUpdated: new Date().toISOString(),
      });
    }
  }
}

async function main() {
  await store.open();
  await store.pruneDelivered(14);

  // Handle OAuth callback
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (code) {
    window.history.replaceState({}, '', '/');
    const account = await auth.handleCallback(code, state);
    if (account) await store.saveAccount(account);
  }

  // Wire up login buttons
  document.getElementById('btn-google').onclick = () => auth.startOAuth('google');
  document.getElementById('btn-microsoft').onclick = () => auth.startOAuth('microsoft');

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

main().catch(err => {
  console.error(err);
  document.getElementById('loading').classList.add('hidden');
});
