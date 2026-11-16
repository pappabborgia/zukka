/**
 * The snippet every Zukka game includes (inline). It is the only channel between
 * the game and the page: three events, sent to the parent window, nothing received back.
 */
export const GAME_SDK_SNIPPET = `const Zukka = (() => {
  const post = (event, data) => { try{ if(window.parent && window.parent!==window) window.parent.postMessage(data ? {protocol:'zukka/1', event, data} : {protocol:'zukka/1', event}, '*'); }catch(e){} };
  return {
    started:   () => post('game_started'),
    answer:    ok => post('answer', {correct: ok===true}),
    completed: (correct, total) => post('game_completed', {correct, total})
  };
})();`;
