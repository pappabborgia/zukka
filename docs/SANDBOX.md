# Come sono isolati i giochi

Ogni gioco è codice HTML e JavaScript che non controlliamo del tutto (in futuro sarà scritto dall'AI). Per questo
gira sempre in una "scatola" da cui non può uscire. Le protezioni sono quattro, una sopra l'altra.

## 1. Un sito diverso

I giochi sono serviti da un progetto Vercel separato (`zukka-play.vercel.app`), mentre il sito è su
`zukka.vercel.app`. `vercel.app` è nella Public Suffix List, quindi per il browser sono **due siti distinti**,
come se fossero due domini comprati separatamente: cookie, sessione e storage del sito principale non sono mai
raggiungibili dal sito dei giochi. In locale: `localhost:3000` (sito) e `127.0.0.1:3001` (giochi).

## 2. Iframe con sandbox

La pagina `/play/[slug]` mostra il gioco in un iframe con `sandbox="allow-scripts"` e nient'altro.
Senza `allow-same-origin` il gioco ha un'origine "opaca" (`null`): niente cookie, `localStorage`, IndexedDB,
nessun accesso alla pagina che lo contiene. Senza `allow-popups`, `allow-forms`, `allow-top-navigation` e
`allow-downloads` non può aprire finestre, inviare moduli, cambiare la pagina principale o scaricare file.

## 3. Content Security Policy del gioco

Il server dei giochi (`apps/play/src/app/g/[id]/route.ts`) risponde con questi header
(definiti in `packages/game-protocol/src/headers.ts`):

```
Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
  img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none';
  base-uri 'none'; manifest-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none';
  frame-ancestors https://zukka.vercel.app; sandbox allow-scripts
Permissions-Policy: camera=(), microphone=(), geolocation=(), ...
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```

- Nessuna richiesta di rete: niente `fetch`, XHR, WebSocket, immagini, script, font o fogli di stile esterni.
- Niente `eval` né `new Function` (manca `'unsafe-eval'`): rende più difficile il codice offuscato.
- `sandbox allow-scripts` ripete la sandbox anche se qualcuno apre l'indirizzo del gioco direttamente.
- `frame-ancestors`: solo il sito Zukka può mostrare i giochi in un iframe.

## 4. Content Security Policy del sito

Il sito principale (`apps/web/next.config.ts`) ha `frame-src` limitato al sito dei giochi. Il browser applica
questa regola anche quando è il gioco stesso a provare a spostare il suo iframe su un altro sito: la navigazione
viene bloccata. Lo verifica il test "a game cannot navigate its own frame to another website".

## I messaggi

La pagina accetta un messaggio solo se arriva dal suo iframe (`event.source`) **e** ha origine `"null"`.
Se l'origine non fosse `"null"`, la sandbox non sarebbe attiva e il messaggio viene scartato.
Poi lo valida con Zod: solo i tre eventi, con i tipi giusti; ogni altro campo viene eliminato.
Limite di 20 messaggi al secondo e 500 risposte per partita. La durata la misura la pagina, non il gioco.
Codice: `packages/game-protocol/src/messages.ts` e `session.ts`, test in `packages/game-protocol/test`.

## Limiti noti (da sapere)

- **WebRTC**: nessun browser permette di bloccarlo con la CSP. Un gioco potrebbe aprire una connessione verso
  un server esterno. Non ha dati personali da inviare (il gioco non ne riceve), ma il server vedrebbe l'indirizzo
  IP. Mitigazione: la revisione (Fase 5) cerca `RTCPeerConnection` e codice simile e lo blocca.
- **Eventi falsificabili**: gli eventi partono dal browser. Un adulto esperto può inviarne di falsi dalla console.
  Mitigazione nelle fasi 8 e 9: limiti giornalieri, controllo della durata e del totale, vista anti-abuso.

## Come verificarlo

1. **Test automatici**: `npm run build && npx playwright test`. I test in `tests/e2e/sandbox.spec.ts` caricano
   un "gioco sonda" che prova a fare tutto ciò che è vietato e controllano che nessuna richiesta lasci la sandbox
   (con un test di controllo che dimostra che la trappola di rete funziona davvero).
2. **A mano**: apri `/dev/sandbox-check`. Ogni riga deve avere ✅ (la riga ℹ️ su WebRTC è il limite noto).
   Con DevTools aperto, scheda Network: nessuna richiesta riuscita verso `example.com`; le richieste bloccate
   compaiono come `(blocked:csp)`. Nella Console vedrai gli errori della Content Security Policy: sono i blocchi
   che funzionano.
3. **Header**: apri l'indirizzo di un gioco, per esempio `https://zukka-play.vercel.app/g/school-cup`, e in
   DevTools > Network > Headers controlla `Content-Security-Policy`. Oppure:
   `curl -sI https://zukka-play.vercel.app/g/school-cup`
