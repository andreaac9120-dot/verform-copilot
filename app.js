// VERFORM COPILOT – archivio treni, import dei pacchetti .vf.json, checklist offline per l'inserimento in Verform.
const VERSION = "1.0.0";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t3 = kg => (Number(kg || 0) / 1000).toFixed(3).replace(".", ",");
const fmtNev = n => { const d = String(n); return d.length === 12 ? `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8, 11)}-${d.slice(11)}` : d; };
const TRI = '<svg class="tri" viewBox="0 0 18 16" role="img" aria-label="merce pericolosa"><path d="M9 1 17 15H1Z" fill="var(--waste)" stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 6v4.5" stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="12.6" r=".9" fill="var(--ink)"/></svg>';
const ICONA = { ok: "✅", warn: "⚠️", info: "ℹ️", ko: "❌" };

// ---------- Interfaccia di base ----------
let toastT = null;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }
function openSheet(html) { $("#sheetIn").innerHTML = html + `<button class="btn" type="button" data-cmd="closeSheet">Chiudi</button>`; $("#sheet").hidden = $("#scrim").hidden = false; }
function closeSheet() { $("#sheet").hidden = $("#scrim").hidden = true; }
function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); }
function toggleTheme() {
  const root = document.documentElement, cur = root.getAttribute("data-theme");
  const dark = cur === "dark" || (!cur && matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "light" : "dark");
  DB.setConf("tema", dark ? "light" : "dark").catch(() => {});
}
function net() { for (const el of [$("#net"), $("#net2")]) { el.className = "net " + (navigator.onLine ? "on" : "off"); el.textContent = navigator.onLine ? "ONLINE" : "OFFLINE"; } }
function testoErrore(err) { if (err && err.name === "QuotaExceededError") return "spazio esaurito nel telefono"; return (err && (err.message || err.name)) || "errore sconosciuto"; }

