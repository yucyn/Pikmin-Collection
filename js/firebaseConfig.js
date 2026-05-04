// Firebase 設定檔
// 請只修改這個檔案，把 Firebase Console 的 Web App config 貼進來。

window.PIKMIN_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZDSSH1IPKg5f0H59Rs7cuI_UfgpHfZ7E",
  authDomain: "pikmin-collection.firebaseapp.com",
  projectId: "pikmin-collection",
  storageBucket: "pikmin-collection.firebasestorage.app",
  messagingSenderId: "727063039400",
  appId: "1:727063039400:web:10ca96f30693d9c671e19d"
};

// 管理員：Google 登入後的 Firebase Auth UID（可複數，逗號分隔追加）
window.PIKMIN_ADMIN_UIDS = [
  "am42ZiJikLNEt8RSsWipgBDj4h32"
];

/**
 * （選用）玩家遊戲邀請碼白名單：不設定或保持註解＝任意 12 碼純數字（0–9）皆可，例如 012345678901。
 * 若改為非空陣列，則只允許列出的 12 碼（發放控管用）。
 */
// window.PIKMIN_GAME_INVITE_CODES = [ "123456789012" ];
