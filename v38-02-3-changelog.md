# Pikmin Collection V38-02 優化與修正紀錄

本次更新專注於 **「極致流暢度」**、**「圖片載入穩定性」** 以及 **「全球化判定準確度」**。

---

## 1. 效能與動畫優化 (Performance & Animation)
*   **側邊欄 GPU 加速**：將側邊欄開關的動畫從消耗效能的 `width` 與 `margin-left` 修改為 GPU 加速的 `transform: translateX()`。
*   **消除冗餘監聽器**：
    *   移除了 `app.js` 中重複呼叫的 `bindTagFilterButtons()`。
    *   在 `storage.js` 中加入了 `window.isPostcardListenerStarted` 旗標，確保 Firebase 監聽器在任何情況下都只會啟動一個，防止記憶體洩漏與「越用越卡」的問題。
*   **預連線技術 (Preconnect)**：在 `index.html` 加入了對 Firebase Storage 的預連線標籤，縮短圖片載入前的 DNS 與連線耗時。

## 2. 圖片載入穩定性 (Image Stability)
*   **消除佈局抖動 (CLS)**：
    *   為 `.postcard-photo`（首頁網格）與 `.modal-image-wrap`（詳情彈窗）加入了固定的 `aspect-ratio: 1/1`。
    *   為「今日精選」卡片加入了 `aspect-ratio: 16/9`。
*   **防止圖片變形**：強制圖片使用 `object-fit: cover` 並設定為 `display: block`，確保圖片在載入完成前不會產生短暫的拉伸或比例失真。
*   **長效快取策略**：在 `storage.js` 的上傳邏輯中加入了 `Cache-Control: public,max-age=31536000`。新上傳的圖片將會被瀏覽器強行快取一年，實現二次造訪時的「秒開」。

## 3. 今日精選修正 (Featured Card Fix)
*   **顯示回歸**：修正了初始化流程中 `updateFeaturedCard()` 的順序，確保資料變動時能即時更新。
*   **精準判定**：在 `storage.js` 中實作了更嚴密的資料比對機制（比對 ID 組合與總點讚數），確保 UI 刷新時不會誤判導致卡片消失。

## 4. 全球化判定增強 (Location Detection)
*   **ISO 國家代碼映射**：引入 `ISO_COUNTRY_MAP` 對應表（如 `za` -> `南非`），解決 OSM API 在不同語系下回傳名稱不統一的問題。
*   **邊界判定補全**：在 `locationParser.js` 中手動補齊了「南非」的座標邊界（Bounding Box），大幅提升偏遠地區的判定準確率。
*   **API 整合**：更新 `fetchReverseGeocode` 函式，使其能正確傳遞 `country_code` 參數。

---

## 修改檔案清單
- `index.html`: 加入 Preconnect 標籤。
- `css/v33-sidebar.css`: 側邊欄 GPU 動畫優化、精選卡片比例穩定。
- `css/v30-final.css`: 首頁網格圖片比例穩定優化。
- `css/v28-modal.css`: 詳情彈窗圖片比例穩定優化。
- `js/app.js`: 移除重複邏輯、優化初始化流程。
- `js/storage.js`: 加入上傳快取設定、監聽器唯一旗標、精準資料比對。
- `js/locationParser.js`: 新增國家映射表與座標邊界。

---
*文件更新日期：2026-05-08*
