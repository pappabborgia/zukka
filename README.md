# Zukka

Giochi didattici per bambini di 6-9 anni, creati dai genitori con l'aiuto dell'AI.

**Stato: Fase 1** (formato dei giochi, eventi, sandbox, School Cup come primo gioco).

## Struttura

| Cartella | Cosa contiene |
|---|---|
| `apps/web` | il sito Zukka (catalogo, pagina di gioco, verifica sandbox) |
| `apps/play` | il sito separato che serve i giochi (`/g/<id>`) |
| `packages/game-protocol` | eventi dei giochi, validazione, header di sicurezza |
| `games/` | giochi inclusi: `school-cup` e due giochi sonda per i test |
| `docs/` | formato dei giochi e isolamento |

## Provare in locale

Serve Node.js 20 o più recente.

```bash
npm install
npm run dev
```

- Sito: http://localhost:3000
- Gioco con il registro degli eventi: http://localhost:3000/play/school-cup?debug=1
- Verifica della sandbox: http://localhost:3000/dev/sandbox-check
- Giochi (sito separato): http://127.0.0.1:3001/g/school-cup

Test:

```bash
npm test                       # test unitari
npm run check:school-cup       # tutte le domande di School Cup
npm run build && npx playwright test   # sandbox e partita completa nel browser
```

## Deploy su Vercel (due progetti dallo stesso repository)

| Progetto | Root Directory | Variabile d'ambiente |
|---|---|---|
| `zukka` | `apps/web` | `NEXT_PUBLIC_PLAY_ORIGIN=https://zukka-play.vercel.app` |
| `zukka-play` | `apps/play` | `MAIN_ORIGINS=https://zukka-gules.vercel.app` |

I file `apps/*/vercel.json` impostano già installazione e build.

Indirizzi attuali: sito https://zukka-gules.vercel.app (il nome `zukka.vercel.app` era già di un altro sito), giochi https://zukka-play.vercel.app.
