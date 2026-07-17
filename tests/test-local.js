// 測試 1：本機雙人模式，機器人玩到結束
const { createGame, trackQuestions, runBot, $, click } = require('./harness');

async function playOne(difficulty, accuracy) {
  const ctx = createGame();
  const win = ctx.win;
  trackQuestions(ctx);

  click($(win, 'btn-difficulty'));
  const opt = win.document.querySelector(`.diff-option[data-difficulty="${difficulty}"]`);
  click(opt);
  click($(win, 'btn-difficulty-back'));

  click($(win, 'btn-start'));
  $(win, 'input-player1').value = '小明';
  $(win, 'input-player2').value = '小華';
  click($(win, 'btn-setup-confirm'));

  const result = await runBot(ctx, { accuracy });
  const g = win.game;
  return {
    difficulty, accuracy, result,
    round: g.round,
    positions: g.players.map(p => p.position),
    money: g.players.map(p => p.money),
    netWorth: g.players.map(p => g.netWorth(p)),
    stats: g.players.map(p => ({ ...p.stats })),
    endTitle: $(win, 'end-title').textContent,
    endWinner: $(win, 'end-winner').textContent,
    owned: Object.values(g.properties).filter(p => p.owner !== null).length,
    errors: ctx.errors,
    rejections: win.__rejections,
    questions: win.__questions.length,
  };
}

(async () => {
  for (const [diff, acc] of [['easy', 1], ['middle', 0.5], ['hard', 0]]) {
    const r = await playOne(diff, acc);
    console.log(`\n=== ${diff} / 答對率${acc * 100}% ===`);
    console.log(`結果:${r.result} 回合:${r.round} 位置:${r.positions} 現金:${r.money} 總資產:${r.netWorth}`);
    console.log(`買地數:${r.owned} 出題數:${r.questions} 統計:${JSON.stringify(r.stats)}`);
    console.log(`結算: ${r.endTitle} | ${r.endWinner}`);
    if (r.errors.length) console.log('!! ERRORS:', r.errors);
    if (r.rejections.length) console.log('!! REJECTIONS:', r.rejections);
  }
  process.exit(0);
})();
