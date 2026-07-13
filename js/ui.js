// UI 顯示層：畫面切換、棋盤繪製、玩家面板更新、動畫特效
class UI {
  constructor() {
    this.screens = document.querySelectorAll('.screen');
    this.boardEl = document.getElementById('board');
    this.diceEl = document.getElementById('dice');
    this.eventLogEl = document.getElementById('event-log');
  }

  showScreen(id) {
    this.screens.forEach(s => s.classList.toggle('active', s.id === id));
  }

  // 繪製棋盤格子：沿方形外圈排列（像大富翁一樣繞圈圈），中間留空
  renderBoard(board) {
    this.boardEl.innerHTML = '';
    const ringLen = board.ringLen;
    this.boardEl.style.gridTemplateColumns = `repeat(${ringLen}, 1fr)`;
    this.boardEl.style.gridTemplateRows = `repeat(${ringLen}, 1fr)`;

    board.tiles.forEach((type, idx) => {
      const meta = TILE_META[type];
      const { row, col } = board.gridPosition(idx);
      const tile = document.createElement('div');
      tile.className = `tile ${meta.cls}`;
      tile.id = `tile-${idx}`;
      tile.title = meta.label;
      tile.style.gridRow = row;
      tile.style.gridColumn = col;
      tile.innerHTML = `
        <span class="tile-idx">${idx}</span>
        <span class="tile-icon">${meta.icon}</span>
        <div class="tile-tokens" id="tile-tokens-${idx}"></div>
      `;
      this.boardEl.appendChild(tile);
    });

    // 中間留空的裝飾區塊
    const center = document.createElement('div');
    center.className = 'board-center';
    center.style.gridRow = `2 / ${ringLen}`;
    center.style.gridColumn = `2 / ${ringLen}`;
    center.innerHTML = `<span>💰 財富<br>大富翁</span>`;
    this.boardEl.appendChild(center);
  }

  // 依玩家目前位置，重新擺放棋子圖示
  renderTokens(players) {
    document.querySelectorAll('.tile-tokens').forEach(el => (el.innerHTML = ''));
    players.forEach(p => {
      const slot = document.getElementById(`tile-tokens-${p.position}`);
      if (slot) {
        const span = document.createElement('span');
        span.textContent = p.token;
        slot.appendChild(span);
      }
    });
  }

  glowTile(index) {
    const tile = document.getElementById(`tile-${index}`);
    if (!tile) return;
    tile.classList.remove('glow');
    void tile.offsetWidth; // 強制 reflow 讓動畫可重新觸發
    tile.classList.add('glow');
  }

  // 更新左側玩家資訊卡與排行榜
  updatePlayerCards(players, currentIndex) {
    players.forEach((p, i) => {
      const card = document.getElementById(`player-card-${i}`);
      card.querySelector('.name-text').textContent = p.name;
      card.querySelector('.pos').textContent = p.position;
      card.querySelector('.money-val').textContent = p.formattedMoney();
      card.querySelector('.player-status').textContent = p.skipTurn ? '😵 下回合暫停' : '';
      card.classList.toggle('active-turn', i === currentIndex);
    });
    this.updateLeaderboard(players);
  }

  updateLeaderboard(players) {
    const list = document.getElementById('leaderboard-list');
    const sorted = [...players].sort((a, b) => b.money - a.money);
    list.innerHTML = sorted.map(p => `<li>${p.token} ${p.name}：${p.formattedMoney()}</li>`).join('');
  }

  updateRoundInfo(round, maxRounds, currentPlayer) {
    document.getElementById('round-num').textContent = round;
    document.getElementById('turn-indicator').innerHTML = `輪到 <b>${currentPlayer.token} ${currentPlayer.name}</b>`;
  }

  // 擲骰按鈕啟用狀態
  setRollButton(enabled) {
    const btn = document.getElementById('btn-roll');
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '0.5';
  }

