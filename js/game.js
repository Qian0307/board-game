// 遊戲主控制器：串接棋盤、玩家、題庫、UI、音效與網路連線
// 三種模式：
//   local — 同一台裝置兩人輪流
//   host  — 線上房主，跑遊戲邏輯並把畫面同步給訪客（主機權威）
//   guest — 線上訪客，送出操作、依主機訊息更新畫面
class Game {
  constructor() {
    this.ui = new UI();
    this.sound = new SoundManager();
    this.difficulty = 'easy';
    this.maxRounds = 20;
    this.board = null;
    this.players = [];
    this.currentPlayerIndex = 0;
    this.round = 1;
    this.questionBank = null;
    this.busy = false;
    this.extraRollPending = false;
    this._answerResolver = null;
    this._continueResolver = null;
    this._eventOkResolver = null;

    // 網路
    this.mode = 'local';      // 'local' | 'host' | 'guest'
    this.localSeat = null;    // 本端可操作的座位：null=兩人皆可, 0=房主, 1=訪客
    this.net = null;
    this.onlineGuestName = null;
    this._lastNames = ['玩家1', '玩家2'];
    this._diceValue = null;
    this._rollEnabled = false;
  }

  init() {
    this.bindHome();
    this.bindRules();
    this.bindDifficulty();
    this.bindSetup();
    this.bindOnline();
    this.bindGameControls();
    this.bindModals();
    this.bindEnd();
    this.ui.showScreen('screen-home');
  }

  // 本端是否能操作指定座位（線上模式用來區分「自己回合」與「觀看對方」）
  canControl(seat) {
    return this.localSeat === null || this.localSeat === seat;
  }

