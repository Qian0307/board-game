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

  // 繪製等距(2.5D)棋盤：草地鋪底 + 外圈道路/事件格 + 建築/樹木裝飾
  renderBoard(board) {
    this.boardEl.innerHTML = '';
    const TW = 60, TH = 30, RING = board.ringLen, offY = 58;
    const iso = (r, c) => ({ x: (c - r) * TW / 2, y: (c + r) * TH / 2 });

    let minX = 1e9, maxX = -1e9, maxY = -1e9;
    for (let r = 0; r < RING; r++) for (let c = 0; c < RING; c++) {
      const p = iso(r, c); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const offX = -minX + TW / 2;
    this.boardEl.style.width = ((maxX - minX) + TW) + 'px';
    this.boardEl.style.height = (maxY + TH + offY + 20) + 'px';
    this._iso = { TW, TH, offX, offY, iso };

    const place = (el, r, c, z) => { const p = iso(r, c); el.style.left = (p.x + offX) + 'px'; el.style.top = (p.y + offY) + 'px'; el.style.zIndex = String(z); };
    const center = (el, r, c, z) => { const p = iso(r, c); el.style.left = (p.x + offX + TW / 2) + 'px'; el.style.top = (p.y + offY + TH / 2) + 'px'; el.style.zIndex = String(z); };
    const propImg = (src, h) => { const d = document.createElement('div'); d.className = 'iso-prop'; const im = document.createElement('img'); im.src = src; im.style.height = h + 'px'; d.appendChild(im); return d; };

    // 1) 草地鋪滿
    for (let r = 0; r < RING; r++) for (let c = 0; c < RING; c++) {
      const g = document.createElement('div');
      g.className = 'grass-cell'; g.style.width = TW + 'px'; g.style.height = TH + 'px';
      place(g, r, c, 100 + r + c); this.boardEl.appendChild(g);
    }

    // 2) 外圈：地產格＝方磚地基+房子/商店；其餘格＝地磚道路(＋起終/幸運陷阱標記)
    const BUILDING = { addsub: 'house', word: 'house', mult: 'shop', div: 'shop' };
    const MARK = { start: '🚩', end: '🏁', lucky: '🎁', trap: '💀' };
    board.tiles.forEach((type, idx) => {
      const gp = board.gridPosition(idx), r = gp.row - 1, c = gp.col - 1, meta = TILE_META[type];
      if (BUILDING[type]) {
        // 地產：可上色的地基（tile-idx 供發光與地主上色）+ 建築
        const t = document.createElement('div');
        t.className = 'tile plot'; t.id = `tile-${idx}`; t.title = meta.label;
        t.style.width = TW + 'px'; t.style.height = TH + 'px';
        place(t, r, c, 300 + r + c); this.boardEl.appendChild(t);
        const b = propImg(`assets/city/${BUILDING[type]}.png`, 50); b.id = `bldg-${idx}`;
        center(b, r, c, 1000 + r + c); this.boardEl.appendChild(b);
      } else {
        // 道路：以地磚圖鋪面（tile-idx 供發光）
        const f = document.createElement('div'); f.className = 'iso-floor road'; f.id = `tile-${idx}`; f.title = meta.label;
        const im = document.createElement('img'); im.src = 'assets/city/tile.png'; im.style.height = '40px';
        f.appendChild(im); center(f, r, c, 250 + r + c); this.boardEl.appendChild(f);
        if (MARK[type]) { const m = document.createElement('div'); m.className = 'iso-mark'; m.textContent = MARK[type]; center(m, r, c, 1000 + r + c); this.boardEl.appendChild(m); }
      }
    });

    // 3) 內圈樹木
    [[3, 3], [3, 7], [7, 3], [7, 7], [8, 5], [2, 6], [5, 5]].forEach(([r, c]) => { const tr = propImg('assets/city/tree.png', 44); center(tr, r, c, 900 + r + c); this.boardEl.appendChild(tr); });
  }

  // 依地產狀態上色地基並顯示等級徽章
  renderProperties(properties, board) {
    if (!this._iso || !properties) return;
    const { TW, TH, offX, offY, iso } = this._iso;
    for (const idx in properties) {
      const pr = properties[idx];
      const tile = document.getElementById(`tile-${idx}`);
      if (tile) tile.style.background = pr.owner === null
        ? 'linear-gradient(180deg,#efe9d8,#ddd3ba)'
        : OWNER_COLOR[pr.owner];
      let badge = document.getElementById(`badge-${idx}`);
      if (pr.owner !== null && pr.level > 0) {
        if (!badge) {
          badge = document.createElement('div'); badge.id = `badge-${idx}`; badge.className = 'prop-badge';
          const gp = board.gridPosition(+idx), p = iso(gp.row - 1, gp.col - 1);
          badge.style.left = (p.x + offX + TW / 2) + 'px';
          badge.style.top = (p.y + offY + TH / 2 - 54) + 'px';
          badge.style.zIndex = '8000';
          this.boardEl.appendChild(badge);
        }
        badge.textContent = 'Lv' + pr.level;
        badge.style.background = OWNER_COLOR[pr.owner];
      } else if (badge) { badge.remove(); }
    }
  }

  // 依玩家目前位置擺放角色棋子（等距座標）
  renderTokens(players, board) {
    if (!this._iso || !board) return;
    const { TW, TH, offX, offY, iso } = this._iso;
    players.forEach(p => {
      let el = document.getElementById(`token-${p.index}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `token-${p.index}`; el.className = 'token-char';
        const im = document.createElement('img');
        im.src = `assets/characters/${p.char || 'pig'}_front.png`; im.style.height = '52px';
        el.appendChild(im);
        this.boardEl.appendChild(el);
      }
      const gp = board.gridPosition(p.position), r = gp.row - 1, c = gp.col - 1, pt = iso(r, c);
      const dodge = p.index * 14 - 7; // 兩人同格時錯開一點
      el.style.left = (pt.x + offX + TW / 2 + dodge) + 'px';
      el.style.top = (pt.y + offY + TH / 2) + 'px';
      el.style.zIndex = String(9000 + r + c);
    });
  }

  glowTile(index) {
    const tile = document.getElementById(`tile-${index}`);
    if (!tile) return;
    tile.classList.remove('glow');
    void tile.offsetWidth; // 強制 reflow 讓動畫可重新觸發
    tile.classList.add('glow');
  }

  // 玩家總資產 = 現金 + 名下地產（價格 × 等級）
  playerAssets(p, properties) {
    let land = 0;
    if (properties) for (const idx in properties) { const pr = properties[idx]; if (pr.owner === p.index) land += pr.price * pr.level; }
    return p.money + land;
  }

  // 更新左側玩家資訊卡（顯示現金）與排行榜（顯示總資產）
  updatePlayerCards(players, currentIndex, properties) {
    players.forEach((p, i) => {
      const card = document.getElementById(`player-card-${i}`);
      card.querySelector('.name-text').textContent = p.name;
      card.querySelector('.pos').textContent = p.position;
      card.querySelector('.money-val').textContent = p.formattedMoney();
      card.querySelector('.player-status').textContent = p.skipTurn ? '😵 下回合暫停' : '';
      card.classList.toggle('active-turn', i === currentIndex);
    });
    this.updateLeaderboard(players, properties);
  }

  updateLeaderboard(players, properties) {
    const list = document.getElementById('leaderboard-list');
    const sorted = [...players].sort((a, b) => this.playerAssets(b, properties) - this.playerAssets(a, properties));
    list.innerHTML = sorted.map(p => `<li>${p.token} ${p.name}：$${this.playerAssets(p, properties).toLocaleString('en-US')}</li>`).join('');
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