  // 直接把骰子停在指定點數（訪客端同步用）
  setDiceFace(value) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    if (value >= 1 && value <= 6) this.diceEl.textContent = faces[value - 1];
  }

  // 難度頁高亮目前選擇
  highlightDifficulty(difficulty) {
    document.querySelectorAll('.diff-option').forEach(b =>
      b.classList.toggle('selected', b.dataset.difficulty === difficulty));
  }

  // 線上連線狀態列
  setNetStatus(text, ok) {
    const el = document.getElementById('net-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('net-ok', !!ok);
    el.classList.toggle('net-bad', text && !ok);
  }

  logEvent(text) {
    const div = document.createElement('div');
    div.textContent = text;
    this.eventLogEl.prepend(div);
    while (this.eventLogEl.children.length > 30) this.eventLogEl.removeChild(this.eventLogEl.lastChild);
  }

  // 骰子滾動動畫，結束後停在指定點數
  async rollDiceAnimation(finalValue) {
    const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    this.diceEl.classList.add('rolling');
    for (let i = 0; i < 8; i++) {
      this.diceEl.textContent = faces[Math.floor(Math.random() * 6)];
      await UI.wait(60);
    }
    this.diceEl.classList.remove('rolling');
    this.diceEl.textContent = faces[finalValue - 1];
  }

  static wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  spawnCoinDrop() {
    // 答對時彈窗正蓋在畫面上，金幣從彈窗中央上緣灑下，玩家才看得到
    const box = document.querySelector('#modal-question .modal-box');
    const rect = (box && !document.getElementById('modal-question').classList.contains('hidden'))
      ? box.getBoundingClientRect()
      : this.diceEl.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    for (let i = 0; i < 8; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-drop';
      coin.textContent = '🪙';
      coin.style.left = originX + (Math.random() * 120 - 60) + 'px';
      coin.style.top = rect.top + 'px';
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1000);
    }
  }

  spawnFireworks() {
    const container = document.getElementById('fireworks');
    const colors = ['#ff6b6b', '#ffd76b', '#6bceff', '#a8e6cf', '#cbaaff'];
    for (let burst = 0; burst < 5; burst++) {
      setTimeout(() => {
        const cx = 20 + Math.random() * 60;
        const cy = 20 + Math.random() * 40;
        for (let i = 0; i < 14; i++) {
          const p = document.createElement('div');
          p.className = 'firework-particle';
          const angle = (Math.PI * 2 * i) / 14;
          const dist = 60 + Math.random() * 40;
          p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
          p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
          p.style.left = cx + '%';
          p.style.top = cy + '%';
          p.style.background = colors[Math.floor(Math.random() * colors.length)];
          container.appendChild(p);
          setTimeout(() => p.remove(), 1200);
        }
      }, burst * 300);
    }
  }

  // 問答彈窗。editable=false 時為「觀看模式」（對方回合，本端只看不能作答）
  openQuestionModal(category, text, editable = true) {
    const modal = document.getElementById('modal-question');
    document.getElementById('question-tile-title').textContent = `${TILE_META[category].icon} ${TILE_META[category].label}事件`;
    document.getElementById('question-text').textContent = text;
    const input = document.getElementById('question-input');
    input.value = '';
    input.disabled = !editable;
    document.getElementById('question-feedback').className = 'question-feedback hidden';
    const submit = document.getElementById('btn-answer-submit');
    submit.classList.toggle('hidden', !editable);
    document.getElementById('btn-question-continue').classList.add('hidden');
    document.getElementById('question-wait').classList.toggle('hidden', editable);
    modal.classList.remove('hidden');
    if (editable) setTimeout(() => input.focus(), 100);
  }

  showQuestionFeedback(correct, message, editable = true) {
    const fb = document.getElementById('question-feedback');
    fb.textContent = message;
    fb.className = `question-feedback ${correct ? 'correct' : 'wrong'}`;
    document.getElementById('question-input').disabled = true;
    document.getElementById('btn-answer-submit').classList.add('hidden');
    // 只有作答方看到「繼續」；觀看方顯示等待字樣，由主機統一關閉彈窗
    const cont = document.getElementById('btn-question-continue');
    cont.classList.toggle('hidden', !editable);
    document.getElementById('question-wait').classList.toggle('hidden', editable);
    if (editable) setTimeout(() => cont.focus(), 50);
  }

  // 送出後（訪客等待主機判定）鎖定畫面
  lockQuestionAfterSubmit() {
    document.getElementById('question-input').disabled = true;
    document.getElementById('btn-answer-submit').classList.add('hidden');
    document.getElementById('question-wait').textContent = '⏳ 已送出，等待結果…';
    document.getElementById('question-wait').classList.remove('hidden');
  }

  // 空白作答時的溫和提示（不判錯）
  flashAnswerHint(text) {
    const fb = document.getElementById('question-feedback');
    fb.textContent = text;
    fb.className = 'question-feedback hint';
    setTimeout(() => {
      if (fb.classList.contains('hint')) fb.className = 'question-feedback hidden';
    }, 1500);
  }

  closeQuestionModal() {
    document.getElementById('modal-question').classList.add('hidden');
    document.getElementById('question-wait').classList.add('hidden');
  }

  // 幸運／陷阱事件彈窗。editable=false 為觀看模式（由對方按確定）
  openEventModal(title, text, editable = true) {
    document.getElementById('event-title').textContent = title;
    document.getElementById('event-text').textContent = text;
    const ok = document.getElementById('btn-event-ok');
    ok.classList.toggle('hidden', !editable);
    document.getElementById('event-wait').classList.toggle('hidden', editable);
    document.getElementById('modal-event').classList.remove('hidden');
  }

  closeEventModal() {
    document.getElementById('modal-event').classList.add('hidden');
  }

  // 結算畫面（主機算好內容，訪客直接顯示相同內容）
  showEndScreen(title, winnerText, statsHtml) {
    this.showScreen('screen-end');
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-winner').textContent = winnerText;
    document.getElementById('end-stats').innerHTML = statsHtml;
    this.spawnFireworks();
  }
}
