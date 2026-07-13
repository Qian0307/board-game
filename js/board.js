// 棋盤設定：40 格地圖與格子類型定義
const TILE_META = {
  start:  { icon: '🚩', label: '起點', cls: 'tile-start' },
  end:    { icon: '🏁', label: '終點', cls: 'tile-end' },
  normal: { icon: '⬜', label: '普通', cls: 'tile-normal' },
  addsub: { icon: '➕', label: '加減法', cls: 'tile-addsub' },
  mult:   { icon: '✖️', label: '乘法', cls: 'tile-mult' },
  div:    { icon: '➗', label: '除法', cls: 'tile-div' },
  word:   { icon: '🧠', label: '應用題', cls: 'tile-word' },
  lucky:  { icon: '🎁', label: '幸運', cls: 'tile-lucky' },
  trap:   { icon: '💀', label: '陷阱', cls: 'tile-trap' },
};

// 獎懲設定：依格子類型決定答對/答錯的金額變動
const REWARD_TABLE = {
  addsub: { correct: 50, wrong: -20 },
  mult:   { correct: 100, wrong: -50 },
  div:    { correct: 100, wrong: -50 },
  word:   { correct: 150, wrong: -60 },
};

class Board {
  constructor(size = 40) {
    this.size = size;
    this.tiles = this.buildTiles(size);
  }

  // 建立 40 格地圖，交錯安排各種格子類型
  buildTiles(size) {
    const pattern = [
      'start', 'normal', 'addsub', 'normal', 'lucky',
      'mult', 'normal', 'trap', 'div', 'normal',
      'word', 'normal', 'addsub', 'lucky', 'normal',
      'mult', 'trap', 'normal', 'div', 'word',
      'normal', 'addsub', 'normal', 'lucky', 'mult',
      'normal', 'trap', 'div', 'normal', 'word',
      'addsub', 'normal', 'lucky', 'mult', 'normal',
      'trap', 'div', 'word', 'normal', 'end',
    ];
    // 若地圖大小不是 40，就用循環的方式延伸／裁切中段格子
    if (pattern.length === size) return pattern;
    const middle = pattern.slice(1, -1);
    const tiles = ['start'];
    for (let i = 0; i < size - 2; i++) tiles.push(middle[i % middle.length]);
    tiles.push('end');
    return tiles;
  }

  getType(index) {
    return this.tiles[index];
  }

  // 計算格子在方形棋盤（繞圈式）上的格線座標，讓 40 格排成一圈，中間留空
  gridPosition(index) {
    const perSide = this.size / 4;      // 每邊格數（不含重複的角落）＝ 10
    const ringLen = perSide + 1;        // 含角落的格線長度 ＝ 11

    if (index <= perSide) {
      // 下排：由右往左（起點在右下角）
      return { row: ringLen, col: ringLen - index };
    } else if (index <= perSide * 2) {
      // 左排：由下往上
      return { row: ringLen - (index - perSide), col: 1 };
    } else if (index <= perSide * 3) {
      // 上排：由左往右
      return { row: 1, col: 1 + (index - perSide * 2) };
    } else {
      // 右排：由上往下，回到起點旁
      return { row: 1 + (index - perSide * 3), col: ringLen };
    }
  }

  get ringLen() {
    return this.size / 4 + 1;
  }
}

// 幸運事件（財富機會）
const LUCKY_EVENTS = [
  {
    // 前進格數 2~5 格隨機（符合規格）
    text: '🎁 撿到 $200，前進幾格試試看！',
    apply(player, opponent) {
      player.addMoney(200);
      return { move: QuestionBank.randInt(2, 5) };
    },
  },
  {
    text: '🎁 投資獲利，再骰一次！',
    apply(player, opponent) { return { extraRoll: true }; },
  },
  {
    text: '🎁 中獎啦，獲得 $300！',
    apply(player, opponent) { player.addMoney(300); return {}; },
  },
  {
    text: '🎁 對手繳稅給你，對手後退 2 格！',
    apply(player, opponent) { return { moveOpponent: -2 }; },
  },
  {
    text: '🎁 對手因為忙著算數學，停一回合！',
    apply(player, opponent) { opponent.skipTurn = true; return {}; },
  },
];

// 陷阱事件（破財危機）
const TRAP_EVENTS = [
  {
    text: '💀 弄丟錢包，停一回合！',
    apply(player, opponent) { player.skipTurn = true; return {}; },
  },
  {
    text: '💀 被罰款 $150！',
    apply(player, opponent) { player.addMoney(-150); return {}; },
  },
  {
    text: '💀 生病了，回到起點！',
    apply(player, opponent) { return { moveTo: 0 }; },
  },
  {
    text: '💀 破產危機，後退 5 格！',
    apply(player, opponent) { return { move: -5 }; },
  },
];