  // ===== 首頁 =====
  bindHome() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.mode = 'local'; this.localSeat = null;
      this.ui.showScreen('screen-setup');
    });
    document.getElementById('btn-rules').addEventListener('click', () => this.ui.showScreen('screen-rules'));
    document.getElementById('btn-difficulty').addEventListener('click', () => {
      this.ui.highlightDifficulty(this.difficulty);
      this.ui.showScreen('screen-difficulty');
    });
    document.getElementById('btn-sound').addEventListener('click', () => {
      const on = this.sound.toggle();
      document.getElementById('sound-label').textContent = on ? '開' : '關';
    });
  }

  bindRules() {
    document.getElementById('btn-rules-back').addEventListener('click', () => this.ui.showScreen('screen-home'));
  }

  bindDifficulty() {
    const labels = { easy: '簡單', middle: '普通', hard: '困難' };
    document.querySelectorAll('.diff-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.difficulty = btn.dataset.difficulty;
        this.ui.highlightDifficulty(this.difficulty);
        document.getElementById('difficulty-label').textContent = labels[this.difficulty];
      });
    });
    document.getElementById('btn-difficulty-back').addEventListener('click', () => this.ui.showScreen('screen-home'));
  }

  // ===== 本機雙人：玩家設定 =====
  bindSetup() {
    const confirm = () => {
      const name1 = document.getElementById('input-player1').value.trim() || '玩家1';
      const name2 = document.getElementById('input-player2').value.trim() || '玩家2';
      this.startGame(name1, name2);
    };
    document.getElementById('btn-setup-confirm').addEventListener('click', confirm);
    ['input-player1', 'input-player2'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
    });
  }

  // ===== 線上房間：建立/加入 =====
  bindOnline() {
    document.getElementById('btn-host').addEventListener('click', () => this.startHosting());
    document.getElementById('btn-join').addEventListener('click', () => {
      document.getElementById('join-status').textContent = '';
      this.ui.showScreen('screen-join');
    });
    document.getElementById('btn-host-back').addEventListener('click', () => this.leaveOnline());
    document.getElementById('btn-join-back').addEventListener('click', () => this.leaveOnline());
    document.getElementById('btn-host-start').addEventListener('click', () => {
      const hostName = (document.getElementById('input-host-name').value.trim() || '老師').slice(0, 8);
      this.startGame(hostName, this.onlineGuestName || '學生');
    });
    document.getElementById('input-join-code').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.startJoining();
    });
    document.getElementById('btn-join-connect').addEventListener('click', () => this.startJoining());
  }

  startHosting() {
    this.mode = 'host'; this.localSeat = 0; this.onlineGuestName = null;
    document.getElementById('host-code-box').classList.add('hidden');
    const status = document.getElementById('host-status');
    status.textContent = '連線中…正在產生房號';
    status.classList.remove('hidden');
    document.getElementById('btn-host-start').disabled = true;
    document.getElementById('host-guest-info').textContent = '👤 尚無學生加入';

    this.net = new NetManager();
    this.net.onData = (d) => this.handleNetMessage(d);
    this.net.onClose = () => this.onPeerClose();
    this.net.onError = (e) => { status.classList.remove('hidden'); status.textContent = '❌ 無法建立房間：' + this.netErrText(e); };
    this.net.host((code) => {
      status.classList.add('hidden');
      document.getElementById('host-code').textContent = code;
      document.getElementById('host-code-box').classList.remove('hidden');
    });
    this.ui.showScreen('screen-host');
  }

  startJoining() {
    const code = document.getElementById('input-join-code').value.trim().toUpperCase();
    const name = (document.getElementById('input-join-name').value.trim() || '學生').slice(0, 8);
    const status = document.getElementById('join-status');
    if (code.length < 4) { status.textContent = '⚠️ 請輸入 4 碼房號'; return; }

    this.mode = 'guest'; this.localSeat = 1; this.onlineSelfName = name;
    status.textContent = '連線中…';
    this.net = new NetManager();
    this.net.onData = (d) => this.handleNetMessage(d);
    this.net.onOpen = () => {
      this.net.send({ t: 'hello', name });
      status.textContent = '✅ 已連上房間，等待老師開始遊戲…';
      this.ui.setNetStatus('🟢 已連線', true);
    };
    this.net.onClose = () => this.onPeerClose();
    this.net.onError = (e) => { status.textContent = '❌ 連線失敗：' + this.netErrText(e); };
    this.net.join(code);
  }

  leaveOnline() {
    if (this.net) { this.net.close(); this.net = null; }
    this.mode = 'local'; this.localSeat = null;
    this.ui.setNetStatus('', false);
    this.ui.showScreen('screen-home');
  }

  onPeerClose() {
    this.ui.setNetStatus('🔴 連線中斷', false);
    this.ui.logEvent('⚠️ 對方已離線，連線中斷。');
    this.setRollEnabled(false);
  }

  netErrText(e) {
    const t = e && e.type;
    if (t === 'no-peerjs') return '未載入連線元件，請確認有網路後重試';
    if (t === 'peer-unavailable') return '找不到這個房號，請確認老師是否已開房';
    if (t === 'network' || t === 'server-error' || t === 'socket-error') return '連線伺服器暫時無法使用，請稍後再試';
    return t || '未知錯誤';
  }

  // ===== 開始遊戲（host / local 共用；guest 由 guestStart 進入）=====
  startGame(name1, name2) {
    this._lastNames = [name1, name2];
    this.players = [new Player(name1, '🔴', 0), new Player(name2, '🔵', 1)];
    this.board = new Board(40);
    this.questionBank = new QuestionBank(this.difficulty);
    this.round = 1;
    this.busy = false;                 // 重開時務必回到乾淨狀態
    this.extraRollPending = false;
    this._diceValue = null;

    // 擲骰決定先後順序
    let r1 = QuestionBank.randInt(1, 6);
    let r2 = QuestionBank.randInt(1, 6);
    while (r1 === r2) { r1 = QuestionBank.randInt(1, 6); r2 = QuestionBank.randInt(1, 6); }
    this.currentPlayerIndex = r1 > r2 ? 0 : 1;

    // 線上：先送初始狀態讓訪客建立棋盤
    if (this.mode === 'host') {
      document.getElementById('btn-play-again').textContent = '🔄 再玩一次';
      document.getElementById('btn-play-again').disabled = false;
      this.send({ t: 'start', s: this.snapshot() });
    }

    this.ui.showScreen('screen-game');
    this.ui.eventLogEl.innerHTML = '';
    this.ui.renderBoard(this.board);
    this.ui.renderTokens(this.players);
    this.updatePanels();
    this.log(`${name1} 擲出 ${r1} 點，${name2} 擲出 ${r2} 點，${this.players[this.currentPlayerIndex].name} 先攻！`);
    this.setRollEnabled(true);
  }

  // ===== 遊戲畫面控制 =====
  bindGameControls() {
    document.getElementById('btn-roll').addEventListener('click', () => this.onRollButton());
  }

  onRollButton() {
    if (this.mode === 'guest') { this.send({ t: 'in', a: 'roll' }); return; }
    this.onRoll();
  }

  // 依模式與回合決定本端擲骰按鈕是否可按
  setRollEnabled(enabled) {
    this._rollEnabled = enabled;
    let localEnabled = enabled;
    if (this.mode === 'host') localEnabled = enabled && this.currentPlayerIndex === 0;
    else if (this.mode === 'guest') localEnabled = enabled && this.currentPlayerIndex === 1;
    this.ui.setRollButton(localEnabled);
    this.pushState();
  }

  updatePanels() {
    this.ui.updatePlayerCards(this.players, this.currentPlayerIndex);
    this.ui.updateRoundInfo(Math.min(this.round, this.maxRounds), this.maxRounds, this.players[this.currentPlayerIndex]);
    this.pushState();
  }

  async onRoll() {
    if (this.busy) return;
    this.busy = true;
    this.setRollEnabled(false);

    const player = this.players[this.currentPlayerIndex];
    const roll = QuestionBank.randInt(1, 6);
    this._diceValue = roll;
    player.stats.rolls++;
    this.sound.diceRoll();
    this.send({ t: 'dice', value: roll });
    await this.ui.rollDiceAnimation(roll);
    await this.animateMove(player, roll);
    this.log(`🎲 ${player.name} 擲出 ${roll} 點，走到第 ${player.position} 格`);

    await this.resolveTile(player);

    if (this.checkGameOver(player)) { this.busy = false; return; }

    this.advanceTurn();
    this.updatePanels();

    if (this.checkGameOver(null)) { this.busy = false; return; }

    this.busy = false;
    this.setRollEnabled(true);
  }

  checkGameOver(player) {
    if (player && player.reachedEnd(this.board.size)) { this.endGame('reach'); return true; }
    if (this.round > this.maxRounds) { this.endGame('rounds'); return true; }
    return false;
  }

  // 逐格移動棋子並播放動畫、音效（每步同步給訪客）
  async animateMove(player, steps) {
    if (!steps) return;
    const dir = steps > 0 ? 1 : -1;
    const count = Math.abs(steps);
    for (let i = 0; i < count; i++) {
      player.moveBy(dir, this.board.size);
      this.ui.renderTokens(this.players);
      this.pushState();
      this.sound.move();
      await UI.wait(120);
      if (player.position === 0 || player.position === this.board.size - 1) break;
    }
    this.ui.glowTile(player.position);
    this.updatePanels();
  }

  async resolveTile(player) {
    const opponent = this.players[(player.index + 1) % this.players.length];
    const type = this.board.getType(player.position);

    switch (type) {
      case 'addsub':
      case 'mult':
      case 'div':
      case 'word':
        await this.handleQuestionTile(player, type);
        break;
      case 'lucky':
        this.sound.lucky();
        await this.handleLuckyTrap(player, opponent, LUCKY_EVENTS, '🎁 幸運事件');
        break;
      case 'trap':
        this.sound.trap();
        await this.handleLuckyTrap(player, opponent, TRAP_EVENTS, '💀 陷阱事件');
        break;
      default:
        break; // 普通格 / 起點 / 終點：無事發生
    }
  }

  async handleQuestionTile(player, category) {
    const q = this.questionBank.getQuestion(category);
    const actor = this.currentPlayerIndex;
    this.ui.openQuestionModal(category, q.text, this.canControl(actor));
    this.send({ t: 'question', category, text: q.text, actor });

    const answerVal = await this.waitForAnswer();
    const correct = answerVal !== null && Math.abs(answerVal - q.answer) < 1e-9;
    const reward = REWARD_TABLE[category];
    let msg;

    if (correct) {
      player.addMoney(reward.correct);
      player.stats.correct++;
      this.sound.correct();
      this.ui.spawnCoinDrop();
      msg = `✅ 答對了！獲得 $${reward.correct}`;
      this.log(`${player.name} 答對${TILE_META[category].label}題，+$${reward.correct}`);
    } else {
      player.addMoney(reward.wrong);
      player.stats.wrong++;
      this.sound.wrong();
      msg = `❌ 答錯了，${reward.wrong} 元\n正解：${q.answer}\n${q.explain}`;
      this.log(`${player.name} 答錯${TILE_META[category].label}題，${reward.wrong}元`);
    }

    this.ui.showQuestionFeedback(correct, msg, this.canControl(actor));
    this.send({ t: 'feedback', correct, message: msg, actor });
    this.updatePanels();

    await this.waitForContinue(); // 由作答方按「繼續」關閉，看完詳解不會被時間逼走
    this.ui.closeQuestionModal();
    this.send({ t: 'closeQ' });
  }

  async handleLuckyTrap(player, opponent, pool, title) {
    const event = pool[Math.floor(Math.random() * pool.length)];
    const effect = event.apply(player, opponent) || {};
    const actor = this.currentPlayerIndex;
    const text = `${player.name}：\n${event.text}`;

    this.ui.openEventModal(title, text, this.canControl(actor));
    this.send({ t: 'event', title, text, actor });
    await this.waitForEventOk();
    this.ui.closeEventModal();
    this.send({ t: 'closeE' });
    this.log(`${title}｜${player.name}：${event.text}`);

    if (effect.moveTo !== undefined) await this.animateMove(player, effect.moveTo - player.position);
    if (effect.move) await this.animateMove(player, effect.move);
    if (effect.moveOpponent) await this.animateMove(opponent, effect.moveOpponent);
    if (effect.extraRoll) this.extraRollPending = true;
    this.updatePanels();
  }

  // ===== 等待輸入的 Promise =====
  waitForAnswer() { return new Promise(resolve => { this._answerResolver = resolve; }); }
  waitForContinue() { return new Promise(resolve => { this._continueResolver = resolve; }); }
  waitForEventOk() { return new Promise(resolve => { this._eventOkResolver = resolve; }); }

  resolveAnswer(raw) {
    if (!this._answerResolver) return;
    const r = this._answerResolver; this._answerResolver = null;
    const val = (raw === '' || raw === null || raw === undefined) ? null : Number(raw);
    r(val);
  }
  resolveContinue() {
    if (!this._continueResolver) return;
    const r = this._continueResolver; this._continueResolver = null; r();
  }
  resolveEventOk() {
    if (!this._eventOkResolver) return;
    const r = this._eventOkResolver; this._eventOkResolver = null; r();
  }

  // ===== 彈窗按鈕 =====
  bindModals() {
    const submit = () => this.onSubmitButton();
    document.getElementById('btn-answer-submit').addEventListener('click', submit);
    document.getElementById('question-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    document.getElementById('btn-question-continue').addEventListener('click', () => this.onContinueButton());
    document.getElementById('btn-event-ok').addEventListener('click', () => this.onEventOkButton());
  }

  onSubmitButton() {
    const val = document.getElementById('question-input').value.trim();
    if (val === '') { this.ui.flashAnswerHint('請先輸入答案 🙂'); return; }
    if (this.mode === 'guest') { this.send({ t: 'in', a: 'answer', v: val }); this.ui.lockQuestionAfterSubmit(); return; }
    this.resolveAnswer(val);
  }
  onContinueButton() {
    if (this.mode === 'guest') { this.send({ t: 'in', a: 'continue' }); return; }
    this.resolveContinue();
  }
  onEventOkButton() {
    if (this.mode === 'guest') { this.send({ t: 'in', a: 'eventOk' }); return; }
    this.resolveEventOk();
  }

  // 換下一位玩家；若觸發「再骰一次」則同一位玩家繼續
  advanceTurn() {
    if (this.extraRollPending) { this.extraRollPending = false; return; }
    let next = (this.currentPlayerIndex + 1) % this.players.length;
    if (next === 0) this.round++;
    this.currentPlayerIndex = next;

    if (this.players[this.currentPlayerIndex].skipTurn) {
      this.players[this.currentPlayerIndex].skipTurn = false;
      this.log(`😵 ${this.players[this.currentPlayerIndex].name} 被跳過這回合`);
      this.advanceTurn();
    }
  }

  // ===== 結算 =====
  bindEnd() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      document.getElementById('fireworks').innerHTML = '';
      if (this.mode === 'host') { this.startGame(this._lastNames[0], this._lastNames[1]); return; }
      if (this.mode === 'guest') {
        document.getElementById('btn-play-again').disabled = true;
        document.getElementById('btn-play-again').textContent = '⏳ 等待老師開新局…';
        return;
      }
      this.ui.showScreen('screen-home');
    });
  }

  endGame(reason) {
    this.setRollEnabled(false);
    const title = reason === 'reach' ? '🏁 有人抵達終點！' : '⏰ 20 回合結束！';

    const maxMoney = Math.max(...this.players.map(p => p.money));
    const winners = this.players.filter(p => p.money === maxMoney);
    const winnerText = winners.length > 1
      ? `🤝 平手！${winners.map(w => w.name).join('、')} 資產並列最高：${winners[0].formattedMoney()}`
      : `🎉 冠軍是 ${winners[0].token} ${winners[0].name}！最終資產 ${winners[0].formattedMoney()}`;

    const statsHtml = this.players.map(p => {
      const total = p.stats.correct + p.stats.wrong;
      const rate = total ? Math.round((p.stats.correct / total) * 100) : 0;
      return `<p><b>${p.token} ${p.name}</b><br>
        最終資產：${p.formattedMoney()}<br>
        擲骰次數：${p.stats.rolls}　答對率：${rate}%（${p.stats.correct}對／${p.stats.wrong}錯）</p>`;
    }).join('') + `<p>總回合數：${Math.min(this.round, this.maxRounds)}</p>`;

    this.ui.showEndScreen(title, winnerText, statsHtml);
    this.send({ t: 'end', title, winnerText, statsHtml });
    this.sound.win();
  }

  // ===== 網路：狀態同步與訊息處理 =====
  send(msg) { if (this.net) this.net.send(msg); }

  // 同時寫入本端事件紀錄並廣播給對方
  log(text) { this.ui.logEvent(text); this.send({ t: 'log', text }); }

  snapshot() {
    return {
      players: this.players.map(p => ({
        name: p.name, token: p.token, index: p.index,
        money: p.money, position: p.position, skipTurn: p.skipTurn,
        stats: { rolls: p.stats.rolls, correct: p.stats.correct, wrong: p.stats.wrong },
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      round: Math.min(this.round, this.maxRounds),
      maxRounds: this.maxRounds,
      diceFace: this._diceValue || null,
      rollEnabled: this._rollEnabled,
    };
  }

  pushState() {
    if (this.mode !== 'host' || !this.net) return;
    this.net.send({ t: 'sync', s: this.snapshot() });
  }

  handleNetMessage(msg) {
    if (this.mode === 'host') {
      if (msg.t === 'hello') this.onGuestHello(msg);
      else if (msg.t === 'in') this.handleGuestInput(msg);
      return;
    }
    // ===== 以下為訪客端 =====
    switch (msg.t) {
      case 'start': this.guestStart(msg); break;
      case 'sync': this.guestApplySync(msg.s); break;
      case 'log': this.ui.logEvent(msg.text); break;
      case 'screen': this.ui.showScreen(msg.id); break;
      case 'dice': this.sound.diceRoll(); this.ui.rollDiceAnimation(msg.value); break;
      case 'question': this.ui.openQuestionModal(msg.category, msg.text, msg.actor === this.localSeat); break;
      case 'feedback': this.guestFeedback(msg); break;
      case 'closeQ': this.ui.closeQuestionModal(); break;
      case 'event': this.guestEvent(msg); break;
      case 'closeE': this.ui.closeEventModal(); break;
      case 'end':
        this.ui.showEndScreen(msg.title, msg.winnerText, msg.statsHtml);
        this.sound.win();
        document.getElementById('btn-play-again').textContent = '🔄 再玩一次';
        document.getElementById('btn-play-again').disabled = false;
        break;
      default: break;
    }
  }

  // 房主：收到學生輸入（只在輪到學生時採納）
  handleGuestInput(msg) {
    if (this.currentPlayerIndex !== 1) return;
    switch (msg.a) {
      case 'roll': this.onRoll(); break;
      case 'answer': this.resolveAnswer(msg.v); break;
      case 'continue': this.resolveContinue(); break;
      case 'eventOk': this.resolveEventOk(); break;
      default: break;
    }
  }

  onGuestHello(msg) {
    this.onlineGuestName = (msg.name || '學生').slice(0, 8);
    document.getElementById('host-guest-info').textContent = `👤 ${this.onlineGuestName} 已加入！`;
    document.getElementById('btn-host-start').disabled = false;
    this.ui.setNetStatus('🟢 學生已連線', true);
  }

  // 訪客：主機通知開新局
  guestStart(msg) {
    this.board = new Board(40);
    this.ui.showScreen('screen-game');
    this.ui.eventLogEl.innerHTML = '';
    this.ui.renderBoard(this.board);
    this.ui.setNetStatus('🟢 已連線', true);
    this.guestApplySync(msg.s);
  }

  guestApplySync(s) {
    if (!this.board) return; // 尚未收到 start，忽略先到的 sync
    this.players = s.players.map(p => Object.assign(new Player(p.name, p.token, p.index), p));
    this.currentPlayerIndex = s.currentPlayerIndex;
    this.ui.renderTokens(this.players);
    this.ui.updatePlayerCards(this.players, s.currentPlayerIndex);
    this.ui.updateRoundInfo(s.round, s.maxRounds, this.players[s.currentPlayerIndex]);
    if (s.diceFace) this.ui.setDiceFace(s.diceFace);
    this.ui.setRollButton(!!s.rollEnabled && s.currentPlayerIndex === 1);
  }

  guestFeedback(msg) {
    this.ui.showQuestionFeedback(msg.correct, msg.message, msg.actor === this.localSeat);
    if (msg.correct) { this.sound.correct(); this.ui.spawnCoinDrop(); }
    else this.sound.wrong();
  }

  guestEvent(msg) {
    const isLucky = msg.title && msg.title.indexOf('幸運') >= 0;
    if (isLucky) this.sound.lucky(); else this.sound.trap();
    this.ui.openEventModal(msg.title, msg.text, msg.actor === this.localSeat);
  }
}
