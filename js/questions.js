// 題庫系統：依難度產生加減／乘／除／應用題，並盡量避免短時間內重複出題
class QuestionBank {
  constructor(difficulty = 'easy') {
    this.difficulty = difficulty;
    // 每個分類各自維護一個「尚未出過」的題目佇列
    this.queues = { addsub: [], mult: [], div: [], word: [] };
    // 每個分類記住最近出過的題目文字，跨批次也不重複（題型有限時會自動重置）
    this.usedTexts = { addsub: new Set(), mult: new Set(), div: new Set(), word: new Set() };
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.queues = { addsub: [], mult: [], div: [], word: [] };
    this.usedTexts = { addsub: new Set(), mult: new Set(), div: new Set(), word: new Set() };
  }

  static randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 從指定分類的佇列取出一題，佇列空了就重新產生一批
  getQuestion(category) {
    if (this.queues[category].length === 0) this.refill(category);
    return this.queues[category].pop();
  }

  refill(category) {
    const generator = {
      addsub: () => this.genAddSub(),
      mult: () => this.genMult(),
      div: () => this.genDiv(),
      word: () => this.genWord(),
    }[category];

    const used = this.usedTexts[category];
    // 應用題等題型有限，已用集合太大就重置，避免湊不滿一批而卡住
    if (used.size > 400) used.clear();

    const batch = [];
    let attempts = 0;
    while (batch.length < 12 && attempts < 400) {
      attempts++;
      const q = generator();
      if (!used.has(q.text)) {
        used.add(q.text);
        batch.push(q);
      }
    }
    // 極端情況（題型耗盡）仍保證至少有一題可出
    if (batch.length === 0) {
      used.clear();
      batch.push(generator());
    }
    // 洗牌後放入佇列
    for (let i = batch.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [batch[i], batch[j]] = [batch[j], batch[i]];
    }
    this.queues[category] = batch;
  }

  // ===== 加減法 =====
  genAddSub() {
    const ranges = { easy: 100, middle: 1000, hard: 2000 };
    const max = ranges[this.difficulty] || 100;
    const isAdd = Math.random() < 0.5;
    if (isAdd) {
      const a = QuestionBank.randInt(1, max);
      const b = QuestionBank.randInt(1, max);
      return { text: `${a} + ${b} = ?`, answer: a + b, explain: `${a} + ${b} = ${a + b}` };
    }
    let a = QuestionBank.randInt(1, max);
    let b = QuestionBank.randInt(1, max);
    if (b > a) [a, b] = [b, a];
    return { text: `${a} - ${b} = ?`, answer: a - b, explain: `${a} - ${b} = ${a - b}` };
  }

  // ===== 乘法（難度收斂到適合國小生的範圍）=====
  genMult() {
    let a, b;
    if (this.difficulty === 'easy') {          // 九九乘法
      a = QuestionBank.randInt(2, 9);
      b = QuestionBank.randInt(2, 9);
    } else if (this.difficulty === 'middle') { // 含十以上，但不超過 12×12
      a = QuestionBank.randInt(2, 12);
      b = QuestionBank.randInt(2, 9);
    } else {                                   // 兩位數 × 一位數
      a = QuestionBank.randInt(11, 19);
      b = QuestionBank.randInt(2, 9);
    }
    return { text: `${a} × ${b} = ?`, answer: a * b, explain: `${a} × ${b} = ${a * b}` };
  }

  // ===== 除法（答案皆為整數）=====
  genDiv() {
    let divisor, quotient;
    if (this.difficulty === 'easy') {
      divisor = QuestionBank.randInt(2, 9);
      quotient = QuestionBank.randInt(2, 9);
    } else if (this.difficulty === 'middle') {
      divisor = QuestionBank.randInt(2, 9);
      quotient = QuestionBank.randInt(2, 12);
    } else {                                   // 二～三位數 ÷ 一位數
      divisor = QuestionBank.randInt(3, 9);
      quotient = QuestionBank.randInt(11, 20);
    }
    const dividend = divisor * quotient;
    return { text: `${dividend} ÷ ${divisor} = ?`, answer: quotient, explain: `${dividend} ÷ ${divisor} = ${quotient}` };
  }

