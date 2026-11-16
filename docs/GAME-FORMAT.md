# Zukka game format

Every Zukka game is **one self-contained HTML file**.

## Rules

- CSS and JavaScript are inline. No external libraries, images, fonts or sounds.
  Graphics use SVG, canvas or emoji; sounds are generated with Web Audio; fonts, if any, are embedded as `data:` URLs.
- Works with touch and mouse, on phones, tablets and computers.
- A play lasts 5 to 10 minutes at most, gets harder step by step, and gives immediate feedback on each answer.
- Maths answers are computed by code, never typed in by hand.
- No network access of any kind, no storage (`localStorage`, cookies, IndexedDB), no `eval` or `new Function`,
  no links, forms or popups. The browser blocks all of these anyway (see `docs/SANDBOX.md`); a game that tries
  them is rejected in review.
- The game never receives data about the player (no name, nickname or anything else).
- All text is in English (British spelling) for now.

## Events

The game talks to the page around it only with `postMessage` to `window.parent`, and only with these three messages:

| Event | Message | When |
|---|---|---|
| `game_started` | `{protocol:'zukka/1', event:'game_started'}` | a play begins |
| `answer` | `{protocol:'zukka/1', event:'answer', data:{correct:true\|false}}` | after every answer of the player |
| `game_completed` | `{protocol:'zukka/1', event:'game_completed', data:{correct:N, total:M}}` | the play ends normally |

Copy this snippet into the game (it is also exported as `GAME_SDK_SNIPPET` by `@zukka/game-protocol`):

```js
const Zukka = (() => {
  const post = (event, data) => { try{ if(window.parent && window.parent!==window) window.parent.postMessage(data ? {protocol:'zukka/1', event, data} : {protocol:'zukka/1', event}, '*'); }catch(e){} };
  return {
    started:   () => post('game_started'),
    answer:    ok => post('answer', {correct: ok===true}),
    completed: (correct, total) => post('game_completed', {correct, total})
  };
})();
```

Rules for the events:

- `total` must equal the number of `answer` events sent in that play, and `correct` the number of them with `correct:true`.
  The page counts them too, and flags plays where they differ.
- A wrong answer or a timeout is `correct:false`. Never report a wrong answer as correct.
- If the player quits halfway, do not send `game_completed`. A new `game_started` begins a new play.
- The page measures the time itself and ignores any other field in the messages.
