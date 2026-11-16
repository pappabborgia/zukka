# Firebase: come è usato e come configurarlo

## Come è usato

- **Firebase Authentication**: accesso dei genitori con un link via email (senza password).
  Il link viene richiesto e completato **dal server** tramite l'API REST di Firebase: nel browser non gira codice
  Firebase. Dopo l'accesso il server crea un *session cookie* Firebase (`httpOnly`, 14 giorni).
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
5. Facoltativo ma consigliato: Firestore → **TTL** → nuova policy sulla collezione `rateLimits`, campo `expiresAt`
   (cancella da sola i contatori scaduti).
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

Poi **Redeploy** del progetto `zukka`.

## Email di accesso

Per ora le invia Firebase (mittente `noreply@<progetto>.firebaseapp.com`). Il piano gratuito ha un limite
giornaliero di email: prima del test con le famiglie passiamo a Resend. Il server genererà il link con
l'Admin SDK (`generateSignInWithEmailLink`) e lo invierà con Resend; il resto del flusso non cambia.
