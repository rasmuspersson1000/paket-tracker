export class PackageStore {
  constructor(dbName = 'paket-tracker') {
    this.dbName = dbName;
    this.db = null;
  }

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('packages')) {
          db.createObjectStore('packages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'provider' });
        }
      };
      req.onsuccess = e => { this.db = e.target.result; resolve(); };
      req.onerror = e => reject(e.target.error);
    });
  }

  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const s = tx.objectStore(store);
      const req = fn(s);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }

  upsertPackage(pkg) {
    return this._tx('packages', 'readwrite', s => s.put(pkg));
  }

  getAllPackages() {
    return this._tx('packages', 'readonly', s => s.getAll());
  }

  saveAccount(account) {
    return this._tx('accounts', 'readwrite', s => s.put(account));
  }

  getAccount(provider) {
    return this._tx('accounts', 'readonly', s => s.get(provider));
  }

  async pruneDelivered(olderThanDays) {
    const all = await this.getAllPackages();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const toDelete = all.filter(
      p => p.status === 'delivered' && new Date(p.lastUpdated).getTime() < cutoff
    );
    await Promise.all(toDelete.map(p =>
      this._tx('packages', 'readwrite', s => s.delete(p.id))
    ));
  }
}
