# Zukka

Giochi didattici per bambini di 6-9 anni, creati dai genitori con l'aiuto dell'AI.

**Stato: Fase 3** (Studio: giochi da un modello, School Cup configurabile, domande AI). Fasi 1-2: formato dei giochi, sandbox, account, profili, area genitore.

## Struttura

| Cartella | Cosa contiene |
|---|---|
| `apps/web` | il sito Zukka (catalogo, pagina di gioco, verifica sandbox) |
| `apps/play` | il sito separato che serve i giochi (`/g/<id>`) |
| `packages/game-protocol` | eventi dei giochi, validazione, header di sicurezza |
| `engines/` | motori dei giochi: `school-cup` e `starfish-race` (ex Corsa a Barcellona), ognuno con la sua configurazione |
| `packages/engines` | schemi delle configurazioni, argomenti, creazione rapida |
| `games/` | giochi del catalogo (da un motore o HTML) e due giochi sonda per i test |
| `docs/` | formato dei giochi, isolamento, Firebase, controlli della revisione |
| `firebase/` | regole di Firestore |

## Provare in locale

Servono Node.js 20+ e Java 11+ (per gli emulatori Firebase).

```bash
npm install
npm run dev:emu
```

Gli emulatori sostituiscono Firebase: non serve nessun progetto. Le email non partono, il link di accesso
compare direttamente nella pagina.

- Sito: http://localhost:3000
- Gioco con il registro degli eventi: http://localhost:3000/play/school-cup?debug=1
- Verifica della sandbox: http://localhost:3000/dev/sandbox-check
- Giochi (sito separato): http://127.0.0.1:3001/g/school-cup

Test:

```bash
npm test                       # test unitari
npm run test:emu               # dati, regole e accesso, sugli emulatori
npm run check:school-cup       # tutte le domande di School Cup
npm run build && npm run e2e   # account, sandbox e partite nel browser
```

## Deploy su Vercel (due progetti dallo stesso repository)

| Progetto | Root Directory | Variabile d'ambiente |
|---|---|---|
| `zukka` | `apps/web` | `NEXT_PUBLIC_PLAY_ORIGIN=https://zukka-play.vercel.app` e le variabili Firebase (vedi `docs/FIREBASE.md`) |
| `zukka-play` | `apps/play` | `MAIN_ORIGINS=https://zukka-gules.vercel.app` |

I file `apps/*/vercel.json` impostano già installazione e build.

Indirizzi attuali: sito https://zukka-gules.vercel.app (il nome `zukka.vercel.app` era già di un altro sito), giochi https://zukka-play.vercel.app.
