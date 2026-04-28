# Pikmin Postcard Board V3 — Firebase + 單一卡片分享

## 新增功能

1. 所有人看到同一份卡片資料
2. 所有人看到同一份愛心數
3. 不同用戶可各自點愛心，愛心數累加
4. 可分享單一卡片頁
5. 保留預覽模式，預覽模式不可刪除

## 必填：Firebase 設定

請打開：

js/firebaseConfig.js

把 Firebase Console 的 Web App config 貼上：

window.PIKMIN_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

## Firebase Firestore 建議資料庫

Cloud Firestore

Collection 名稱預設：

pikmin_postcards

可在 js/firebaseConfig.js 修改：

window.PIKMIN_FIREBASE_COLLECTION = "pikmin_postcards";

## 單一卡片分享

每張卡片有「分享」按鈕。

分享格式：

index.html?mode=preview&card=卡片ID

部署到 Vercel 後會變成：

https://你的網站.vercel.app/?mode=preview&card=卡片ID

## 開發測試

如果 Firebase config 還沒填，系統會自動退回 localStorage 測試模式。


## V3.1 更新：手機圖片壓縮穩定版

這版不使用 Firebase Storage，因此不用升級 Firebase 方案。

新增：
- 手機圖片自動壓縮
- 最大寬度 800px
- JPEG 品質 0.65
- 移除 localStorage fallback，改成 Firebase only
- 避免新增後卡片閃一下又消失

注意：
Firestore 單一文件仍有大小限制，因此這是「不升級 Storage」的穩定替代版。


## V3.2 更新：座標自動判定國家

輸入座標後會自動判定國家分類，例如：

- `(35.6103120,-115.3857610)` → 美國
- `35.6103120,-115.3857610` → 美國

目前使用前端離線座標範圍判斷，支援熱門分類：
全球、台灣、日本、香港、埃及、希臘、哥倫比亞、紐西蘭、阿根廷、杜拜、布拉格、斯洛維尼亞、英國、義大利、冰島、德國、土耳其、美國、韓國。

注意：這是輕量離線版，不會呼叫 Google Maps API。
