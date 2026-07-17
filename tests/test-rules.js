// 測試 3：規則細節定點驗證
const { createGame, trackQuestions, $, visible, click } = require('./harness');

// 讓玩家停在指定格並跑完該格流程，機器人依 correct 決定答對/答錯
async function landOn(ctx, playerIdx, tileIdx, correct) {
  const win = ctx.win, g = win.game;
  g.currentPlayerIndex = playerIdx;
  g.players[playerIdx].position = tileIdx;
  const p = g.resolveTile(g.players[playerIdx]);
  for (let t = 0; t < 200; t++) {
    await new Promise(r => setTimeout(r, 0));
    if (visible($(win, 'modal-question')) && visible($(win, 'btn-answer-submit')) && !$(win, 'question-input').disabled) {
      const qs = win.__questions, q = qs[qs.length - 1];
      $(win, 'question-input').value = String(correct ? q.answer : q.answer + 1);
      click($(win, 'btn-answer-submit'));
    } else if (visible($(win, 'modal-question')) && visible($(win, 'btn-question-continue'))) {
      click($(win, 'btn-question-continue'));
    }
  }
  await p;
}

function newGame() {
  const ctx = createGame();
  trackQuestions(ctx);
  click($(ctx.win, 'btn-start'));
  click($(ctx.win, 'btn-setup-confirm'));
  ctx.win.game.busy = true; // 停掉自動流程，改用 landOn 手動驅動
  return ctx;
}

(async () => {
  const ADDSUB = 2; // 第2格是加減法地產格($200)

  // --- 案例1：答錯無主地，有任何金錢懲罰嗎？---
  {
    const ctx = newGame(), g = ctx.win.game;
    const before = g.players[0].money;
    await landOn(ctx, 0, ADDSUB, false);
    console.log(`案例1 答錯無主地：現金 ${before} → ${g.players[0].money}（差 ${g.players[0].money - before}），地主=${g.properties[ADDSUB].owner}`);
  }

  // --- 案例2：答對買地 ---
  {
    const ctx = newGame(), g = ctx.win.game;
    const before = g.players[0].money;
    await landOn(ctx, 0, ADDSUB, true);
    const pr = g.properties[ADDSUB];
    console.log(`案例2 答對買地：現金 ${before} → ${g.players[0].money}，地主=${pr.owner} Lv${pr.level}，總資產=${g.netWorth(g.players[0])}`);
  }

  // --- 案例3：現金不足時付過路費會不會欠債／地主憑空生錢 ---
  {
    const ctx = newGame(), g = ctx.win.game;
    g.properties[ADDSUB].owner = 1; g.properties[ADDSUB].level = 3; // 對手滿級地，租金 $150
    g.players[0].money = 10;   // 玩家0快破產
    const ownerBefore = g.players[1].money;
    await landOn(ctx, 0, ADDSUB, false);
    const rent = Math.round(200 * 0.25 * 3);
    console.log(`案例3 破產付租金：租金應為 $${rent}｜付款方 10 → ${g.players[0].money}（實付 ${10 - g.players[0].money}）｜地主 ${ownerBefore} → ${g.players[1].money}（實收 ${g.players[1].money - ownerBefore}）`);
  }

  // --- 案例4：幸運「對手繳稅給你」有轉移金錢嗎？---
  {
    const ctx = newGame(), g = ctx.win.game;
    ctx.inject('window.__lucky = LUCKY_EVENTS;');
    const tax = ctx.win.__lucky.find(e => e.text.includes('繳稅'));
    const p0 = g.players[0], p1 = g.players[1];
    const m0 = p0.money, m1 = p1.money;
    const effect = tax.apply(p0, p1);
    console.log(`案例4 幸運事件「${tax.text}」`);
    console.log(`      我方現金 ${m0} → ${p0.money}｜對手現金 ${m1} → ${p1.money}｜效果=${JSON.stringify(effect)}`);
  }

  // --- 案例5：題庫答案是否都是整數、非負 ---
  {
    const ctx = createGame();
    const win = ctx.win;
    const bad = [];
    for (const diff of ['easy', 'middle', 'hard']) {
      ctx.inject(`window.__qb = new QuestionBank('${diff}');`);
      const qb = win.__qb;
      for (const cat of ['addsub', 'mult', 'div', 'word']) {
        for (let i = 0; i < 500; i++) {
          const q = qb.getQuestion(cat);
          if (!Number.isInteger(q.answer) || q.answer < 0) bad.push(`${diff}/${cat}: ${JSON.stringify(q.text)} → ${q.answer}`);
        }
      }
    }
    console.log(`案例5 題庫 6000 題答案檢查：${bad.length ? '❌ 有問題\n' + bad.slice(0, 5).join('\n') : '✅ 全部為非負整數'}`);
  }
  process.exit(0);
})();
