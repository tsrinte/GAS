// Minimal GAS runtime mock for local simulation (NOT a substitute for /dev verification)
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = path.join(__dirname, '../tools/node_modules/');
const { DOMParser } = require(T + '@xmldom/xmldom');
const AdmZip = require(T + 'adm-zip');

class Blob {
  constructor(buf, name) { this.buf = Buffer.from(buf); this.name = name || ''; }
  getBytes() { return Array.from(this.buf).map(b => b > 127 ? b - 256 : b); }
  getDataAsString() { return this.buf.toString('utf8'); }
  getName() { return this.name; } setName(n) { this.name = n; return this; }
  getContentType() { return 'application/octet-stream'; } setContentType() { return this; }
  getBlob() { return this; } copyBlob() { return new Blob(this.buf, this.name); }
}
class Attr { constructor(v) { this.v = v; } getValue() { return this.v; } }
class El {
  constructor(n) { this.n = n; }
  getName() { return this.n.localName; }
  getNamespace() { return { uri: this.n.namespaceURI || '' }; }
  _kids(name, ns) { const out = []; for (let c = this.n.firstChild; c; c = c.nextSibling) { if (c.nodeType !== 1) continue; if (name && c.localName !== name) continue; if (ns && (c.namespaceURI || '') !== ns.uri) continue; out.push(new El(c)); } return out; }
  getChildren(name, ns) { return this._kids(name, ns); }
  getChild(name, ns) { return this._kids(name, ns)[0] || null; }
  getAttribute(name, ns) { const v = ns ? this.n.getAttributeNS(ns.uri, name) : this.n.getAttribute(name); return (v === null || v === '' && !(ns ? this.n.hasAttributeNS(ns.uri, name) : this.n.hasAttribute(name))) ? null : new Attr(v); }
  getText() { let s = ''; for (let c = this.n.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) s += c.data; return s; }
}
function makeContext(opts) {
  const props = opts.props || {};
  const files = opts.files || {};   // id -> {path,name,modified_at}
  const folders = opts.folders || {}; // folderId -> [fileId]
  const cacheStore = {};
  const logs = [];
  const ctx = {
    console: { log: (...a) => { logs.push(a.join(' ')); if (opts.verbose) console.log(...a); } },
    Utilities: {
      unzip(blob) { const z = new AdmZip(blob.buf); return z.getEntries().filter(e => !e.isDirectory).map(e => new Blob(e.getData(), e.entryName)); },
      formatDate(d, tz, fmt) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {}); return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second); },
      newBlob(data, ct, name) { return new Blob(typeof data === 'string' ? Buffer.from(data) : Buffer.from(data.map(b => b & 255)), name); },
      base64Encode(b) { return Buffer.from(b.map ? b.map(x => x & 255) : b).toString('base64'); },
      base64Decode(s) { return Array.from(Buffer.from(s, 'base64')).map(b => b > 127 ? b - 256 : b); },
      sleep() {},
    },
    XmlService: {
      parse(xml) { const doc = new DOMParser().parseFromString(xml, 'text/xml'); return { getRootElement: () => new El(doc.documentElement) }; },
      getNamespace(p, uri) { return { uri: uri === undefined ? p : uri }; },
    },
    CacheService: { getScriptCache: () => ({
      get: k => (k in cacheStore ? cacheStore[k] : null),
      put: (k, v) => { if (String(v).length > 100000) throw new Error('Argument too large: value'); cacheStore[k] = String(v); },
      remove: k => { delete cacheStore[k]; }, getAll: ks => ks.reduce((o, k) => (k in cacheStore && (o[k] = cacheStore[k]), o), {}), putAll: (o) => Object.assign(cacheStore, o), removeAll: ks => ks.forEach(k => delete cacheStore[k]),
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, getProperties: () => props }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch(url) {
      const m = url.match(/folders\/([^/]+)\/items/);
      if (!m) throw new Error('mock: unsupported url ' + url);
      const entries = (folders[decodeURIComponent(m[1])] || []).map(id => ({ type: 'file', id, name: files[id].name, modified_at: files[id].modified_at, size: 1 }));
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ total_count: entries.length, entries }) };
    } },
    getRequiredProperty_(k) { if (!props[k]) throw new Error('Missing Script Property: ' + k); return props[k]; },
    getBoxAuthHeader_() { return { Authorization: 'Bearer MOCK' }; },
    boxDownloadFile_(id) { const f = files[id]; if (!f) throw new Error('mock: no file ' + id); return new Blob(fs.readFileSync(f.path), f.name); },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return { ctx, logs, cacheStore, load(file) { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: path.basename(file) }); } };
}
module.exports = { makeContext, Blob };
