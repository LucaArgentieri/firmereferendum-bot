# Referendum Telegram Bot

Monitor gratuito per l'endpoint pubblico delle iniziative referendum del Ministero della Giustizia.

Il progetto legge periodicamente i dati da:

```text
https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public
```

Normalizza il payload, confronta lo snapshot precedente salvato nel repository e invia a Telegram le nuove iniziative rilevate. Lo snapshot viene aggiornato anche quando cambiano firme o altri dati, ma di default questi aggiornamenti non generano notifiche.

Non usa database, VPS, Redis o servizi a pagamento.

## Come funziona

Ad ogni esecuzione il bot segue questi passi:

1. **Fetch** — recupera il payload JSON dall'API pubblica con timeout configurabile
2. **Normalizzazione** — estrae i campi rilevanti (titolo, stato, firme, scadenza, link…) e produce un array di `NormalizedItem`
3. **Confronto snapshot** — calcola l'hash SHA-256 dello snapshot corrente e lo confronta con quello salvato in `data/latest.hash`; se uguale, termina senza fare nulla
4. **Generazione eventi** — confronta i singoli item con lo snapshot precedente e genera eventi `created`, `updated` o `removed`
5. **Filtro** — mantiene solo i tipi di evento configurati in `TELEGRAM_EVENT_TYPES` (default: `created`)
6. **Salvataggio** — scrive `data/latest.json`, `data/latest.hash` e `data/events.json` nel repository
7. **Notifica** — invia i messaggi Telegram per gli eventi filtrati; ogni messaggio include titolo, descrizione, categoria, stato, date, firme e link diretto all'iniziativa

GitHub Actions esegue questo ciclo ogni 15 minuti e committa i file `data/` solo se sono cambiati.

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

Variabili supportate (con i valori di default):

```text
SOURCE_URL=https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_EVENT_TYPES=created
SEND_INITIAL_EVENTS=false
BASELINE_ONLY=false
FETCH_TIMEOUT_MS=20000
TELEGRAM_PREVIEW_ITEM_ID=5200000
TELEGRAM_SEND_TEST=false
```

`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` sono opzionali in locale. Se mancano, il polling aggiorna lo snapshot ma salta l'invio Telegram.

`TELEGRAM_EVENT_TYPES` controlla quali eventi inviare al gruppo. Il default consigliato è `created`, quindi vengono notificate solo le nuove iniziative. Valori possibili:

```text
created
created,removed
created,updated,removed
```

`TELEGRAM_PREVIEW_ITEM_ID` specifica l'ID dell'iniziativa da usare per il preview locale (default: `5200000`).

`TELEGRAM_SEND_TEST` se impostato a `true`, invia effettivamente il messaggio di test durante il preview invece di stamparlo solo a schermo.

## Bot Telegram

Un'istanza di questo bot è già attiva sul gruppo Telegram **Referendum e Iniziative Popolari**:
https://t.me/referendum_e_iniziative_popolari

Quel gruppo è il caso d'uso concreto da cui nasce il progetto. Per configurare il tuo bot:

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

Al primo run, se `data/latest.json` o `data/latest.hash` sono vuoti, lo script salva lo snapshot iniziale ma non invia notifiche Telegram per tutte le iniziative già presenti.

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

Può anche essere avviato manualmente con `workflow_dispatch`.

Il job committa solo se cambiano file dentro `data/`.

### Modalità Baseline

Dopo modifiche alla normalizzazione o al formato degli eventi puoi lanciare il workflow manuale con `baseline_only=true`.

In questa modalità lo script:

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

## Struttura del Progetto

```
src/
├── index.ts             # Orchestrazione principale del ciclo poll
├── config.ts            # Lettura e validazione variabili d'ambiente
├── env.ts               # Parser file .env
├── fetch-source.ts      # Fetch API con timeout e gestione errori HTTP
├── normalize.ts         # Normalizzazione payload in NormalizedItem[]
├── hash.ts              # SHA-256 e hashing stabile degli oggetti
├── diff.ts              # Confronto snapshot, generazione FeedEvent[]
├── storage.ts           # Lettura/scrittura atomica file data/
├── telegram.ts          # Formattazione messaggi HTML e invio Telegram
└── telegram-preview.ts  # Script per preview e test locale messaggi
```

## Come Contribuire

1. Fai fork del repository e clona in locale
2. Installa le dipendenze con `bun install`
3. Copia `.env.example` in `.env` e inserisci le credenziali Telegram per i test
4. Prima di aprire una PR, verifica che il typecheck passi:

```bash
bun run typecheck
```

5. Per testare il formato dei messaggi Telegram senza dover triggerare eventi reali:

```bash
bun run telegram:preview
```

**Convenzioni del progetto:**

- Nessun database: lo stato è interamente nei file `data/`
- Graceful degradation: errori API o Telegram tengono lo snapshot esistente, non crashano
- Nessun retry aggressivo: un errore transitorio viene loggato e il run termina; il successivo ciclo riproverà
- Per aggiungere un nuovo canale di notifica (es. WhatsApp), implementa un nuovo sender che consuma gli stessi `FeedEvent[]` già generati dal diff

## Estensioni Future

Il progetto è pensato per avere Telegram come primo canale di notifica. In futuro si può aggiungere un secondo sender, ad esempio WhatsApp Business Cloud API, riusando gli stessi eventi generati dal diff.

## Licenza

Licenza consigliata: MIT.
