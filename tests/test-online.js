// 測試 2：線上模式（host + guest 兩個視窗），用假的 net 橋接，驗證同步與操作權
const { createGame, trackQuestions, $, visible, click } = require('./harness');

function bridge(hostCtx, guestCtx) {
  // 模擬 PeerJS：一端 send 就送到另一端的 handleNetMessage（含 JSON 序列化，貼近真實傳輸）
  const deliver = (targetGame, msg) => setTimeout(() => targetGame.handleNetMessage(JSON.parse(JSON.stringify(msg))), 0);
  hostCtx.win.game.net = { send: m => deliver(guestCtx.win.game, m), close() {} };
  guestCtx.win.game.net = { send: m => deliver(hostCtx.win.game, m), close() {} };
}

// 兩端各自跑機器人；host 只能操作座位0，guest 只能操作座位1
async function runBoth(hostCtx, guestCtx, { accuracy = 1, maxTicks = 30000 } = {}) {
  const answered = new WeakMap();
  const step = (ctx) => {
    const win = ctx.win;
    if ($(win, 'screen-end').classList.contains('active')) return true;
    const qModal = $(win, 'modal-question');
    const submit = $(win, 'btn-answer-submit');
    const cont = $(win, 'btn-question-continue');
    const roll = $(win, 'btn-roll');

    if (visible(qModal) && visible(submit) && !$(win, 'question-input').disabled) {
      // 題目文字兩端一致，答案從 host 的題庫紀錄取
      const qs = hostCtx.win.__questions;
      const q = qs[qs.length - 1];
      const seen = answered.get(ctx) || -1;
      if (q && qs.length !== seen) {
        answered.set(ctx, qs.length);
        const wrong = Math.random() >= accuracy;
        $(win, 'question-input').value = String(wrong ? q.answer + 1 : q.answer);
        click(submit);
        return false;
      }
    }
    if (visible(qModal) && visible(cont)) { click(cont); return false; }
    if (visible($(win, 'modal-event')) && visible($(win, 'btn-event-ok'))) { click($(win, 'btn-event-ok')); return false; }
    if (!roll.disabled) { click(roll); return false; }
    return false;
  };

  for (let t = 0; t < maxTicks; t++) {
    await new Promise(r => setTimeout(r, 0));
    const hostEnd = step(hostCtx);
    const guestEnd = step(guestCtx);
    if (hostEnd && guestEnd) return 'end';
  }
  return 'timeout';
}

(async () => {
  const hostCtx = createGame();
  const guestCtx = createGame();
  trackQuestions(hostCtx);

  // 直接設定成已連線的 host / guest（PeerJS 牽線本身需要真網路，另外驗）
  hostCtx.win.game.mode = 'host'; hostCtx.win.game.localSeat = 0;
  hostCtx.win.game.onlineGuestName = '學生小華';
  guestCtx.win.game.mode = 'guest'; guestCtx.win.game.localSeat = 1;
  bridge(hostCtx, guestCtx);

  hostCtx.win.game.startGame('老師', '學生小華');
  await new Promise(r => setTimeout(r, 20));

  const gh = hostCtx.win.game, gg = guestCtx.win.game;
  console.log('=== 開局同步 ===');
  console.log('guest 進入遊戲畫面:', $(guestCtx.win, 'screen-game').classList.contains('active'));
  console.log('guest 棋盤格數:', gg.board ? gg.board.size : null, '| guest 玩家:', gg.players.map(p => p.name).join(','));
  console.log('guest 地產數:', Object.keys(gg.properties || {}).length, '| host 地產數:', Object.keys(gh.properties).length);

  const result = await runBoth(hostCtx, guestCtx, { accuracy: 0.7 });
  console.log('\n=== 對戰結果 ===', result);

  const cmp = (label, a, b) => console.log(`${label}: host=${JSON.stringify(a)} guest=${JSON.stringify(b)} ${JSON.stringify(a) === JSON.stringify(b) ? '✅一致' : '❌不一致'}`);
  cmp('位置', gh.players.map(p => p.position), gg.players.map(p => p.position));
  cmp('現金', gh.players.map(p => p.money), gg.players.map(p => p.money));
  cmp('回合', Math.min(gh.round, gh.maxRounds), Number($(guestCtx.win, 'round-num').textContent));
  cmp('地產擁有者', Object.values(gh.properties).map(p => p.owner), Object.values(gg.properties).map(p => p.owner));
  cmp('地產等級', Object.values(gh.properties).map(p => p.level), Object.values(gg.properties).map(p => p.level));
  cmp('結算標題', $(hostCtx.win, 'end-title').textContent, $(guestCtx.win, 'end-title').textContent);
  cmp('結算冠軍', $(hostCtx.win, 'end-winner').textContent, $(guestCtx.win, 'end-winner').textContent);
  console.log('host 統計:', JSON.stringify(gh.players.map(p => p.stats)));
  console.log('host errors:', hostCtx.errors, '| rejections:', hostCtx.win.__rejections);
  console.log('guest errors:', guestCtx.errors, '| rejections:', guestCtx.win.__rejections);
  process.exit(0);
})();