  // ===== 應用題（生活理財情境）=====
  // 每個模板在條件不成立（如不整除）時回傳 null，由 genWord 重新抽題，避免遞迴。
  genWord() {
    const pool = WORD_TEMPLATES[this.difficulty] || WORD_TEMPLATES.easy;
    for (let i = 0; i < 60; i++) {
      const q = pool[QuestionBank.randInt(0, pool.length - 1)]();
      if (q) return q;
    }
    // 保底題目，確保永遠有題可出
    const a = QuestionBank.randInt(2, 9), b = QuestionBank.randInt(2, 9);
    return {
      text: `一枝筆 $${a}，買了 ${b} 枝，一共多少錢？`,
      answer: a * b,
      explain: `${a} × ${b} = ${a * b}`,
    };
  }
}

// 應用題模板庫（依難度分組；R = QuestionBank.randInt 的捷徑）
const R = (min, max) => QuestionBank.randInt(min, max);
const WORD_TEMPLATES = {
  // ---- Easy：單步驟 ----
  easy: [
    () => { // 買東西找零
      const price = R(10, 60), paid = R(price + 5, price + 50);
      return { text: `你去便利商店買了一個玩具 $${price}，\n你付了 $${paid}，老闆應該找你多少錢？`,
        answer: paid - price, explain: `找零 = 付款 - 價格 = ${paid} - ${price} = ${paid - price}` };
    },
    () => { // 每週儲蓄
      const weekly = R(20, 100), weeks = R(3, 8);
      return { text: `小明每週存零用錢 $${weekly}，\n存了 ${weeks} 週後，他一共存了多少錢？`,
        answer: weekly * weeks, explain: `總金額 = ${weekly} × ${weeks} = ${weekly * weeks}` };
    },
    () => { // 平分獎金
      const people = R(2, 4), each0 = R(10, 40), total = each0 * people;
      return { text: `${people} 個朋友平分一筆 $${total} 的獎金，\n每人可以分到多少錢？`,
        answer: total / people, explain: `每人 = ${total} ÷ ${people} = ${total / people}` };
    },
    () => { // 買幾個一樣的東西
      const price = R(5, 30), qty = R(2, 6);
      return { text: `一個貼紙 $${price}，小華買了 ${qty} 個，\n一共要付多少錢？`,
        answer: price * qty, explain: `${price} × ${qty} = ${price * qty}` };
    },
    () => { // 剩多少錢
      const money = R(50, 100), spend = R(10, money - 5);
      return { text: `你有 $${money}，買文具花了 $${spend}，\n請問還剩下多少錢？`,
        answer: money - spend, explain: `${money} - ${spend} = ${money - spend}` };
    },
    () => { // 存錢罐加總
      const coin = R(5, 10), count = R(4, 9);
      return { text: `存錢罐裡有 ${count} 個 $${coin} 的硬幣，\n一共有多少錢？`,
        answer: coin * count, explain: `${coin} × ${count} = ${coin * count}` };
    },
  ],
  // ---- Middle：兩步驟 ----
  middle: [
    () => { // 買數量後找零
      const price = R(50, 300), qty = R(2, 5), total = price * qty, paid = R(total + 10, total + 200);
      return { text: `一枝筆 $${price}，媽媽買了 ${qty} 枝，\n付了 $${paid}，請問應該找回多少錢？`,
        answer: paid - total, explain: `總價 = ${price} × ${qty} = ${total}\n找零 = ${paid} - ${total} = ${paid - total}` };
    },
    () => { // 存錢加獎金
      const monthly = R(100, 500), months = R(4, 12), bonus = R(50, 300), total = monthly * months + bonus;
      return { text: `小華每個月存 $${monthly}，存了 ${months} 個月後，\n又得到獎金 $${bonus}，請問一共有多少錢？`,
        answer: total, explain: `${monthly} × ${months} + ${bonus} = ${monthly * months} + ${bonus} = ${total}` };
    },
    () => { // 平分後再加購
      const people = R(2, 6), each0 = R(20, 60), total = each0 * people, extra = R(10, 50);
      return { text: `${people} 個朋友平分 $${total} 的旅費，\n分完後每人又各出 $${extra} 買紀念品，\n請問每人總共花了多少錢？`,
        answer: total / people + extra, explain: `每人分攤 = ${total} ÷ ${people} = ${total / people}\n總花費 = ${total / people} + ${extra} = ${total / people + extra}` };
    },
    () => { // 兩種商品合計
      const p1 = R(20, 80), p2 = R(30, 120), n1 = R(2, 4), n2 = R(2, 4);
      return { text: `飲料一瓶 $${p1} 買了 ${n1} 瓶，麵包一個 $${p2} 買了 ${n2} 個，\n一共要付多少錢？`,
        answer: p1 * n1 + p2 * n2, explain: `${p1}×${n1} + ${p2}×${n2} = ${p1 * n1} + ${p2 * n2} = ${p1 * n1 + p2 * n2}` };
    },
    () => { // 找零後平分
      const total = R(2, 5) * R(30, 80), people = R(2, 4);
      const grand = total * people;
      return { text: `${people} 個人一起吃飯共 $${grand}，\n平均分攤，每人要付多少錢？`,
        answer: grand / people, explain: `每人 = ${grand} ÷ ${people} = ${grand / people}` };
    },
    () => { // 每日存錢滿月
      const daily = R(10, 40), days = R(15, 30), goal = daily * days;
      return { text: `小美每天存 $${daily}，連續存 ${days} 天，\n她一共可以存到多少錢？`,
        answer: goal, explain: `${daily} × ${days} = ${goal}` };
    },
  ],
  // ---- Hard：多步驟混合（打折／平分／找零）----
  hard: [
    () => { // 打折後找零
      const price = R(400, 1200), tenths = R(5, 9), discounted = Math.round(price * tenths / 10), paid = discounted + R(20, 100);
      return { text: `一件外套原價 $${price}，打 ${tenths} 折後，\n你付了 $${paid}，請問應該找回多少錢？\n（折後金額四捨五入取整數）`,
        answer: paid - discounted, explain: `折後價 = ${price} × ${tenths}÷10 ≈ ${discounted}\n找零 = ${paid} - ${discounted} = ${paid - discounted}` };
    },
    () => { // 多件平分
      const price = R(200, 800), qty = R(2, 4), total = price * qty, people = R(2, 4);
      if (total % people !== 0) return null;
      return { text: `一盒餅乾 $${price}，班上買了 ${qty} 盒，\n由 ${people} 位同學平分費用，每人要付多少錢？`,
        answer: total / people, explain: `總價 = ${price} × ${qty} = ${total}\n每人 = ${total} ÷ ${people} = ${total / people}` };
    },
    () => { // 打折後平分（保證整除）
      const tenths = R(6, 9), people = R(2, 3), each = R(80, 200), discounted = each * people;
      const price = Math.round(discounted * 10 / tenths);
      return { text: `一台遊戲機原價約 $${price}，打 ${tenths} 折後約 $${discounted}，\n由 ${people} 人平分購買，每人要付多少錢？`,
        answer: each, explain: `折後價 ≈ ${discounted}\n每人 = ${discounted} ÷ ${people} = ${each}` };
    },
    () => { // 買多件再打折
      const price = R(120, 400), qty = R(2, 5), total = price * qty, tenths = R(7, 9), pay = Math.round(total * tenths / 10);
      return { text: `一本書 $${price}，買了 ${qty} 本，全部打 ${tenths} 折，\n請問總共要付多少錢？（四捨五入取整數）`,
        answer: pay, explain: `原總價 = ${price} × ${qty} = ${total}\n折後 = ${total} × ${tenths}÷10 ≈ ${pay}` };
    },
    () => { // 存款乘法後扣支出
      const monthly = R(300, 800), months = R(6, 12), spend = R(500, 2000), total = monthly * months - spend;
      if (total < 0) return null;
      return { text: `爸爸每月存 $${monthly}，存了 ${months} 個月，\n中途花掉 $${spend}，請問現在還有多少錢？`,
        answer: total, explain: `${monthly} × ${months} - ${spend} = ${monthly * months} - ${spend} = ${total}` };
    },
    () => { // 打折省下多少
      const price = R(500, 1500), tenths = R(5, 8), discounted = Math.round(price * tenths / 10), saved = price - discounted;
      return { text: `一雙鞋原價 $${price}，打 ${tenths} 折，\n請問這樣「省下」了多少錢？（四捨五入取整數）`,
        answer: saved, explain: `折後價 ≈ ${discounted}\n省下 = ${price} - ${discounted} = ${saved}` };
    },
  ],
};
