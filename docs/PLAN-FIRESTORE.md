# Fasi 7-9 su Firestore

Firestore non fa `SUM`, `GROUP BY` o `JOIN` come Postgres. La regola generale:

- **i registri sono la fonte di verità**: righe che si aggiungono e non si modificano mai;
- **i totali sono "riassunti"**, aggiornati **nella stessa transazione** che scrive la riga del registro, quindi
  non possono divergere;
- un **controllo di riconciliazione** ricalcola i totali dal registro (aggregazione `sum()` di Firestore) e segnala
  ogni differenza.

Tutte le scritture passano dalle route del server (Admin SDK). Le regole di Firestore restano "nega tutto".

## Dati

```
plays/{playId}                      partita: gioco, giocatore, account, inizio/fine (orologio del server),
                                    corrette, totale, punteggio, flag anti-abuso, ipHash
pointsLedger/{id}                   giocatore, account, gioco, tipo (completed, correct, accuracy, first,
                                    record, reversal), importo, playId, monthKey, createdAt
creditLedger/{id}                   creatore, gioco, tipo, importo, riferimento (play/rating/favourite/report),
                                    monthKey, createdAt
playerStats/{pid}                   totale punti, punti per mese, partite, tempo, ultimo giorno
dailyCounters/{date}_{pid}_{game}   partite che contano oggi (max 3 per i punti, max 1 per i crediti)
leaderboards/players_all/entries/{pid}            solo nickname, avatar, anno, punti
leaderboards/players_{YYYY-MM}/entries/{pid}      come sopra, per il mese
leaderboards/creators_all|creators_{YYYY-MM}/entries/{uid}   nickname creatore, crediti
gameBest/{gameId}/entries/{pid}     miglior punteggio di ogni giocatore su quel gioco
games/{gameId}                      contatori: partite, preferiti, numero voti, somma voti, punteggio bayesiano
ratings/{gameId}_{pid}              un voto per giocatore per gioco (l'ID impedisce i doppioni)
favourites/{gameId}_{pid}           idem per i preferiti
stats/global                        media globale dei voti (per la media bayesiana)
abuse/{date}_{kind}_{key}           anomalie trovate dal controllo notturno
```

Nelle classifiche pubbliche c'è un documento per giocatore **solo se il genitore ha scelto di mostrarlo**: se
cambia idea, la riga viene tolta subito. Le righe non contengono l'ID dell'account.

## Come funziona

**Fine partita (fase 7-8).** Una sola transazione:
1. legge `dailyCounters`, `playerStats` e `gameBest`;
2. calcola i punti con la formula del file di configurazione (validità, durata minima, totale coerente con
   `answers.min/max` del gioco, massimo 3 partite al giorno per giocatore e gioco);
3. scrive la partita, le righe del registro punti, i totali, le due righe di classifica (sempre e mese) e il
   record sul gioco;
4. aggiunge i crediti del creatore, solo se il giocatore non è dello stesso account e solo la prima partita del giorno.

Sono circa 10-12 scritture per partita.

**Classifiche.**
- I primi 50 si leggono con una query ordinata per punti, con un indice composto per il filtro per anno.
- La posizione del giocatore corrente si ottiene con un `count()` dei punteggi più alti del suo: costa 1 lettura
  ogni 1.000 voci.
- La classifica del mese è una collezione separata per mese: niente calcoli a fine mese, la vecchia resta come storico.
- Classifica di un gioco: primi 20 di `gameBest` più `count()` per la posizione.

**Voti e media bayesiana.**
- Il voto è un documento con ID fisso giocatore+gioco. Cambiarlo aggiorna `numero voti` e `somma voti` sul gioco
  con la differenza, nella stessa transazione, insieme alla riga di crediti (o alla sua correzione).
- `punteggio = (C·m + somma) / (C + n)`, con `C` nel file di configurazione e `m` = media globale.
- Il punteggio si salva sul gioco, così il catalogo si ordina con una query. Un controllo notturno ricalcola `m`
  e i punteggi di tutti i giochi (pochi documenti).

**Preferiti.** Come i voti: un documento per coppia, contatore sul gioco, ±5 crediti al creatore.

**Correzioni e annullamenti (fase 9).**
- Nessuna riga si cancella. Si aggiunge una riga `reversal` con importo opposto che rimanda all'originale, e si
  aggiornano i totali nella stessa transazione.
- Per i bambini il totale mostrato non scende mai sotto zero.
- Gioco tolto dal catalogo: una transazione per blocchi annulla tutti i crediti generati da quel gioco.

**Vista anti-abuso (fase 9).** Due livelli:
1. **subito, a ogni partita**: flag su durata troppo breve, totale fuori dai limiti, differenza tra eventi e
   totale dichiarato, troppe partite. Le partite segnalate non danno punti.
2. **ogni notte** (Vercel Cron, una volta al giorno sul piano gratuito): calcola le anomalie del giorno, come
   giocatori, creatori o indirizzi IP (solo hash) con troppe partite, voti o preferiti, oppure giochi con picchi
   strani, e le scrive in `abuse/`.

La pagina admin legge `abuse/` e le partite con flag, e può annullare punti e crediti con le righe `reversal`.

**Contatori molto usati.** Un documento Firestore regge circa una scrittura al secondo in modo continuativo.
Per i contatori di un gioco popolare useremo, se servirà, contatori divisi su più documenti. Alla nostra scala
iniziale non serve.

## Quote gratuite di Firestore

Valgono anche sul piano a consumo: 50.000 letture, 20.000 scritture e 20.000 cancellazioni al giorno, 1 GiB di dati.

**Stima per bambino attivo al giorno** (5 partite):
- **scritture:** 5 × ~12 = 60, più voti e preferiti, quindi circa **70**;
- **letture:** pagine di gioco con classifica (top 20 più posizione), catalogo e classifica globale (top 50).
  Senza cache circa **200-300**; con una cache di 60 secondi lato server su catalogo e classifiche, condivisa da
  tutti, circa **40-60**.

**Soglie, con la cache:**
- scritture: circa **280 bambini attivi al giorno**;
- letture: circa **800-1.000 bambini attivi al giorno**.

**Durante il test con le famiglie (decine di bambini) restiamo nelle quote gratuite.** Superate le soglie si passa
al piano Blaze, con una spesa molto bassa a quei numeri. Imposteremo un avviso di budget su Google Cloud e una
pagina admin con le letture e scritture del giorno.
