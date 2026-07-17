# 測試

用 [jsdom](https://github.com/jsdom/jsdom) 把 `index.html` 載進 Node，再讓「機器人玩家」自動點按鈕玩完整局，
所以測到的是**真的按鈕流程**，不是只呼叫內部函式。

## 怎麼跑

```bash
cd tests
npm install     # 只需第一次（裝 jsdom）
npm test        # 三個測試全跑
```

也可以單獨跑：

```bash
node test-local.js    # 本機雙人：三種難度各玩一整局到結算
node test-online.js   # 線上模式：host + guest 兩個視窗，比對兩端狀態是否一致
node test-rules.js    # 規則定點驗證：獎懲金額、過路費、幸運事件、題庫答案
```

## 檔案

| 檔案 | 測什麼 |
|---|---|
| `harness.js` | 共用骨架：建立 jsdom 視窗、stub 音效、機器人玩家 `runBot()` |
| `test-local.js` | 本機雙人整局（easy 全對／middle 半對／hard 全錯），檢查不會當掉、能正常結算 |
| `test-online.js` | 假的 net 橋接兩個視窗，驗證位置／現金／地產／結算在兩端完全一致 |
| `test-rules.js` | 答對獎金、答錯罰款、破產付租金不憑空生錢、繳稅事件會轉錢、題庫 6000 題答案皆為非負整數 |

## 注意

- 測試會把 `UI.wait` 換成立即回傳，所以跑得比實際遊玩快很多。
- `test-online.js` **不測 PeerJS 本身**（那需要真的網路），只測收到訊息後的同步邏輯。
  真的連線要開兩個瀏覽器分頁手動試。
