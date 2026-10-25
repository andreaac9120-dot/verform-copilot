// Archivio locale (IndexedDB): pacchetti treno, spunte, impostazioni. Nulla lascia il telefono.
const DB = (() => {
  const NAME = "verform-copilot", VER = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("treni")) d.createObjectStore("treni", { keyPath: "id" });
        if (!d.objectStoreNames.contains("spunte")) d.createObjectStore("spunte"); // id treno → { id: true, … }
        if (!d.objectStoreNames.contains("conf")) d.createObjectStore("conf");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
  async function st(name, mode) { const d = await open(); const tx = d.transaction(name, mode); return [tx, tx.objectStore(name)]; }
  return {
    async list() { const [, s] = await st("treni", "readonly"); return req(s.getAll()); },
    async get(id) { const [, s] = await st("treni", "readonly"); return req(s.get(id)); },
    async put(p) { const [tx, s] = await st("treni", "readwrite"); s.put(p); return done(tx); },
    async del(id) {
      const d = await open(); const tx = d.transaction(["treni", "spunte"], "readwrite");
      tx.objectStore("treni").delete(id); tx.objectStore("spunte").delete(id);
      return done(tx);
    },
    async getSpunte(id) { const [, s] = await st("spunte", "readonly"); return (await req(s.get(id))) || {}; },
    async setSpunte(id, v) { const [tx, s] = await st("spunte", "readwrite"); s.put(v, id); return done(tx); },
    async getConf(k) { const [, s] = await st("conf", "readonly"); return req(s.get(k)); },
    async setConf(k, v) { const [tx, s] = await st("conf", "readwrite"); s.put(v, k); return done(tx); }
  };
})();
