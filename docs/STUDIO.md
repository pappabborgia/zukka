# Lo Studio (Fase 3)

Lo Studio è nell'area genitore (`/studio`, protetto dal PIN). Un genitore può:

1. **Partire da un modello** (creazione rapida): oggi il motore di School Cup. Sceglie nome del gioco, del torneo
   e della squadra, colori e disegno della maglia, materia, anno e da 1 a 6 argomenti (più le tabelline, se servono).
2. **Fare una sua versione di un gioco del catalogo** ("Make your own version"): stessa cosa, ma il gioco nuovo
   ricorda da quale gioco è partito (`parentGameId`, servirà per i crediti della Fase 9). L'originale non cambia mai.
3. **Descrivere un gioco nuovo** (creazione libera): arriva nella Fase 4.

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

Il sito dei giochi serve una versione da `/v/{gameId}/{versionId}`: legge Firestore con un service account **di sola
lettura** e risponde con una cache di un anno (le versioni non cambiano), quindi Firestore viene letto una volta per
versione, non per ogni partita. Un gioco in bozza si vede solo con il suo indirizzo, che contiene identificativi
casuali, e solo dentro il sito Zukka.
