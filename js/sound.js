// 音效管理：使用 Web Audio API 即時合成音效，不需外部音檔
class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  // 延遲建立 AudioContext（需在使用者互動後才能啟動）
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // 播放單一音調
  beep(freq, duration = 0.15, type = 'sine', delay = 0, volume = 0.25) {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const startTime = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  diceRoll() {
    for (let i = 0; i < 5; i++) this.beep(300 + Math.random() * 300, 0.06, 'square', i * 0.07, 0.15);
  }

  move() {
    this.beep(500, 0.05, 'triangle', 0, 0.12);
  }

  correct() {
    this.beep(523.25, 0.12, 'sine', 0);
    this.beep(659.25, 0.12, 'sine', 0.1);
    this.beep(783.99, 0.2, 'sine', 0.2);
  }

  wrong() {
    this.beep(220, 0.25, 'sawtooth', 0, 0.2);
    this.beep(160, 0.3, 'sawtooth', 0.15, 0.2);
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.beep(f, 0.25, 'sine', i * 0.15, 0.25));
  }

  lucky() {
    this.beep(880, 0.15, 'sine', 0);
    this.beep(1108.73, 0.2, 'sine', 0.12);
  }

  trap() {
    this.beep(200, 0.3, 'sawtooth', 0, 0.2);
  }
}
