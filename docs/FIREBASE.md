# Firebase: come è usato e come configurarlo

## Come è usato

- **Firebase Authentication**: accesso dei genitori con un link via email (senza password).
  - **con Resend configurato** (`RESEND_API_KEY` e `EMAIL_FROM`): il server genera il link con l'Admin SDK
    (`generateSignInWithEmailLink`) e lo spedisce con Resend; il limite di email di Firebase non conta e il link
    porta direttamente a `/auth/finish`;
  - **senza Resend**: l'email la manda Firebase (pochi invii al giorno sul piano gratuito); il link passa da una
    pagina di Firebase e torna su `/auth/finish`. L'accesso si completa dal server (API REST di Firebase):
  nel browser non gira codice Firebase. Dopo l'accesso il server crea un *session cookie* Firebase (`httpOnly`, 14 giorni).
- **Cloud Firestore**: tutti i dati. Le regole (`firebase/firestore.rules`) **negano ogni accesso dal browser**:
  leggono e scrivono solo le route del server con l'Admin SDK, che controllano sempre l'account dalla sessione.

```
accounts/{uid}                  consenso (data, versione), hash del PIN, nickname da creatore. Niente email.
accounts/{uid}/consents/{id}    storico dei consensi accettati
accounts/{uid}/players/{pid}    profili dei figli: nickname dalle liste, avatar, anno, scelta classifiche
nicknames/{key}                 prenotazione: nickname dei bambini unici
creatorNicknames/{key}          prenotazione: nickname da creatore unici
rateLimits/{hash}               contatori anti-abuso (chiavi cifrate con hash, nessuna email o IP in chiaro)
```

## In locale: niente progetto, solo emulatori

Serve Java 11 o più recente.

```bash
npm run dev:emu
```

Avvia gli emulatori di Auth e Firestore e i due siti. Le email non partono: dopo "Email me a sign-in link" la
pagina mostra direttamente il link ("Local development").

Test: `npm run test:emu` (dati e regole) e `npm run e2e` (browser).

## In produzione: cosa configurare (una volta)

1. **Crea il progetto** su https://console.firebase.google.com: nome `zukka`. **Disattiva Google Analytics**
   (niente strumenti di tracciamento).
2. **Authentication** → Get started → Sign-in method → **Email/Password** → attiva anche
   **Email link (passwordless sign-in)** → Save.
3. **Authentication** → Settings → **Authorized domains** → aggiungi `zukka-gules.vercel.app`.
4. **Firestore Database** → Create database → edizione Standard → posizione **eur3 (Europe)** →
   **Start in production mode**. Le regole di partenza negano già tutto, come le nostre.
5. (Niente TTL: sul piano gratuito non c'è. I contatori scaduti li cancella il job notturno
   `/api/cron/nightly`, e il conteggio li ignora comunque.)
6. **Project settings** → General: copia il **Project ID** e la **Web API Key**.
7. **Project settings** → Service accounts → **Generate new private key**: scarica il file JSON.
   È una chiave segreta: non mandarla in chat e non metterla nel repository.
8. Su **Vercel**, progetto `zukka` → Settings → Environment Variables (ambiente Production):

| Variabile | Valore |
|---|---|
| `FIREBASE_PROJECT_ID` | il Project ID |
| `FIREBASE_API_KEY` | la Web API Key |
| `FIREBASE_CLIENT_EMAIL` | `client_email` dal file JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` dal file JSON, così com'è (con i `\n`), segnala come **Sensitive** |
| `SESSION_SECRET` | almeno 32 caratteri casuali, **Sensitive** |
| `APP_ORIGIN` | `https://zukka-gules.vercel.app` |
| `CRON_SECRET` | almeno 16 caratteri casuali, **Sensitive** (Vercel lo usa per chiamare il job notturno) |
| `RESEND_API_KEY` | facoltativa: chiave API di Resend, **Sensitive**. Senza, le email le manda Firebase |
| `EMAIL_FROM` | facoltativa (serve con Resend): mittente su un dominio verificato |
| `EMAIL_REPLY_TO` | facoltativa: indirizzo per le risposte |

Poi **Redeploy** del progetto `zukka`.

## Email di accesso (Resend)

1. Crea un account su https://resend.com e una **API key** con permesso "Sending access".
2. **Domains** → aggiungi un dominio tuo e inserisci nel DNS i record che Resend indica (SPF, DKIM).
   Senza dominio verificato Resend spedisce solo all'indirizzo del proprietario dell'account: va bene per una
   prova, non per le famiglie.
3. Lascia disattivati open e click tracking (sono disattivati di default).
4. Su Vercel imposta `RESEND_API_KEY`, `EMAIL_FROM` ed eventualmente `EMAIL_REPLY_TO`.

In locale, con gli emulatori e senza chiave Resend, l'email non parte e il link compare nella pagina
"Check your email". Fuori dagli emulatori il link non viene mai mostrato a schermo.

## Job notturno

`apps/web/vercel.json` chiama ogni notte (03:17 UTC) `/api/cron/nightly` con `Authorization: Bearer <CRON_SECRET>`.
Oggi cancella i contatori anti-abuso scaduti; nelle fasi 7-9 ricalcolerà punteggi e controlli.
Senza `CRON_SECRET` la route risponde sempre 401.

## Web API Key

La chiave API web di Firebase non è un segreto (identifica il progetto), ma conviene limitarla:
Google Cloud Console → APIs & Services → **Credentials** → la chiave del progetto →
**API restrictions** → "Restrict key" → solo **Identity Toolkit API** → Save.
Non usare restrizioni per sito (HTTP referrer) o per IP: la chiave la usa solo il server di Vercel, che non manda
un referrer e non ha un IP fisso, e quelle restrizioni bloccherebbero l'accesso.
