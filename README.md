# Referendum Feed

Monitor gratuito per l'endpoint pubblico delle iniziative referendum del Ministero della Giustizia.

Il progetto legge periodicamente i dati da:

```text
https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public
```

Normalizza il payload, confronta lo snapshot precedente salvato nel repository, rileva nuove iniziative, aggiornamenti o rimozioni, invia le novita a Telegram e genera feed statici pubblicabili con GitHub Pages.

Non usa database, VPS, Redis o servizi a pagamento.

## Stack

- Node.js 22 come runtime
- TypeScript
- Vite come tooling
- Bun solo come package manager
- GitHub Actions per il polling schedulato
- Storage file-based in `data/`
- Feed statici in `public/`
- Telegram Bot API via `fetch` nativo

## Setup Locale

Installa le dipendenze:

```bash
bun install
```

Esegui typecheck:

```bash
bun run typecheck
```

Esegui il polling locale:

```bash
bun run poll
```

Lo script compila TypeScript con `tsc` ed esegue `node dist/index.js`.

Se preferisci npm, dopo aver installato le dipendenze puoi usare:

```bash
npm run poll
```

## Preview Telegram

Per vedere il messaggio HTML generato senza inviarlo:

```bash
bun run telegram:preview
```

Puoi forzare una iniziativa specifica con:

```bash
TELEGRAM_PREVIEW_ITEM_ID=5200000 bun run telegram:preview
```

Per inviare un solo messaggio di test servono entrambe le conferme:

```bash
TELEGRAM_PREVIEW_ITEM_ID=5200000 TELEGRAM_SEND_TEST=true bun run telegram:preview --send
```

Se disponibile, il logo ufficiale dell'iniziativa viene scaricato dall'endpoint pubblico e caricato a Telegram come immagine con caption HTML.

## Variabili Ambiente

Variabili supportate:

```text
SOURCE_URL=https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public
PUBLIC_BASE_URL=https://OWNER.github.io/referendum-feed
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
SEND_INITIAL_EVENTS=false
FETCH_TIMEOUT_MS=20000
```

`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` sono opzionali in locale. Se mancano, il polling aggiorna snapshot e feed ma salta l'invio Telegram.

## Bot Telegram

1. Apri Telegram e cerca `@BotFather`.
2. Crea un bot con `/newbot`.
3. Copia il token generato.
4. Aggiungi il bot al gruppo Telegram di destinazione.
5. Recupera il `chat_id` del gruppo usando l'API Telegram o un bot di supporto affidabile.

## GitHub Secrets

Nel repository GitHub vai in `Settings` -> `Secrets and variables` -> `Actions` e crea:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Il workflow usa questi secret solo come variabili d'ambiente. Nessun secret viene scritto nel repository.

## GitHub Pages

Attiva GitHub Pages da `Settings` -> `Pages`.

Configurazione consigliata:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/public`

Dopo il primo aggiornamento, i feed saranno disponibili a URL simili a:

```text
https://OWNER.github.io/referendum-feed/feed.xml
https://OWNER.github.io/referendum-feed/feed.json
```

## Primo Avvio

Al primo run, se `data/latest.json` o `data/latest.hash` sono vuoti, lo script salva lo snapshot iniziale ma non invia notifiche Telegram per tutte le iniziative gia presenti.

Questo evita spam nel gruppo Telegram.

Per generare e inviare eventi anche al primo avvio, imposta:

```text
SEND_INITIAL_EVENTS=true
```

Il workflow incluso usa `SEND_INITIAL_EVENTS=false`.

## Polling

Il workflow `.github/workflows/poll.yml` parte ogni 15 minuti:

```yaml
cron: "*/15 * * * *"
```

Puo anche essere avviato manualmente con `workflow_dispatch`.

Il job committa solo se cambiano file dentro `data/` o `public/`.

### Modalita Baseline

Dopo modifiche alla normalizzazione o al formato degli eventi puoi lanciare il workflow manuale con `baseline_only=true`.

In questa modalita lo script:

- aggiorna `data/latest.json`;
- aggiorna `data/latest.hash`;
- rigenera i feed dagli eventi gia salvati;
- non crea nuovi eventi;
- non invia messaggi Telegram.

Serve per riallineare lo snapshot ed evitare notifiche massive dovute a cambi tecnici del formato.

## Gestione Errori

Il fetch usa:

- timeout configurabile
- header `Accept: application/json`
- header `User-Agent: referendum-feed-bot/1.0`
- log dello status code
- gestione errori HTTP

Se l'endpoint restituisce `403`, `429`, errori temporanei o payload inatteso, lo script non prova bypass, scraping aggressivo o retry aggressivi. Mantiene lo snapshot esistente e rigenera eventualmente i feed dagli eventi gia salvati.

## File Generati

- `data/latest.json`: ultimo snapshot normalizzato
- `data/latest.hash`: hash SHA-256 dello snapshot
- `data/events.json`: ultimi eventi rilevati, massimo 500
- `public/feed.xml`: feed RSS, massimo 100 eventi
- `public/feed.json`: JSON Feed, massimo 100 eventi

## Licenza

Licenza consigliata: MIT.
