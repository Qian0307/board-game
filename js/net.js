// 網路層：以 PeerJS（WebRTC）建立點對點連線，讓兩地玩家畫面同步。
// 採「主機權威」架構——房主(host)跑遊戲邏輯，訪客(guest)只送出操作、依主機訊息更新畫面。
class NetManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    // 事件回呼（由 Game 設定）
    this.onData = null;   // 收到對方資料
    this.onOpen = null;   // 資料通道開啟（雙方連上）
    this.onClose = null;  // 連線關閉
    this.onError = null;  // 發生錯誤
  }

  // 產生 4 碼房號（去掉容易混淆的 0/O/1/I）
  static randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // 加上命名空間前綴，降低與其他人房號相撞的機率
  static peerId(code) {
    return 'moneymono-' + code;
  }

  // ===== 房主：建立房間，成功後透過 onCode 回傳房號 =====
  host(onCode) {
    if (typeof Peer === 'undefined') {
      if (this.onError) this.onError({ type: 'no-peerjs' });
      return;
    }
    this._tryHost(onCode, 0);
  }

  _tryHost(onCode, attempt) {
    const code = NetManager.randomCode();
    const peer = new Peer(NetManager.peerId(code), { debug: 1 });
    this.peer = peer;

    peer.on('open', () => onCode(code));
    peer.on('connection', (conn) => this._setupConn(conn));
    peer.on('error', (err) => {
      // 房號已被佔用就換一個重試（最多 5 次）
      if (err.type === 'unavailable-id' && attempt < 5) {
        peer.destroy();
        this._tryHost(onCode, attempt + 1);
      } else if (this.onError) {
        this.onError(err);
      }
    });
  }

  // ===== 訪客：以房號連上房主 =====
  join(code) {
    if (typeof Peer === 'undefined') {
      if (this.onError) this.onError({ type: 'no-peerjs' });
      return;
    }
    const peer = new Peer({ debug: 1 });
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(NetManager.peerId(code.toUpperCase()), { reliable: true });
      this._setupConn(conn);
    });
    peer.on('error', (err) => { if (this.onError) this.onError(err); });
  }

  _setupConn(conn) {
    this.conn = conn;
    conn.on('open', () => { if (this.onOpen) this.onOpen(); });
    conn.on('data', (data) => { if (this.onData) this.onData(data); });
    conn.on('close', () => { if (this.onClose) this.onClose(); });
    conn.on('error', (err) => { if (this.onError) this.onError(err); });
  }

  // 傳送訊息給對方
  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  get connected() {
    return !!(this.conn && this.conn.open);
  }

  close() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.conn = null;
    this.peer = null;
  }
}
