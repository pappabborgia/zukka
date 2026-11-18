# Lo Studio (Fase 3)

Lo Studio è nell'area genitore (`/studio`, protetto dal PIN). Un genitore può:

1. **Partire da un modello** (creazione rapida): oggi il motore di School Cup. Sceglie nome del gioco, del torneo
   e della squadra, colori e disegno della maglia, materia, anno e da 1 a 6 argomenti (più le tabelline, se servono).
2. **Fare una sua versione di un gioco del catalogo** ("Make your own version"): stessa cosa, ma il gioco nuovo
   ricorda da quale gioco è partito (`parentGameId`, servirà per i crediti della Fase 9). L'originale non cambia mai.
3. **Descrivere un gioco nuovo** (creazione libera, Fase 4): una procedura guidata in cinque passi, poi l'AI scrive il
   gioco e il genitore lo cambia con "What would you like to change?".
4. **Fare una sua versione di un gioco senza modulo** (oggi Race to Starfish Bay): parte da una copia del gioco, poi
   le modifiche le fa l'AI.

## Come nasce un gioco da un modello

- Ogni motore è un file HTML (`engines/<id>/template.html`) con la sua configurazione di partenza in un blocco
  `CONFIG`. School Cup legge **solo** da lì squadre, tornei, anni, materie, livelli e domande.
- Il modulo diventa una configurazione (`packages/engines/src/school-cup/quick.ts`), validata con Zod
  (`schema.ts`): colori solo `#rrggbb`, nomi solo lettere, numeri e poca punteggiatura, nessun `<`, `>` o backtick,
  generatori solo tra quelli che esistono nel gioco.
- **Matematica**: gli argomenti usano i generatori già presenti in School Cup (risposte calcolate dal codice), con
  numeri più grandi nei turni finali (`topics.ts`).
- **Reading e Writing**: gli argomenti usano la banca di domande di School Cup, livello per livello.
- **Domande scritte dall'AI** (casella "✨" nel modulo, attiva solo con `ANTHROPIC_API_KEY`):
  - Reading e Writing: 14 domande a scelta multipla per argomento;
  - Matematica: problemi a parole. L'AI scrive la storia e la somma (`a`, operazione, `b`); **la risposta la calcola
    il codice** e il problema viene scartato se l'AI ha sbagliato, se i numeri non compaiono nel testo o se esce
    dalle tabelline scelte (`apps/web/src/lib/ai-check.ts`);
  - ogni domanda passa il filtro delle parole e dei nomi protetti; nel prompt va solo ciò che è fisso (materia, anno,
    argomenti della nostra lista, tabelline), mai testo scritto dal genitore;
  - si generano **una volta**, quando si salva, e restano nella versione.
- Modello: Claude Opus 5.5 con output strutturato; se una richiesta viene rifiutata, risponde un altro modello nella
  stessa chiamata (`fallbacks: "default"`).

## Creazione libera (Fase 4)

**La procedura guidata** (`components/FreeGameWizard.tsx`) chiede quello che serve davvero all'AI:

| Passo | Domande |
|---|---|
| 1. L'idea | nome del gioco; tipo di gioco (corsa, quiz, puzzle, avventura su una mappa, raccogli e prendi, sport, gioco da tavolo, altro); di cosa parla e qual è lo scopo |
| 2. Cosa insegna | materia (Maths, Reading, Writing, altro); anno (Year 2, Year 3, 6-9 anni); argomenti dalla lista e/o scritti; come rispondono i bambini (tocco, scrittura, misto) |
| 3. Mondo e personaggi | ambientazione (spazio, giungla, mare, città, castello, fattoria, stadio, scuola, altro); protagonista; amici, aiutanti o avversari; atmosfera |
| 4. Come si gioca | come si vince; numero di livelli (3-6, ognuno più difficile); durata (5, 7 o 10 minuti); premi |
| 5. Riepilogo | tutte le risposte, "Anything else?", conferma delle regole |

Ogni passo controlla le risposte prima di andare avanti; il server le valida di nuovo (`FreeBrief` in
`lib/server/free-games.ts`) e passa i testi nel filtro delle parole, dei dati personali e dei nomi protetti.

