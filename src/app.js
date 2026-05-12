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

async function main() {
  await store.open();
  await store.pruneDelivered(14);

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

  await refresh();
}

main().catch(err => {
  console.error(err);
  document.getElementById('loading').classList.add('hidden');
});
