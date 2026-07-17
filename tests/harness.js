// 測試骨架：用 jsdom 載入遊戲，提供「機器人玩家」自動點擊按鈕玩完一局
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function createWindow() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script[^>]*><\/script>/g, ''); // 手動注入，避免抓 CDN
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
  const win = dom.window;

  // 音效 stub
  class FakeAudioCtx {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 }, connect() {} }; }
    resume() { return Promise.resolve(); }
    close() {}
  }
  win.AudioContext = FakeAudioCtx;
  win.webkitAudioContext = FakeAudioCtx;
  win.Peer = undefined; // 不連真的 PeerJS

  // 用 <script> 注入而非 eval：class 宣告才會進到共用的全域語彙環境（同瀏覽器行為）
  const inject = code => {
    const s = win.document.createElement('script');
    s.textContent = code;
    win.document.body.appendChild(s);
  };
  const files = ['sound.js', 'questions.js', 'board.js', 'player.js', 'net.js', 'ui.js', 'game.js'];
  for (const f of files) inject(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));

  // 動畫等待歸零，測試才跑得快
  inject('UI.wait = () => Promise.resolve();');
  inject('UI.prototype.rollDiceAnimation = function (v) { this.setDiceFace(v); return Promise.resolve(); };');

  const errors = [];
  win.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message)));
  win.__rejections = [];
  inject('window.onunhandledrejection = e => { window.__rejections.push(String((e.reason && e.reason.stack) || e.reason)); };');

  return { win, dom, errors, inject };
}

// 建立 Game 實例並完成 init()（停在首頁）
function createGame() {
  const ctx = createWindow();
  ctx.inject('window.game = new Game(); window.game.init();');
  ctx.game = ctx.win.game;
  return ctx;
}

// 記錄每次出的題目，機器人才知道正確答案
function trackQuestions(ctx) {
  ctx.inject(`
    (function () {
      const orig = QuestionBank.prototype.getQuestion;
      window.__questions = [];
      QuestionBank.prototype.getQuestion = function (cat) {
        const q = orig.call(this, cat);
        window.__questions.push({ category: cat, text: q.text, answer: q.answer, explain: q.explain });
        return q;
      };
    })();
  `);
  return () => ctx.win.__questions;
}

const $ = (win, id) => win.document.getElementById(id);
const visible = el => el && !el.classList.contains('hidden');
const click = el => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));

// 機器人：輪詢畫面狀態，該答題就答題、該按繼續就按繼續、輪到自己就擲骰
// accuracy = 答對機率（1 = 全對，0 = 全錯）
async function runBot(ctx, { accuracy = 1, maxTicks = 20000, seat = null } = {}) {
  const win = ctx.win;
  let ticks = 0;
  let lastAnsweredCount = -1;
  while (ticks++ < maxTicks) {
    await new Promise(r => setTimeout(r, 0));

    if ($(win, 'screen-end').classList.contains('active')) return 'end';

    const qModal = $(win, 'modal-question');
    const submit = $(win, 'btn-answer-submit');
    const cont = $(win, 'btn-question-continue');
    const eventOk = $(win, 'btn-event-ok');
    const roll = $(win, 'btn-roll');

    if (visible(qModal) && visible(submit) && !$(win, 'question-input').disabled) {
      const qs = win.__questions;
      if (qs.length !== lastAnsweredCount) {
        lastAnsweredCount = qs.length;
        const q = qs[qs.length - 1];
        const wrong = Math.random() >= accuracy;
        $(win, 'question-input').value = String(wrong ? q.answer + 1 : q.answer);
        click(submit);
        continue;
      }
    }
    if (visible(qModal) && visible(cont)) { click(cont); continue; }
    if (visible($(win, 'modal-event')) && visible(eventOk)) { click(eventOk); continue; }
    if (!roll.disabled) { click(roll); continue; }
  }
  return 'timeout';
}

module.exports = { createWindow, createGame, trackQuestions, runBot, $, visible, click, ROOT };
