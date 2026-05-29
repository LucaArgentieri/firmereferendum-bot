# Referendum Telegram Bot

Monitor gratuito per l'endpoint pubblico delle iniziative referendum del Ministero della Giustizia.

Il progetto legge periodicamente i dati da:

```text
https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public
```

Normalizza il payload, confronta lo snapshot precedente salvato nel repository e invia a Telegram le nuove iniziative rilevate. Lo snapshot viene aggiornato anche quando cambiano firme o altri dati, ma di default questi aggiornamenti non generano notifiche.

Non usa database, VPS, Redis o servizi a pagamento.

## Stack

- Node.js 22 come runtime
- TypeScript
- Vite come tooling
- Bun solo come package manager
- GitHub Actions per il polling schedulato
- Storage file-based in `data/`
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
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_EVENT_TYPES=created
SEND_INITIAL_EVENTS=false
BASELINE_ONLY=false
FETCH_TIMEOUT_MS=20000
```

`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` sono opzionali in locale. Se mancano, il polling aggiorna lo snapshot ma salta l'invio Telegram.

`TELEGRAM_EVENT_TYPES` controlla quali eventi inviare al gruppo. Il default consigliato e `created`, quindi vengono notificate solo le nuove iniziative. Valori possibili:

```text
created
created,removed
created,updated,removed
```

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

Il job committa solo se cambiano file dentro `data/`.

### Modalita Baseline

Dopo modifiche alla normalizzazione o al formato degli eventi puoi lanciare il workflow manuale con `baseline_only=true`.

In questa modalita lo script:

- aggiorna `data/latest.json`;
- aggiorna `data/latest.hash`;
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

Se l'endpoint restituisce `403`, `429`, errori temporanei o payload inatteso, lo script non prova bypass, scraping aggressivo o retry aggressivi. Mantiene lo snapshot esistente e termina senza inviare notifiche.

## File Generati

- `data/latest.json`: ultimo snapshot normalizzato
- `data/latest.hash`: hash SHA-256 dello snapshot
- `data/events.json`: ultimi eventi rilevati, massimo 500

## Estensioni Future

Il progetto e pensato per avere Telegram come primo canale di notifica. In futuro si puo aggiungere un secondo sender, ad esempio WhatsApp Business Cloud API, riusando gli stessi eventi generati dal diff.

## Licenza

Licenza consigliata: MIT.