**Generazione** (`lib/server/ai-games.ts`): Claude Opus 5.5 riceve le regole del formato dei giochi (le stesse di
`docs/GAME-FORMAT.md`, eventi Zukka compresi) e le risposte del genitore dentro un tag che non può cambiare le regole.
- Il gioco nuovo viene scritto tutto in una volta, in streaming.
- Una modifica chiede all'AI solo le parti da sostituire (trova/sostituisci); se non si applicano, il gioco viene riscritto.
- Ogni risultato passa il **controllo statico** (`packages/engines/src/static-check.ts`: rete, storage, eval, popup,
  navigazione, moduli, link e risorse esterne, eventi mancanti, voci non locali, codice offuscato, 700 KB). Se trova
  problemi bloccanti, l'AI ha un solo tentativo automatico per correggerli; quelli rimasti si vedono nella pagina e
  impediranno l'invio in revisione (Fase 5).
- Il lavoro continua dopo la risposta della pagina (`after()` di Next.js, fino a 300 secondi); la pagina del gioco si
  aggiorna da sola. Oltre i 6 minuti una generazione si considera persa e si può riprovare.
- Ogni risultato è una versione nuova; si può tornare a qualsiasi versione precedente.

**Costo stimato per richiesta** (prezzi di Claude Opus 5.5): creazione di un gioco circa 0,30-0,60 $; una modifica
circa 0,10-0,25 $. Con il tetto predefinito di 20 $ al mese sono circa 40-60 giochi nuovi: per la fase di prova conviene
alzare `AI_MONTHLY_BUDGET_USD`.

**Test**: con gli emulatori e `ZUKKA_FAKE_AI=1` un'AI finta (`lib/server/fake-ai.ts`) restituisce subito un piccolo gioco
valido; non funziona mai fuori dagli emulatori.

## Limiti (file `apps/web/src/lib/config/studio.ts`)

| Limite | Valore |
|---|---|
| Bozze per account | 5 |
| Versioni per gioco | 30 |
| Generazioni AI per gioco | 10 |
| Generazioni AI per account al giorno | 10 |
| Spesa AI mensile della piattaforma | `AI_MONTHLY_BUDGET_USD` (predefinito 20 $). Superata, la casella AI dà un messaggio e gli admin (`ADMIN_EMAILS`) ricevono un'email (con Resend configurato; altrimenti resta nei log) |
| Dimensione di un gioco | 700 KB, controllata al salvataggio e da servire |

## Dove sono i giochi

```
games/{gameId}                  proprietario, tipo, motore, titolo, materia, anno, argomenti, stato, versione attuale
games/{gameId}/versions/{vid}   versioni immutabili: la configurazione (JSON in testo) o l'HTML di un gioco libero
aiDaily/{uid}_{giorno}          generazioni AI del giorno
aiMonthly/{mese}                spesa AI stimata del mese
```

Il sito dei giochi serve una versione da `/v/{gameId}/{versionId}` con un service account **di sola lettura**:

- il contenuto di una versione non cambia mai e resta in memoria sul server;
- lo **stato** del gioco viene riletto al massimo ogni 2 minuti (`GAME_STATUS_TTL_SECONDS`): si servono solo
  `draft`, `submitted`, `ai_reviewed`, `changes_requested` e `approved`;
- browser e CDN tengono la risposta 60 secondi (`GAME_CDN_SECONDS`), senza servire copie scadute.

Un gioco **rimosso, rifiutato o cancellato smette di essere servito entro circa 4 minuti**, senza bisogno di
chiamate al momento della rimozione (verificato dal test "a removed, rejected or deleted game stops being served").

**Letture Firestore**: al massimo 1 lettura dello stato per gioco ogni 2 minuti per istanza del server, solo
mentre il gioco viene giocato, più 1 lettura per versione quando un'istanza la carica la prima volta. Un gioco
giocato senza sosta tutto il giorno costa nel caso peggiore circa 30-90 letture l'ora (dipende da quante istanze
Vercel usa); nel test con le famiglie restano poche migliaia di letture al giorno, sotto le 50.000 gratuite.

Un gioco in bozza si vede solo con il suo indirizzo, che contiene identificativi casuali, e solo dentro il sito Zukka.

## Cancellazione dell'account

Per ora cancellare l'account cancella anche **tutti i giochi del genitore, pubblicati compresi** (scritto nelle regole
della community e nella schermata di conferma).
