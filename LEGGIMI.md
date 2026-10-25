# VERFORM COPILOT – PWA distinte treno offline (v1.0.0)

App da installare sull'Android: archivio dei treni analizzati da Claude nel progetto "Formazione Treno", con la checklist spuntabile per l'inserimento in Verform, consultabile **senza rete**. Stessa impostazione e stessa grafica di ADC COPILOT.

## File dell'app (tutti nella stessa cartella)
`index.html`, `style.css`, `db.js`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.

Nell'app c'è solo il codice. I pacchetti `.vf.json` che importi e le spunte restano nella memoria del telefono.

## Pubblicazione (una volta sola) – GitHub Pages
1. Su github.com: **+ → New repository**, nome `verform-copilot`, **Public**, spunta "Add a README", **Create repository**.
2. **Add file → Upload files**, scegli i 9 file dell'app, **Commit changes**.
3. **Settings → Pages**: Branch `main`, cartella `/ (root)`, **Save**. Dopo 1–2 minuti l'indirizzo è `https://andreaac9120-dot.github.io/verform-copilot/`.

## Installazione sul telefono
1. Apri l'indirizzo con **Chrome**.
2. Menu ⋮ → **Installa app**.
3. Apri l'app una volta con la rete: da quel momento funziona anche offline.

## Uso
- In Claude: "analizza treno" con i documenti. Alla fine Claude consegna il file `treno_<numero>_<ggmmaa>.vf.json`.
- **Importa pacchetto** e scegli il file scaricato, oppure dal file **Condividi → VERFORM**.
- Tocca il treno: carri per LdV con UTI e pesi, MP, rifiuti e allegati ministeriali, controlli, voci di chiusura. Ogni voce si spunta; la scheda diventa verde quando è completa.
- **Prossimo ↓** porta alla prima scheda non completa; **Nascondi fatti** toglie quelle completate; i tasti in alto saltano alle sezioni.
- Stesso treno reimportato con revisione più alta: sostituisce il vecchio, le spunte restano.
- **Elimina** a fine servizio.

## Aggiornare l'app
Sostituisci i file su GitHub e cambia in `sw.js` la riga `const VER = NS + "shell-1.0.0"` (es. `shell-1.0.1`) e `VERSION` in `app.js`. Il telefono mostra "Nuova versione pronta" e si aggiorna con **Aggiorna ora**. I treni salvati non si perdono.

## Limiti
- L'analisi la fa Claude (serve la rete); l'app consulta soltanto.
- Se Chrome cancella i dati del sito, i pacchetti vanno reimportati (l'app chiede l'archiviazione persistente).
- Fanno fede lettere di vettura, liste carri e documenti originali.
