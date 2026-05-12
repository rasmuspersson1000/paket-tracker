import { describe, it, expect, beforeEach } from 'vitest';
import { PackageStore } from '../src/store.js';

describe('PackageStore', () => {
  let store;

  beforeEach(async () => {
    store = new PackageStore('test-db-' + Date.now());
    await store.open();
  });

  it('saves and retrieves a package', async () => {
    const pkg = {
      id: 'postnord-SE123456789SE',
      trackingNumber: 'SE123456789SE',
      carrier: 'postnord',
      emailSubject: 'Din order har skickats',
      source: 'gmail',
      detectedAt: new Date().toISOString(),
      status: 'in_transit',
      statusText: 'Sorteras',
      estimatedDelivery: null,
      trackingUrl: 'https://www.postnord.se/spara?id=SE123456789SE',
      lastUpdated: new Date().toISOString(),
    };
    await store.upsertPackage(pkg);
    const all = await store.getAllPackages();
    expect(all).toHaveLength(1);
    expect(all[0].trackingNumber).toBe('SE123456789SE');
  });

  it('upserts existing package without duplicating', async () => {
    const pkg = {
      id: 'dhl-1234567890',
      trackingNumber: '1234567890',
      carrier: 'dhl',
      emailSubject: 'DHL shipment',
      source: 'outlook',
      detectedAt: new Date().toISOString(),
      status: 'in_transit',
      statusText: 'On the way',
      estimatedDelivery: null,
      trackingUrl: null,
      lastUpdated: new Date().toISOString(),
    };
    await store.upsertPackage(pkg);
    await store.upsertPackage({ ...pkg, status: 'delivered' });
    const all = await store.getAllPackages();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('delivered');
  });

  it('saves and retrieves account tokens', async () => {
    await store.saveAccount({ provider: 'google', accessToken: 'tok', refreshToken: 'ref', expiresAt: 9999 });
    const acc = await store.getAccount('google');
    expect(acc.accessToken).toBe('tok');
  });

  it('deletes old delivered packages', async () => {
    const old = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    await store.upsertPackage({
      id: 'postnord-OLD',
      trackingNumber: 'OLD',
      carrier: 'postnord',
      emailSubject: 'old',
      source: 'gmail',
      detectedAt: old,
      status: 'delivered',
      statusText: 'Delivered',
      estimatedDelivery: null,
      trackingUrl: null,
      lastUpdated: old,
    });
    await store.pruneDelivered(14);
    const all = await store.getAllPackages();
    expect(all).toHaveLength(0);
  });
});
