// 玩家資料模型
class Player {
  constructor(name, tokenEmoji, index) {
    this.name = name;
    this.token = tokenEmoji;
    this.index = index;
    this.money = 1500; // 初始資產（開局由 Game 設定，這裡與地產玩法本金一致）
    this.position = 0;
    this.skipTurn = false;
    // 統計資料
    this.stats = { rolls: 0, correct: 0, wrong: 0 };
  }

  // 移動位置（繞圈棋盤：走到最後一格會繞回起點，前進後退都循環）
  moveBy(steps, boardSize) {
    this.position = ((this.position + steps) % boardSize + boardSize) % boardSize;
  }

  // 增減資產，資產不會低於 0（避免出現負資產）
  addMoney(amount) {
    this.money = Math.max(0, this.money + amount);
  }

  formattedMoney() {
    return '$' + this.money.toLocaleString('en-US');
  }
}