// ---------- Controllo del pacchetto (formato v1) ----------
const isObj = x => x !== null && typeof x === "object" && !Array.isArray(x);
const isStr = x => typeof x === "string";
const isArr = Array.isArray;
const isKg = x => Number.isFinite(x) && x >= 0;
const isNum0 = x => x === null || Number.isFinite(x);
function dataVera(a, m, g) { const d = new Date(Date.UTC(a, m - 1, g)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g; }
function controlla(p) {
  const e = [];
  const ok = (c, msg) => { if (!c) e.push(msg); return !!c; };
  if (!isObj(p) || p.formato !== "verform-copilot-pacchetto") return ["non è un pacchetto VERFORM COPILOT"];
  if (p.versione_formato !== 1) return [`formato v${p.versione_formato} non supportato (questa app legge la v1): aggiorna l'app`];
  const m = /^[0-9A-Za-z-]+_(\d{4})-(\d{2})-(\d{2})$/.exec(isStr(p.id) ? p.id : "");
  if (ok(m, "id mancante o non valido")) ok(dataVera(+m[1], +m[2], +m[3]), `id ${p.id}: data inesistente`);
  ok(Number.isInteger(p.revisione) && p.revisione >= 1, "revisione mancante");
  ok(isStr(p.creato) && !isNaN(Date.parse(p.creato)), "data di creazione non valida");
  const T = p.treno;
  if (ok(isObj(T), "dati treno mancanti")) {
    ok(isStr(T.numero) && T.numero, "numero treno mancante");
    ok(isStr(T.relazione), "relazione mancante");
    const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(isStr(T.data) ? T.data : "");
    if (ok(d, "data treno mancante (GG/MM/AAAA)")) ok(dataVera(+d[3], +d[2], +d[1]), `data ${T.data} inesistente`);
    ok(T.avvisi === undefined || (isArr(T.avvisi) && T.avvisi.every(isStr)), "avvisi treno non validi");
  }
  ok(p.te === null || (isObj(p.te) && isStr(p.te.num) && isStr(p.te.scad) && typeof p.te.valida === "boolean" && isArr(p.te.carri) && p.te.carri.every(isStr)), "TE non valida (null se non serve)");
  if (ok(isArr(p.ldv) && p.ldv.length, "nessuna lettera di vettura")) p.ldv.forEach((l, i) => {
    const n = `LdV ${i + 1}`;
    if (!ok(isObj(l) && isStr(l.numero) && isStr(l.tratta) && isArr(l.carri), `${n}: dati non validi`)) return;
    ok(l.avvisi === undefined || (isArr(l.avvisi) && l.avvisi.every(isStr)), `${n}: avvisi non validi`);
    const visti = new Set();
    l.carri.forEach((c, j) => {
      const cn = `${n} carro ${j + 1}`;
      if (!ok(isObj(c) && Number.isInteger(c.pos) && isStr(c.nev) && /^\d{12}$/.test(c.nev) && typeof c.carico === "boolean" && isArr(c.uti), `${cn}: dati non validi (NEV di 12 cifre, carico, uti)`)) return;
      ok(!visti.has(c.nev), `${n}: NEV ${c.nev} ripetuto`); visti.add(c.nev);
      ok(c.assi === null || c.assi === undefined || Number.isInteger(c.assi), `${cn}: assi non validi`);
      ok(c.carico === c.uti.length > 0, `${cn}: "carico" non coerente con le UTI`);
      c.uti.forEach((u, k) => ok(isObj(u) && isStr(u.codice) && isKg(u.peso_kg) && ["vuoto", "mp", "rifiuto"].every(f => typeof u[f] === "boolean"), `${cn} UTI ${k + 1}: dati non validi`));
    });
  });
  if (ok(isArr(p.mp), "elenco MP mancante ([] se nessuna)")) p.mp.forEach((x, i) => ok(isObj(x) && isStr(x.nev) && isStr(x.uti) && isStr(x.onu) && isStr(x.pericolo) && isStr(x.classe) && isKg(x.peso_kg) && ["MP", "Vuoto MP", "MP QL"].includes(x.flag), `MP ${i + 1}: dati non validi`));
  if (ok(isArr(p.rifiuti), "elenco rifiuti mancante ([] se nessuno)")) p.rifiuti.forEach((x, i) => ok(isObj(x) && isStr(x.nev) && isStr(x.uti) && isStr(x.cer) && typeof x.pericoloso === "boolean" && isStr(x.onu_pericolo) && isKg(x.peso_kg), `rifiuto ${i + 1}: dati non validi`));
  if (ok(isArr(p.verifiche_rifiuti), "verifiche rifiuti mancanti ([] se nessuna)")) p.verifiche_rifiuti.forEach((x, i) => ok(isObj(x) && isStr(x.nev) && isStr(x.uti) && isStr(x.notifica) && isStr(x.cer) && isStr(x.riga) && ["ok", "ko", "warn"].includes(x.esito), `verifica rifiuti ${i + 1}: dati non validi`));
  if (ok(isArr(p.controlli), "controlli mancanti")) p.controlli.forEach((x, i) => ok(isObj(x) && ["ok", "warn", "info", "ko"].includes(x.esito) && isStr(x.titolo) && isStr(x.testo), `controllo ${i + 1}: dati non validi`));
  const C = p.convoglio;
  ok(isObj(C) && ["lunghezza_m", "assi", "massa_t"].every(k => isNum0(C[k])) && Number.isInteger(C.carri) && isKg(C.tot_carico_kg), "dati convoglio non validi");
  if (ok(isArr(p.chiusura), "voci di chiusura mancanti")) {
    const ids = new Set();
    p.chiusura.forEach((x, i) => { if (ok(isObj(x) && isStr(x.id) && x.id && isStr(x.testo), `chiusura ${i + 1}: dati non validi`)) { ok(!ids.has(x.id), `chiusura: id "${x.id}" ripetuto`); ids.add(x.id); } });
  }
  return [...new Set(e)];
}

// ---------- Import ----------
async function importaTesto(txt, nome) {
  let p;
  try { p = JSON.parse(txt); } catch (_) { return { err: `${nome}: file non leggibile (JSON non valido)` }; }
  const e = controlla(p);
  if (e.length) return { err: `${nome}: ${e.slice(0, 8).join("; ")}${e.length > 8 ? ` (e altri ${e.length - 8})` : ""}` };
  const vecchio = await DB.get(p.id);
  if (vecchio && vecchio.revisione > p.revisione && !confirm(`Hai già la revisione ${vecchio.revisione} del treno ${p.treno.numero}. Sostituirla con la ${p.revisione}, più vecchia?`))
    return { err: `${nome}: non importato (tenuta la revisione ${vecchio.revisione})` };
  p.importato = new Date().toISOString();
  try { await DB.put(p); } catch (err) { return { err: `${nome}: salvataggio non riuscito (${testoErrore(err)})` }; }
  return { ok: true, id: p.id, sostituito: !!vecchio };
}
async function importaFiles(files) {
  const esiti = [];
  for (const f of files) {
    const nome = f.name || "file";
    let r; try { r = await importaTesto(await f.text(), nome); } catch (err) { r = { err: `${nome}: errore imprevisto (${testoErrore(err)})` }; }
    esiti.push({ nome, ...r });
  }
  await home();
  const fatti = esiti.filter(x => x.ok), falliti = esiti.filter(x => x.err);
  if (falliti.length) openSheet(`<div class="sh-title">Importazione</div><p class="note">${fatti.length} importati · ${falliti.length} non importati</p>` +
    falliti.map(x => `<div class="sh-row ko">${esc(x.err)}</div>`).join("") + fatti.map(x => `<div class="sh-row ok">Importato: ${esc(x.nome)}</div>`).join(""));
  else if (fatti.length === 1) { toast(fatti[0].sostituito ? "Treno aggiornato: spunte conservate" : "Treno importato"); apri(fatti[0].id); }
  else if (fatti.length) toast(`${fatti.length} treni importati`);
  return esiti;
}

// ---------- File ricevuti con "Condividi" ----------
const CONDIVISI = "verform-copilot-condivisi";
async function condivisi() {
  if (!("caches" in window) || !(await caches.has(CONDIVISI))) return [];
  const c = await caches.open(CONDIVISI);
  return (await c.keys()).map(k => ({ c, k }));
}
async function importaCondivisi() {
  history.replaceState(null, "", "./" + location.hash);
  const L = await condivisi(); if (!L.length) return;
  const files = [];
  for (const x of L) { const r = await x.c.match(x.k); files.push(new File([await r.blob()], decodeURIComponent(x.k.url.split("/").pop()))); }
  const esiti = await importaFiles(files);
  for (let i = 0; i < L.length; i++) if (esiti[i] && esiti[i].ok) await L[i].c.delete(L[i].k);
  await sospesi();
}
async function sospesi() {
  let n = 0; try { n = (await condivisi()).length; } catch (_) {}
  $("#sospesi").hidden = !n;
  $("#sospesi").innerHTML = n ? `<div class="alert">${n} file ricevut${n === 1 ? "o" : "i"} con Condividi non importat${n === 1 ? "o" : "i"}.<div class="btns"><button class="small-btn" type="button" data-cmd="riprova">Riprova</button><button class="small-btn alt" type="button" data-cmd="scarta">Scarta</button></div></div>` : "";
}

// ---------- Voci spuntabili ----------
// Ogni gruppo = una scheda: si colora di verde quando tutte le sue voci sono spuntate.
function gruppi(p) {
  const G = [];
  p.ldv.forEach(l => l.carri.forEach(c => G.push({ sez: "carri", ids: [`c:${l.numero}:${c.nev}`, ...c.uti.map(u => `u:${l.numero}:${c.nev}:${u.codice}`)] })));
  p.mp.forEach(x => G.push({ sez: "mp", ids: [`mp:${x.nev}:${x.uti}:${x.onu}`] }));
  p.rifiuti.forEach(x => G.push({ sez: "rf", ids: [`rf:${x.nev}:${x.uti}`] }));
  p.verifiche_rifiuti.forEach(x => G.push({ sez: "vr", ids: [`vr:${x.nev}:${x.uti}`] }));
  if (p.chiusura.length) G.push({ sez: "end", ids: p.chiusura.map(x => `end:${x.id}`) });
  return G;
}
const tutteLeVoci = p => gruppi(p).flatMap(g => g.ids);

// ---------- Home ----------
let corrente = null, spunte = {};
const dataId = p => String(p && p.id || "").split("_").pop();
async function home() {
  closeSheet(); corrente = null;
  $("#treno").hidden = true; $("#home").hidden = false;
  let V = []; try { V = await DB.list(); } catch (err) { toast("Archivio non leggibile: " + testoErrore(err)); }
  V.sort((a, b) => dataId(b).localeCompare(dataId(a)) || String(a.id).localeCompare(String(b.id)));
  const righe = [];
  for (const p of V) {
    const id = String(p && p.id || "");
    if (controlla(p).length) { righe.push(`<div class="trip"><div class="item"><span><b>Treno non leggibile</b><br><small>${esc(id)}</small></span></div><button class="del" type="button" data-del="${esc(id)}">Elimina</button></div>`); continue; }
    let s = {}; try { s = await DB.getSpunte(id); } catch (_) {}
    const voci = tutteLeVoci(p), fatte = voci.filter(v => s[v]).length;
    const nCarri = p.ldv.reduce((a, l) => a + l.carri.length, 0);
    const segni = (p.mp.length ? " · MP" : "") + (p.rifiuti.length ? " · rifiuti" : "") + (p.te ? " · TE" : "");
    righe.push(`<div class="trip"><button class="item" type="button" data-open="${esc(id)}"><span><span class="tno">${esc(p.treno.numero)}</span><br>${esc(p.treno.relazione)}<br><small>${esc(p.treno.data)} · ${nCarri} carri · ${p.ldv.length} LdV${segni} · rev. ${p.revisione}</small></span><span class="pct">${voci.length ? Math.round(fatte / voci.length * 100) : 0}%</span></button>
      <button class="del" type="button" data-del="${esc(id)}" aria-label="Elimina treno ${esc(p.treno.numero)}">Elimina</button></div>`);
  }
  $("#treni").innerHTML = righe.length ? righe.join("") : `<div class="empty">Nessun treno salvato. Alla fine di "analizza treno" Claude ti consegna il file <b>.vf.json</b>: scaricalo e scegli <b>Importa pacchetto</b>, oppure aprilo con Condividi → VERFORM COPILOT.</div>`;
  try { const e = await navigator.storage.estimate(); $("#storeInfo").textContent = `Spazio usato nel telefono: ${(e.usage / 1048576).toFixed(1)} MB.`; } catch (_) {}
  await sospesi();
}
async function elimina(id) {
  const p = await DB.get(id);
  if (!confirm(p && p.treno ? `Eliminare il treno ${p.treno.numero} del ${p.treno.data} e le sue spunte?` : `Eliminare ${id}?`)) return;
  try { await DB.del(id); toast("Treno eliminato"); } catch (err) { toast("Eliminazione non riuscita: " + testoErrore(err)); }
  home();
}

// ---------- Scheda treno ----------
const box = '<span class="box"></span>';
const voce = (id, inner, sub) => `<button type="button" class="row${sub ? " sub" : ""}" role="checkbox" aria-checked="false" data-id="${esc(id)}">${box}${inner}</button>`;
function segnoCarro(p, c) {
  const mp = c.uti.some(u => u.mp), rf = c.uti.some(u => u.rifiuto);
  const sei = mp && c.assi === 6;
  return (mp ? (sei ? '<i class="sq" aria-label="MP su carro a 6 assi"></i>' : '<i class="dot r" aria-label="merce pericolosa"></i>') : "") + (rf ? '<i class="dot y" aria-label="rifiuto"></i>' : "");
}
function sixSet(p) { const S = new Set(); p.ldv.forEach(l => l.carri.forEach(c => { if (c.assi === 6 && c.uti.some(u => u.mp)) S.add(c.nev); })); return S; }

function disegna(p) {
  const six = sixSet(p);
  let h = "";
  const avvisi = [...(p.treno.avvisi || [])];
  if (p.te) avvisi.unshift(`Treno ha ${p.te.num} · scadenza ${p.te.scad}${p.te.valida ? "" : " — TE SCADUTA"} · carri ${p.te.carri.map(fmtNev).join(", ")}`);
  if (p.mp.length) avvisi.push("Merce pericolosa presente: compilare Checklist Merci Pericolose e Scheda Unica di Emergenza.");
  if (avvisi.length) h += avvisi.map(a => `<div class="alert${/SCADUTA/.test(a) ? " red" : ""}">${esc(a)}</div>`).join("");

  h += `<div class="legend"><span><i class="dot r"></i>carro con MP</span><span><i class="sq"></i>MP su 6 assi (TE)</span><span><i class="dot y"></i>rifiuto</span><span>${TRI}UTI con MP</span></div>`;

  // Carri
  h += `<section class="sec" id="s-carri"><h3>Carri <small id="cnt-carri"></small></h3>`;
  p.ldv.forEach(l => {
    const tot = l.carri.reduce((a, c) => a + c.uti.reduce((b, u) => b + u.peso_kg, 0), 0);
    h += `<div class="ldvh"><b>LdV ${esc(l.numero)} · ${esc(l.tratta)}</b><span>${esc([l.data, l.info].filter(Boolean).join(" · "))} · totale ${t3(tot)} t</span>${(l.avvisi || []).map(a => `<span class="w">⚠ ${esc(a)}</span>`).join("")}</div><div class="cards">`;
    l.carri.forEach(c => {
      const tot = c.uti.reduce((a, u) => a + u.peso_kg, 0);
      h += `<div class="ck" data-g="c:${esc(l.numero)}:${c.nev}">`;
      h += voce(`c:${l.numero}:${c.nev}`, `<span class="main"><span class="pos">Pos ${c.pos} <span class="tag${c.carico ? " si" : ""}">CARICO ${c.carico ? "SI" : "NO"}</span>${six.has(c.nev) ? '<span class="tag red">TE · 6 ASSI</span>' : ""}</span><span class="nev">${segnoCarro(p, c)}${fmtNev(c.nev)}</span></span><span class="val"><b>${t3(tot)}</b><span>t totale carro</span></span>`);
      c.uti.forEach(u => { h += voce(`u:${l.numero}:${c.nev}:${u.codice}`, `<span class="main"><span class="uti">${u.mp ? TRI : ""}${esc(u.codice)}</span>${u.vuoto ? '<span class="meta">UTI vuota</span>' : ""}</span><span class="val"><b>${t3(u.peso_kg)}</b><span>t peso UTI</span></span>`, 1); });
      h += `</div>`;
    });
    h += `</div>`;
  });
  h += `</section>`;

  // MP
  h += `<section class="sec" id="s-mp"><h3>Merci pericolose <small id="cnt-mp"></small></h3><div class="cards">`;
  h += p.mp.length ? p.mp.map(x => `<div class="ck" data-g="mp:${esc(x.nev)}:${esc(x.uti)}:${esc(x.onu)}">${voce(`mp:${x.nev}:${x.uti}:${x.onu}`, `<span class="main"><span class="nev">${six.has(x.nev) ? '<i class="sq"></i>' : '<i class="dot r"></i>'}${fmtNev(x.nev)}</span><span class="uti">${TRI}${esc(x.uti)}</span><span class="kv"><div><span>ONU</span>${esc(x.onu)}</div><div><span>Pericolo</span>${esc(x.pericolo)}</div><div><span>Classe/GI</span>${esc(x.classe)}</div><div><span>Netto MP</span>${t3(x.peso_kg)} t</div><div><span>Flag Verform</span><b class="flag">${esc(x.flag)}</b></div></span>${x.nota ? `<span class="meta">${esc(x.nota)}</span>` : ""}</span><span></span>`)}</div>`).join("")
    : `<div class="ck"><div class="row static"><span class="meta">Nessuna merce pericolosa.</span></div></div>`;
  h += `</div></section>`;

  // Rifiuti
  h += `<section class="sec" id="s-rf"><h3>Rifiuti <small id="cnt-rf"></small></h3><div class="cards">`;
  h += p.rifiuti.length ? p.rifiuti.map(x => `<div class="ck" data-g="rf:${esc(x.nev)}:${esc(x.uti)}">${voce(`rf:${x.nev}:${x.uti}`, `<span class="main"><span class="nev">${x.pericoloso ? '<i class="dot r"></i>' : ""}<i class="dot y"></i>${fmtNev(x.nev)}</span><span class="uti">${esc(x.uti)}</span><span class="kv"><div><span>CER</span>${esc(x.cer)}</div><div><span>Pericoloso</span>${x.pericoloso ? "SI" : "NO"}</div><div><span>ONU / pericolo</span>${esc(x.onu_pericolo || "—")}</div><div><span>Peso</span>${t3(x.peso_kg)} t</div></span><span class="meta">Flag Verform: Rifiuto${x.pericoloso ? " + MP" : ""}</span></span><span></span>`)}</div>`).join("")
    : `<div class="ck"><div class="row static"><span class="meta">Nessun rifiuto dichiarato.</span></div></div>`;
  h += `</div>`;
  if (p.verifiche_rifiuti.length) {
    h += `<h3>Allegati ministeriali <small id="cnt-vr"></small></h3><div class="cards">`;
    h += p.verifiche_rifiuti.map(x => `<div class="ck" data-g="vr:${esc(x.nev)}:${esc(x.uti)}">${voce(`vr:${x.nev}:${x.uti}`, `<span class="main"><span class="esito e-${x.esito}">${ICONA[x.esito]} ${x.esito === "ok" ? "TRAFFICO AUTORIZZATO" : x.esito === "ko" ? "NON CONFORME" : "DA VERIFICARE"}</span><span class="uti">${esc(x.uti)}</span><span class="kv"><div><span>Notifica</span>${esc(x.notifica)}</div><div><span>CER</span>${esc(x.cer)}</div><div><span>Documento</span>${esc(x.documento || "—")}</div></span><span class="meta">Traffico: ${esc(x.traffico || "—")} · riga: ${esc(x.riga)}</span>${x.promemoria ? `<span class="meta">${esc(x.promemoria)}</span>` : ""}${x.note ? `<span class="meta">${esc(x.note)}</span>` : ""}</span><span></span>`)}</div>`).join("");
    h += `</div>`;
  }
  h += `</section>`;

  // Controlli
  const ord = { ko: 0, warn: 1, info: 2, ok: 3 };
  const ctl = [...p.controlli].sort((a, b) => ord[a.esito] - ord[b.esito]);
  h += `<section class="sec" id="s-ctl"><h3>Controlli</h3><div class="ck">${ctl.map(x => `<div class="ctl"><span class="ic">${ICONA[x.esito]}</span><span><b>${esc(x.titolo)}</b><br><span class="meta">${esc(x.testo)}</span></span></div>`).join("") || `<div class="ctl"><span></span><span class="meta">Nessun controllo.</span></div>`}</div>`;
  const C = p.convoglio, nd = v => v === null || v === undefined ? "—" : String(v).replace(".", ",");
  h += `<div class="ck convo"><div><span>Carri</span><b>${C.carri}</b></div><div><span>Totale carico</span><b>${t3(C.tot_carico_kg)} t</b></div><div><span>Lunghezza</span><b>${nd(C.lunghezza_m)}${C.lunghezza_m != null ? " m" : ""}</b></div><div><span>Assi</span><b>${nd(C.assi)}</b></div><div><span>Massa</span><b>${nd(C.massa_t)}${C.massa_t != null ? " t" : ""}</b></div></div></section>`;

  // Chiusura
  h += `<section class="sec" id="s-end"><h3>Chiusura <small id="cnt-end"></small></h3><div class="cards"><div class="ck" data-g="end">`;
  h += p.chiusura.map(x => voce(`end:${x.id}`, `<span class="main"><span style="font-weight:600"${x.evidenza ? ' class="end-red"' : ""}>${esc(x.testo)}</span>${x.nota ? `<span class="meta">${esc(x.nota)}</span>` : ""}</span><span></span>`)).join("");
  h += `</div></div></section>`;
  $("#tBody").innerHTML = h;

  const ko = p.controlli.some(x => x.esito === "ko") || p.verifiche_rifiuti.some(x => x.esito === "ko");
  $("#jump").innerHTML = [["s-carri", "Carri"], ["s-mp", `MP ${p.mp.length}`, p.mp.length], ["s-rf", `Rifiuti ${p.rifiuti.length}`, p.rifiuti.length], ["s-ctl", "Controlli", ko], ["s-end", "Chiusura"]]
    .map(([id, t, w]) => `<a href="#${id}" data-jump="${id}"${w ? ' class="warn"' : ""}>${esc(t)}</a>`).join("");
}

function aggiorna() {
  if (!corrente) return;
  const rows = document.querySelectorAll("#tBody .row[data-id]");
  let n = 0; rows.forEach(r => { const on = !!spunte[r.dataset.id]; r.setAttribute("aria-checked", on); if (on) n++; });
  $("#barFill").style.width = (rows.length ? n / rows.length * 100 : 0) + "%";
  $("#progressTxt").textContent = `${n} / ${rows.length} voci`;
  let next = false;
  document.querySelectorAll("#tBody .ck[data-g]").forEach(g => {
    const ids = [...g.querySelectorAll(".row[data-id]")].map(r => r.dataset.id);
    const done = ids.length && ids.every(i => spunte[i]);
    g.classList.toggle("complete", !!done);
    const isNext = !done && !next && ids.length; g.classList.toggle("next", !!isNext); if (isNext) next = true;
  });
  const conta = sel => { const g = [...document.querySelectorAll(`#tBody .ck[data-g^="${sel}"]`)]; return `${g.filter(x => x.classList.contains("complete")).length} / ${g.length}`; };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cnt-carri", conta("c:") + " carri"); set("cnt-mp", corrente.mp.length ? conta("mp:") : "0"); set("cnt-rf", corrente.rifiuti.length ? conta("rf:") : "0");
  set("cnt-vr", conta("vr:"));
  const e = [...document.querySelectorAll('#tBody .row[data-id^="end:"]')]; set("cnt-end", `${e.filter(r => spunte[r.dataset.id]).length} / ${e.length}`);
}
let salvaT = null;
function salva() { clearTimeout(salvaT); const id = corrente.id, s = { ...spunte }; salvaT = setTimeout(() => DB.setSpunte(id, s).catch(err => toast("Spunte non salvate: " + testoErrore(err))), 250); }

async function apri(id) {
  const p = await DB.get(id);
  if (!p) return toast("Treno non trovato");
  const e = controlla(p);
  if (e.length) return openSheet(`<div class="sh-title">Treno non leggibile</div>` + e.slice(0, 8).map(x => `<div class="sh-row ko">${esc(x)}</div>`).join(""));
  corrente = p; spunte = await DB.getSpunte(id).catch(() => ({}));
  $("#tNum").textContent = `Treno ${p.treno.numero}`;
  $("#tRel").textContent = `${p.treno.data} · ${p.treno.relazione}`;
  $("#tRev").textContent = `rev. ${p.revisione} · ${p.ldv.length} LdV`;
  disegna(p); aggiorna();
  $("#home").hidden = true; $("#treno").hidden = false; scrollTo(0, 0);
  if (location.hash !== "#t=" + id) history.pushState({ t: id }, "", "#t=" + encodeURIComponent(id));
}
function vaiA(el) {
  if (!el) return;
  const y = el.getBoundingClientRect().top + scrollY - $("#tHead").offsetHeight - 16;
  scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
function nascondi(v) { $("#btnHide").setAttribute("aria-pressed", v); $("#tBody").classList.toggle("hide-done", v); DB.setConf("nascondi", v).catch(() => {}); }

// ---------- Eventi ----------
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-jump]");
  if (a) { e.preventDefault(); return vaiA(document.getElementById(a.dataset.jump)); }
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset;
  if (d.id && corrente) { if (spunte[d.id]) delete spunte[d.id]; else spunte[d.id] = true; aggiorna(); return salva(); }
  if (d.cmd === "theme") return toggleTheme();
  if (d.cmd === "home") return location.hash ? history.back() : home();
  if (d.cmd === "closeSheet") return closeSheet();
  if (d.cmd === "next") { const n = document.querySelector("#tBody .ck.next"); return n ? vaiA(n) : toast("Tutte le voci sono spuntate"); }
  if (d.cmd === "reset") { if (corrente && confirm("Togliere tutte le spunte di questo treno?")) { spunte = {}; aggiorna(); salva(); } return; }
  if (d.cmd === "riprova") return importaCondivisi();
  if (d.cmd === "scarta") { (async () => { if (!confirm("Scartare i file ricevuti e non importati?")) return; for (const x of await condivisi()) await x.c.delete(x.k); sospesi(); })(); return; }
  if (d.cmd === "aggiorna") { if (swInAttesa) swInAttesa.postMessage("aggiorna"); return; }
  if (t.id === "btnHide") return nascondi(t.getAttribute("aria-pressed") !== "true");
  if (d.open) return apri(d.open);
  if (d.del) return elimina(d.del);
});
$("#scrim").addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
$("#fImport").addEventListener("change", e => { importaFiles([...e.target.files]); e.target.value = ""; });
addEventListener("online", net); addEventListener("offline", net);
addEventListener("popstate", () => { const m = location.hash.match(/^#t=(.+)$/); m ? apri(decodeURIComponent(m[1])) : home(); });

// ---------- Offline e aggiornamenti ----------
let swInAttesa = null;
function statoOffline(t) { $("#offInfo").textContent = t; }
function mostraAggiornamento(w) { swInAttesa = w; $("#agg").hidden = false; $("#agg").innerHTML = `<div class="alert">Nuova versione dell'app pronta.<div class="btns"><button class="small-btn" type="button" data-cmd="aggiorna">Aggiorna ora</button></div></div>`; }
async function registraSW() {
  if (!("serviceWorker" in navigator)) return statoOffline("Questo browser non permette l'uso offline.");
  const gia = !!navigator.serviceWorker.controller; let ric = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (gia && !ric) { ric = true; location.reload(); } });
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    if (reg.waiting && navigator.serviceWorker.controller) mostraAggiornamento(reg.waiting);
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) mostraAggiornamento(w); }); });
    statoOffline("Uso offline: in preparazione (serve la rete al primo avvio)…");
    await navigator.serviceWorker.ready;
    statoOffline("Uso offline: app salvata nel telefono. Senza rete i caratteri possono apparire diversi.");
  } catch (_) { statoOffline("Uso offline NON disponibile: registrazione non riuscita. Riapri l'app con la rete."); }
}

// ---------- Avvio ----------
(async function avvio() {
  $("#ver").textContent = VERSION; net();
  try { applyTheme(await DB.getConf("tema")); } catch (_) {}
  try { const v = await DB.getConf("nascondi"); $("#btnHide").setAttribute("aria-pressed", !!v); $("#tBody").classList.toggle("hide-done", !!v); } catch (_) {}
  registraSW();
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
  await home();
  if (new URLSearchParams(location.search).has("condivisi")) await importaCondivisi();
  const m = location.hash.match(/^#t=(.+)$/); if (m) apri(decodeURIComponent(m[1]));
})();
