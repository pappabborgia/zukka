# Review checklist (input for the AI review, phase 5)

The AI review turns each item into a check with a score, problems by severity (blocking, important, minor)
and a concrete fix. The AI only recommends; a person decides. A blocking problem prevents approval.

## Technical

- **Blocking**: any attempt to reach the network (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon`, `RTCPeerConnection`, external `src`/`href`, `import()`), storage (`localStorage`, `sessionStorage`,
  `indexedDB`, `document.cookie`), `eval`/`new Function`/string timers, obfuscated or minified code that cannot be read,
  links, forms, `window.open`, attempts to navigate `top` or its own frame.
- **Blocking**: collection of personal data (asks for name, age, school, photo, voice, location).
- **Blocking**: `answer` events that report a wrong answer as correct, or `game_completed` totals that do not match
  the `answer` events sent in the play.
- **Blocking**: self-checked exercises (the child judges their own answer) that send `answer` events or are counted
  in `game_completed`.
- **Important**: fewer than 80% of the questions in a play checked by the game, or fewer than 5 counted answers
  in a completed play; `total` outside the `answers.min`–`answers.max` declared in `meta.json`.
- **Important**: speech from voices that are not local (`localService !== true`); listening parts not hidden
  when there is no local voice.
- Headless run: loads with no console errors, reacts to the first inputs, never stays on an empty screen,
  works with touch and mouse at phone and desktop sizes.

## Content

- Language and themes unsuitable for 6 to 9 year olds; violence; fear; real brands, clubs or characters;
  personal data of children.

## Learning value

- Matches the declared subject, year and topics; questions and answers are correct (maths answers computed by code).
- Enough questions, varied, not repetitive; good balance of play time and learning time; difficulty goes up.
