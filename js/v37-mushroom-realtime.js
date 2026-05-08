(function() {
    "use strict";

    const TASKS_COLL = "mushroomTasks";
    const APPS_COLL = "mushroomApplications";
    const CLEANUP_MS = 3 * 60 * 60 * 1000; // 設定為 3 小時，確保任務不會在 3 小時內提早消失

    // 蘑菇選單定義
    const MUSHROOM_TYPES = {
        "顏色蘑菇": ["紅蘑菇", "黃蘑菇", "藍蘑菇", "紫蘑菇", "白蘑菇", "粉紅蘑菇", "灰色蘑菇", "冰藍蘑菇"],
        "屬性蘑菇": ["火蘑菇", "水蘑菇", "電蘑菇", "毒蘑菇", "水晶蘑菇"],
        "特殊": ["活動蘑菇", "巨大活動蘑菇"]
    };
    const MUSHROOM_SIZES = ["一般", "大", "小"];

    let mushroomTasks = [];
    let myTasks = [];
    let db = null;
    let myApplications = [];
    let unsubscribeTasks = null;
    let unsubscribeApps = null;

    // --- 初始化 ---
    function init() {
        // 建立 UI 骨架與彈窗
        createBarSkeleton();
        createModals();
        
        if (window.firebase && firebase.apps.length) {
            db = firebase.firestore();
            handleVisibilitySync();
        } else {
            // 優化：縮短檢查頻率 (1000ms -> 200ms)，讓手機版初始化更快
            const checkFB = setInterval(() => {
                if (window.firebase && firebase.apps.length) {
                    db = firebase.firestore();
                    handleVisibilitySync();
                    clearInterval(checkFB);
                }
            }, 200);
        }
    }

    // 當分頁隱藏時停止監聽，回來時重啟 (關鍵優化：節省背景讀取)
    function handleVisibilitySync() {
        const sync = () => {
            if (document.visibilityState === 'visible') {
                startAllListeners();
            } else {
                stopAllListeners();
            }
        };
        document.addEventListener('visibilitychange', sync);
        sync();
    }

    function startAllListeners() {
        if (!db) return;
        listenToTasks();
        listenToMyApplications();
        startAutoCleanupTimer();
    }

    function stopAllListeners() {
        if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
        if (unsubscribeApps) { unsubscribeApps(); unsubscribeApps = null; }
        stopAutoCleanupTimer();
    }

    let cleanupTimer = null;
    function startAutoCleanupTimer() {
        if (cleanupTimer) clearInterval(cleanupTimer);
        cleanupTimer = setInterval(checkAndAutoDeleteTasks, 30000); // 每 30 秒檢查一次
    }

    function stopAutoCleanupTimer() {
        if (cleanupTimer) clearInterval(cleanupTimer);
        cleanupTimer = null;
    }

    async function checkAndAutoDeleteTasks() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const now = Date.now();
        const THREE_MINS = 3 * 60 * 1000;
        const EXPIRE_MS = 3 * 60 * 60 * 1000;

        // 1. 處理「額滿超過 3 分鐘」 (基於目前已抓取的資料，反應較快)
        const fullTasks = mushroomTasks.filter(t => {
            if (t.ownerId !== user.uid) return false;
            const isFull = (t.status === 'full' || t.needed <= 0);
            if (!isFull) return false;
            
            const timeToCheck = t.fullAt || t.createdAt;
            return (now - timeToCheck > THREE_MINS);
        });
        for (const t of fullTasks) {
            // console.log(`[AutoCleanup] 任務額滿超過 3 分鐘，自動刪除: ${t.id}`);
            await db.collection(TASKS_COLL).doc(t.id).delete();
        }

        // 2. 處理「發佈超過 3 小時」 (去資料庫抓取，處理那些被 CLEANUP_MS 過濾器擋掉的老舊資料)
        try {
            const oldTasksSnap = await db.collection(TASKS_COLL)
                .where('ownerId', '==', user.uid)
                .where('createdAt', '<', now - EXPIRE_MS)
                .get();
            
            for (const doc of oldTasksSnap.docs) {
                // console.log(`[AutoCleanup] 任務發佈超過 3 小時，自動刪除: ${doc.id}`);
                await db.collection(TASKS_COLL).doc(doc.id).delete();
            }
        } catch (e) {
            console.error("[AutoCleanup] 3小時清理失敗:", e);
        }
    }

    // --- UI: 升級現有的情報條 ---
    function createBarSkeleton() {
        const existingBar = document.getElementById('mushroomInfoBar');
        if (!existingBar) {
            console.warn("找不到 mushroomInfoBar，正在嘗試搜尋標題...");
            // 備選方案：根據內容搜尋
            const titles = document.querySelectorAll('.mushroom-info-title');
            titles.forEach(t => {
                if (t.textContent.includes('即時蘑菇情報')) {
                    upgradeBar(t.parentElement);
                }
            });
            return;
        }
        upgradeBar(existingBar);
    }

    function upgradeBar(el) {
        if (el.dataset.v37Ready) return; // 防止重複執行
        el.dataset.v37Ready = "true";
        
        el.innerHTML = '';
        el.id = "v37MushroomRealtimeBar";
        el.innerHTML = `
            <div class="mr-bar-header">
                <div class="mr-bar-title">🍄 即時蘑菇情報</div>
                <div class="mr-bar-actions">
                    <button class="mr-btn mr-btn-publish" id="mrPublishBtn">＋發佈</button>
                    <button class="mr-btn mr-btn-my" id="mrMyTasksBtn">
                        我的任務 <span id="mrNotifDot" class="mr-notif-dot" style="display:none;">0</span>
                    </button>
                    <button class="mr-btn" id="mrReportBtn" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca;">回報</button>
                </div>
            </div>
            <div class="mr-task-scroller" id="mrTaskScroller">
                <div style="color:#9ca3af; font-size:12px; padding:10px;">載入情報中...</div>
            </div>
            <div style="font-size: 10px; color: #9ca3af; margin-top: 2px; text-align: right; opacity: 0.8;">✨= 未標示星數 /  ※ 額滿 3 分鐘或發佈 3 小時後自動刪除</div>
        `;

        // 重新綁定按鈕
        setTimeout(() => {
            const pubBtn = document.getElementById('mrPublishBtn');
            const myBtn = document.getElementById('mrMyTasksBtn');
            const reportBtn = document.getElementById('mrReportBtn');
            if (pubBtn) pubBtn.onclick = () => openModal('publish');
            if (myBtn) myBtn.onclick = () => openModal('myTasks');
            if (reportBtn) reportBtn.onclick = () => openModal('report');
        }, 100);
    }

    // --- UI: 彈窗 HTML ---
    function createModals() {
        if (document.getElementById('v37MushroomModals')) return;
        const wrap = document.createElement('div');
        wrap.id = "v37MushroomModals";
        wrap.innerHTML = `
            <!-- 發佈彈窗 -->
            <div id="mrModalPublish" class="mr-modal-backdrop">
                <div class="mr-modal-panel">
                    <div class="mr-modal-header"><h3>發佈蘑菇情報</h3><button class="mr-modal-close">×</button></div>
                    <div class="mr-modal-content">
                        <div class="mr-form-group">
                            <label class="mr-form-label">蘑菇類型</label>
                            <div style="display:flex; gap:8px;">
                                <select id="mrInputSize" class="mr-form-select" style="flex:1;">
                                    ${MUSHROOM_SIZES.map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                                <select id="mrInputType" class="mr-form-select" style="flex:2;">
                                    ${Object.entries(MUSHROOM_TYPES).map(([cat, types]) => `
                                        <optgroup label="${cat}">
                                            ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
                                        </optgroup>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="mr-form-group">
                            <div style="display:flex; gap:10px;">
                                <div style="flex:1;">
                                    <label class="mr-form-label">缺幾人</label>
                                    <input id="mrInputNeeded" type="number" class="mr-form-input" value="3" min="1" max="4">
                                </div>
                                <div style="flex:1;">
                                    <label class="mr-form-label">星數</label>
                                    <select id="mrInputStars" class="mr-form-select">
                                        <option value="0" selected>未標示</option>
                                        <option value="1">1星</option>
                                        <option value="2">2星</option>
                                        <option value="3">3星</option>
                                        <option value="4">4星</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">票券</label>
                            <select id="mrInputTicket" class="mr-form-select">
                                <option value="免券">免券</option>
                                <option value="需券">需券</option>
                            </select>
                        </div>
                        <div class="mr-form-group">
                            <div style="display: flex; gap: 10px;">
                                <div style="flex: 1;">
                                    <label class="mr-form-label">戰力需求</label>
                                    <input type="text" id="mrPublishPower" class="mr-form-input" placeholder="例: 1000">
                                </div>
                                <div style="flex: 1;">
                                    <label class="mr-form-label">備註</label>
                                    <input type="text" id="mrPublishNote" class="mr-form-input" placeholder="例: 剩2小時">
                                </div>
                            </div>
                        </div>

                        <div class="mr-form-group">
                            <label class="mr-form-label">發佈者暱稱</label>
                            <input type="text" id="mrPublishName" class="mr-form-input" placeholder="輸入您的名稱">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">模式</label>
                            <div class="mr-mode-tabs">
                                <div class="mr-mode-tab active" data-mode="fly">📍自飛</div>
                                <div class="mr-mode-tab" data-mode="invite">📨邀請</div>
                            </div>
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">座標</label>
                            <input id="mrInputCoords" type="text" class="mr-form-input" placeholder="">
                        </div>
                        <button id="mrSubmitPublish" class="mr-btn mr-btn-publish" style="width:100%; justify-content:center; min-height:44px; font-size:15px; font-weight:600; margin-top:20px; margin-bottom:10px;">發佈情報</button>
                    </div>
                </div>
            </div>

            <!-- 申請彈窗 -->
            <div id="mrModalApply" class="mr-modal-backdrop">
                <div class="mr-modal-panel">
                    <div class="mr-modal-header"><h3>申請加入任務</h3><button class="mr-modal-close">×</button></div>
                    <div class="mr-modal-content">
                        <div id="mrApplyTaskInfo" style="margin-bottom:15px; padding:12px; background:#f4fbf3; border-radius:12px; font-size:14px;"></div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">你的暱稱</label>
                            <input id="mrApplyNick" type="text" class="mr-form-input" placeholder="">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">你的 Pikmin 邀請碼</label>
                            <input id="mrApplyInvite" type="text" class="mr-form-input" placeholder="">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">備註</label>
                            <input id="mrApplyNote" type="text" class="mr-form-input" placeholder="">
                        </div>
                        <button id="mrSubmitApply" class="mr-btn mr-btn-publish" style="width:100%; justify-content:center; min-height:44px; font-size:15px; font-weight:600;">送出申請</button>
                    </div>
                </div>
            </div>

            <!-- 我的任務彈窗 -->
            <div id="mrModalMyTasks" class="mr-modal-backdrop">
                <div class="mr-modal-panel" style="max-width:550px;">
                    <div class="mr-modal-header"><h3>我的任務管理</h3><button class="mr-modal-close">×</button></div>
                    <div class="mr-modal-content" id="mrMyTasksContent">
                        <div style="color:#9ca3af; text-align:center; padding:20px;">目前沒有發佈中的任務</div>
                    </div>
                </div>
            </div>
            
            <!-- 回報錯誤彈窗 -->
            <div id="mrModalReport" class="mr-modal-backdrop">
                <div class="mr-modal-panel">
                    <div class="mr-modal-header"><h3>回報錯誤/問題</h3><button class="mr-modal-close">×</button></div>
                    <div class="mr-modal-content">
                        <div class="mr-form-group">
                            <label class="mr-form-label">問題類型</label>
                            <select id="mrInputReportType" class="mr-form-select">
                                <option value="情報錯誤">情報內容錯誤/已結束</option>
                                <option value="座標失效">座標失效/無法飛行</option>
                                <option value="惡意行為">發佈者惡意行為</option>
                                <option value="程式錯誤">網頁功能 Bug/錯誤</option>
                                <option value="其他">其他建議</option>
                            </select>
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">具體說明</label>
                            <textarea id="mrInputReportDesc" class="mr-form-input" style="min-height:100px; resize:none;" placeholder="請詳細描述問題，若針對特定任務請註明任務內容..."></textarea>
                        </div>
                        <button id="mrSubmitReport" class="mr-btn mr-btn-publish" style="width:100%; background:#ef4444; justify-content:center; min-height:44px; font-size:15px; font-weight:600;">送出通報</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrap);

        // 綁定基本事件
        wrap.querySelectorAll('.mr-modal-close').forEach(btn => {
            btn.onclick = () => closeAllModals();
        });
        wrap.querySelectorAll('.mr-modal-backdrop').forEach(bd => {
            bd.onclick = (e) => { 
                if(e.target === bd) {
                    // 如果是發佈視窗，不允許點擊背景關閉，防止資料遺失
                    if (bd.id === "mrModalPublish") return; 
                    closeAllModals(); 
                }
            };
        });

        // 模式切換
        const tabs = wrap.querySelectorAll('.mr-mode-tab');
        const coordsInput = document.getElementById('mrInputCoords');
        tabs.forEach(t => {
            t.onclick = () => {
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                
                // 邀請模式禁用座標
                if (coordsInput) {
                    const isInvite = t.dataset.mode === 'invite';
                    coordsInput.disabled = isInvite;
                    coordsInput.style.opacity = isInvite ? "0.5" : "1";
                    coordsInput.style.background = isInvite ? "#f3f4f6" : "#f9fafb";
                    coordsInput.style.cursor = isInvite ? "not-allowed" : "text";
                    if (isInvite) {
                        coordsInput.value = "";
                        coordsInput.placeholder = "邀請模式免填座標";
                    } else {
                        coordsInput.placeholder = "";
                    }
                }
            };
        });

        document.getElementById('mrSubmitPublish').onclick = submitTask;
        document.getElementById('mrSubmitApply').onclick = submitApplication;
        document.getElementById('mrSubmitReport').onclick = submitReport;

        // 特殊蘑菇禁用大小選單 / 屬性蘑菇禁用「小」選項
        const typeSelect = document.getElementById('mrInputType');
        const sizeSelect = document.getElementById('mrInputSize');
        if (typeSelect && sizeSelect) {
            typeSelect.onchange = () => {
                const val = typeSelect.value;
                const isSpecial = MUSHROOM_TYPES["特殊"].includes(val);
                const isElemental = MUSHROOM_TYPES["屬性蘑菇"].includes(val);

                // 1. 處理「特殊蘑菇」：完全禁用大小選單
                sizeSelect.disabled = isSpecial;
                sizeSelect.style.opacity = isSpecial ? "0.5" : "1";
                sizeSelect.style.cursor = isSpecial ? "not-allowed" : "default";
                if (isSpecial) {
                    sizeSelect.value = "一般";
                    return; // 特殊蘑菇處理完畢
                }

                // 2. 處理「屬性蘑菇」：僅禁用「小」選項
                Array.from(sizeSelect.options).forEach(opt => {
                    if (opt.value === "小") {
                        opt.disabled = isElemental;
                        if (isElemental && sizeSelect.value === "小") {
                            sizeSelect.value = "一般";
                        }
                    }
                });
            };
        }
    }

    // --- 邏輯: 任務監聽 ---
    function listenToTasks() {
        if (unsubscribeTasks) unsubscribeTasks();
        const now = Date.now();
        const startTime = now - CLEANUP_MS;

        const startTaskListener = () => {
          if (unsubscribeTasks) unsubscribeTasks();
          unsubscribeTasks = db.collection(TASKS_COLL)
            .where('createdAt', '>', startTime)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot(snap => {
              mushroomTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              renderTaskBar();
            }, error => {
              console.warn("Mushroom tasks snapshot error, retrying...", error);
              setTimeout(startTaskListener, 5000);
            });
        };
        startTaskListener();
    }

    // --- 邏輯: 申請紅點監聽 ---
    function listenToMyApplications() {
        if (unsubscribeApps) unsubscribeApps();
        firebase.auth().onAuthStateChanged(user => {
            if (!user) return;
            // 監聽所有身為「發佈者」收到的申請 (用於管理面板)
            unsubscribeApps = db.collection(APPS_COLL)
              .where('ownerId', '==', user.uid)
              .limit(100)
              .onSnapshot(snap => {
                myApplications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // 更新紅點 (僅計算「尚未額滿」且「待處理」的申請)
                const pendingApps = myApplications.filter(a => {
                    if (a.status !== 'pending') return false;
                    const task = mushroomTasks.find(t => t.id === a.taskId);
                    if (!task) return false; // 如果找不到任務（可能已刪除或過期），則不計入通知
                    const isFull = task.needed <= 0 || task.status === 'full';
                    return !isFull;
                });
                
                const pendingCount = pendingApps.length;
                const dot = document.getElementById('mrNotifDot');
                if (dot) {
                    dot.textContent = pendingCount;
                    dot.style.display = pendingCount > 0 ? 'flex' : 'none';
                }
                
                renderMyTasks();
            });
        });
    }

    // --- UI: 渲染情報條 ---
    function renderTaskBar() {
        const scroller = document.getElementById('mrTaskScroller');
        if (!scroller) return;

        const now = Date.now();
        const THREE_MINS = 3 * 60 * 1000;
        const EXPIRE_MS = 3 * 60 * 60 * 1000;

        // [優化] 在渲染前進行過濾：隱藏額滿超過 3 分鐘或發佈超過 3 小時的任務
        const displayTasks = mushroomTasks.filter(t => {
            const isFull = t.needed <= 0 || t.status === 'full';
            if (isFull) {
                // 如果有記錄額滿時間，就看額滿時間；若無（舊資料），則看發佈時間
                const timeToCheck = t.fullAt || t.createdAt;
                if (now - timeToCheck > THREE_MINS) return false;
            }
            if (now - t.createdAt > EXPIRE_MS) return false;
            return true;
        });

        if (displayTasks.length === 0) {
            scroller.innerHTML = `<div style="color:#9ca3af; font-size:12px; padding:10px;">目前暫無情報，快來發佈第一個吧！</div>`;
            return;
        }

        scroller.innerHTML = displayTasks.map(t => {
            const isFull = t.needed <= 0 || t.status === 'full';
            const timeStr = formatTime(t.createdAt);
            const displayNeeded = isFull ? "已滿" : `缺${t.needed}`;
            const icon = isFull ? "🔒" : (t.mode === 'fly' ? "📍" : "📨");
            const modeText = isFull ? "" : (t.mode === 'fly' ? "自飛" : "邀請");

            // 特殊蘑菇不顯示大小
            const isSpecial = MUSHROOM_TYPES["特殊"].includes(t.type);
            const displayType = isSpecial ? t.type : `${t.size}${t.type}`;

            const starVal = parseInt(t.stars || 0);
            const starsDisplay = starVal > 0 ? '⭐'.repeat(starVal) : '✨';
            const noteDisplay = t.note ? `<div style="font-size:11px; color:#3b82f6;">📝 ${t.note}</div>` : "";

            return `
                <div class="mr-task-card ${isFull ? 'full' : ''}" onclick="handleTaskClick('${t.id}')" title="${t.note ? '備註：' + t.note : '點擊查看詳情'}">
                    <span style="color:#f97316;">${starsDisplay}</span>
                    <span class="mr-task-type">${displayType}</span> / 
                    <span class="mr-task-needed">${displayNeeded}</span> / 
                    <span>${t.ticket}</span> / 
                    <span>限${t.power}</span> / 
                    <span class="mr-task-mode ${t.mode}">${icon} ${modeText}</span>
                    <span class="mr-task-time">${timeStr}</span>
                    ${noteDisplay}
                </div>
            `;
        }).join('');
    }

    // --- 邏輯: 點擊任務卡片 ---
    window.handleTaskClick = function(id) {
        const t = mushroomTasks.find(x => x.id === id);
        if (!t) return;

        if (t.needed <= 0 || t.status === 'full') {
            alert("該任務已額滿囉！");
            return;
        }

        const user = firebase.auth().currentUser;
        if (user && t.ownerId === user.uid) {
            alert("這是您自己發佈的任務唷！請至「我的任務」管理申請名單。");
            return;
        }

        if (t.mode === 'fly') {
            const coords = t.coords || "";
            if (coords) {
                navigator.clipboard.writeText(coords).then(() => {
                    alert(`📍 自飛任務：座標已複製！\n${coords}\n請前往遊戲內飛過去。`);
                });
            } else {
                alert("該任務未提供座標。");
            }
        } else {
            // 邀請模式：開啟申請彈窗
            const isSpecial = MUSHROOM_TYPES["特殊"].includes(t.type);
            const displayType = isSpecial ? t.type : `${t.size}${t.type}`;
            
            const info = document.getElementById('mrApplyTaskInfo');
            const ownerNameDisplay = t.ownerName ? `<br><span style="font-size:12px; color:#6b7280;">發佈者：${t.ownerName}</span>` : "";
            const starVal = parseInt(t.stars || 0);
            const starsStr = starVal > 0 ? '⭐'.repeat(starVal) : '✨';
            info.innerHTML = `${starsStr} ${displayType} / 缺${t.needed} / 限${t.power}${ownerNameDisplay}`;
            document.getElementById('mrSubmitApply').dataset.taskId = id;
            document.getElementById('mrSubmitApply').dataset.ownerId = t.ownerId;
            
            // 自動帶入當前用戶的暱稱與邀請碼
            const user = firebase.auth().currentUser;
            if (user) {
                document.getElementById('mrApplyNick').value = localStorage.getItem('pikmin_player_nickname') || "";
                // 這裡之後可以串接 V37 Auth 的資料
            }

            openModal('apply');
        }
    };

    // --- 邏輯: 發佈情報 ---
    async function submitTask() {
        const user = firebase.auth().currentUser;
        if (!user) { alert("系統尚未就緒，請稍後再試。"); return; }

        const ownerNick = document.getElementById('mrPublishName').value.trim();
        if (!ownerNick) {
            alert("請填寫發佈者暱稱唷！");
            document.getElementById('mrPublishName').focus();
            return;
        }

        const mode = document.querySelector('.mr-mode-tab.active').dataset.mode;
        const coords = document.getElementById('mrInputCoords').value.trim();

        // 驗證：若為自飛模式，座標為必填
        if (mode === 'fly' && !coords) {
            alert("📍 自飛模式必須填寫座標才能發佈唷！");
            document.getElementById('mrInputCoords').focus();
            return;
        }

        const starsInput = document.getElementById('mrInputStars');
        const starsValue = starsInput ? parseInt(starsInput.value) : 0;

        const data = {
            size: document.getElementById('mrInputSize').value,
            type: document.getElementById('mrInputType').value,
            needed: parseInt(document.getElementById('mrInputNeeded').value),
            stars: isNaN(starsValue) ? 0 : starsValue,
            ticket: document.getElementById('mrInputTicket').value,
            power: document.getElementById('mrPublishPower').value || "都可",
            note: document.getElementById('mrPublishNote').value || "",
            mode: mode,
            coords: coords,
            ownerId: user.uid,
            ownerName: ownerNick,
            status: 'active',
            createdAt: Date.now()
        };

        try {
            await db.collection(TASKS_COLL).add(data);
            alert("🍄 情報發佈成功！");
            closeAllModals();
        } catch (e) {
            alert("發佈失敗：" + e.message);
        }
    }

    // --- 邏輯: 送出申請 ---
    async function submitApplication() {
        const user = firebase.auth().currentUser;
        if (!user) { alert("請先登入再申請唷！"); return; }

        const btn = document.getElementById('mrSubmitApply');
        const taskId = btn.dataset.taskId;
        const ownerId = btn.dataset.ownerId;
        const nickname = document.getElementById('mrApplyNick').value.trim();
        const invite = document.getElementById('mrApplyInvite').value.trim();
        const note = document.getElementById('mrApplyNote').value.trim();

        if (!nickname || !invite) { alert("請填寫暱稱與邀請碼。"); return; }

        try {
            // [優化] 檢查是否已經申請過且尚未被拒絕
            const existing = await db.collection(APPS_COLL)
                .where('taskId', '==', taskId)
                .where('applicantId', '==', user.uid)
                .get();
            
            const activeApp = existing.docs.find(d => d.data().status !== 'rejected');
            if (activeApp) {
                const status = activeApp.data().status;
                if (status === 'pending') {
                    alert("您已經申請過這個任務囉！請耐心等候主人處理。");
                } else if (status === 'invited') {
                    alert("發佈者已經邀請過您了，請直接前往遊戲查看。");
                }
                return;
            }

            await db.collection(APPS_COLL).add({
                taskId, ownerId, applicantId: user.uid,
                nickname, invite, note,
                status: 'pending',
                createdAt: Date.now()
            });
            alert("📨 申請已送出！請靜候發起人邀請。");
            closeAllModals();
        } catch (e) {
            alert("申請失敗：" + e.message);
        }
    }

    // --- UI: 我的任務管理面板 ---
    function renderMyTasks() {
        const user = firebase.auth().currentUser;
        const panel = document.getElementById('mrMyTasksContent');
        if (!user || !panel) return;

        // 過濾出屬於我的任務
        const myTasks = mushroomTasks.filter(t => t.ownerId === user.uid);
        if (myTasks.length === 0) {
            panel.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:20px;">目前沒有發佈中的任務</div>`;
            return;
        }

        try {
            panel.innerHTML = myTasks.map(t => {
                const taskApps = (myApplications || []).filter(a => a.taskId === t.id);
                const isSpecial = MUSHROOM_TYPES["特殊"] && MUSHROOM_TYPES["特殊"].includes(t.type);
                const displayType = isSpecial ? t.type : `${t.size || ""}${t.type || ""}`;
                const isTaskFull = (t.needed || 0) <= 0 || t.status === 'full';
                const taskMode = t.mode || "fly";
                
                const starVal = parseInt(t.stars || 0);
                const starsDisplay = starVal > 0 ? '⭐'.repeat(starVal) : '✨';
                
                return `
                    <div style="border:1px solid #e1f0de; border-radius:16px; padding:15px; margin-bottom:15px; background:#fff;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                            <strong style="color:#4a6a43;">${starsDisplay} ${displayType} / 缺${t.needed || 0} / ${taskMode === 'fly' ? '📍自飛' : '📨邀請'}</strong>
                            <button onclick="deleteMushroomTask('${t.id}')" ${isTaskFull ? 'disabled' : ''} style="color:${isTaskFull ? '#9ca3af' : '#ef4444'}; border:0; background:none; cursor:${isTaskFull ? 'not-allowed' : 'pointer'}; font-size:12px;">撤回任務</button>
                        </div>
                        <div class="mr-applicant-list">
                            ${taskApps.length === 0 ? '<div style="font-size:12px; color:#9ca3af;">尚未有人申請</div>' : taskApps.map(a => `
                                <div class="mr-applicant-item">
                                    <div class="mr-applicant-info">
                                        <div style="display:flex; justify-content:space-between;">
                                            <b>${a.nickname || "未知"}</b>
                                            <span style="font-size:11px; color:${a.status==='invited'?'#10b981':'#f59e0b'}">${a.status==='invited'?'✅ 已邀請':'⏳ 待處理'}</span>
                                        </div>
                                        <div style="font-size:12px; color:#4b5563;">邀請碼：<code style="background:#eee; padding:2px 4px; border-radius:4px;">${a.invite || ""}</code></div>
                                        <div style="font-size:12px; color:#6b7280;">備註：${a.note || '無'}</div>
                                    </div>
                                    <div class="mr-applicant-actions" style="display:flex; gap:10px; margin-top:10px;">
                                        <button class="mr-btn-action mr-btn-done" ${(isTaskFull || a.status==='invited') ? 'disabled' : ''} onclick="handleApprove('${a.id}', '${t.id}')">
                                            ${a.status==='invited' ? '已處理' : '邀請'}
                                        </button>
                                        <button class="mr-btn-action mr-btn-reject" ${(isTaskFull || a.status==='invited') ? 'disabled' : ''} onclick="handleReject('${a.id}')">拒絕</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error("renderMyTasks error:", err);
            panel.innerHTML = `<div style="color:#ef4444; padding:20px;">載入管理介面出錯，請重新整理。</div>`;
        }
    }

    // --- 邏輯: 管理按鈕操作 ---
    window.handleApprove = async function(appId, taskId) {
        try {
            // 1. 更新申請狀態
            await db.collection(APPS_COLL).doc(appId).update({ status: 'invited' });
            
            // 2. 任務缺人數 -1
            const tRef = db.collection(TASKS_COLL).doc(taskId);
            let finalNeeded = 0;
            await db.runTransaction(async trans => {
                const snap = await trans.get(tRef);
                if (!snap.exists) throw "找不到任務資料";
                
                const currentNeeded = Number(snap.data().needed) || 0;
                finalNeeded = Math.max(0, currentNeeded - 1);
                
                const updateData = { 
                    needed: finalNeeded,
                    status: finalNeeded === 0 ? 'full' : 'active'
                };
                if (finalNeeded === 0) {
                    updateData.fullAt = Date.now();
                }
                trans.update(tRef, updateData);
            });
            console.log(`任務 ${taskId} 人數已更新為 ${finalNeeded}`);
            renderMyTasks();
        } catch (e) { 
            console.error("Approve Error:", e);
            alert("操作失敗：" + (e.message || e)); 
        }
    };

    window.handleReject = async function(appId) {
        if (!confirm("確定要拒絕此申請嗎？")) return;
        try {
            await db.collection(APPS_COLL).doc(appId).delete();
            renderMyTasks();
        } catch (e) { alert("操作失敗：" + e.message); }
    };

    window.deleteMushroomTask = async function(id) {
        if (!confirm("確定要撤回此情報嗎？")) return;
        try {
            // [優化] 先在本地移除，讓 UI 即時反映
            mushroomTasks = mushroomTasks.filter(t => t.id !== id);
            renderMyTasks();
            renderTaskBar();
            
            await db.collection(TASKS_COLL).doc(id).delete();
        } catch (e) { 
            console.error("Delete Error:", e);
            alert("撤回失敗"); 
        }
    };

    // --- 工具 ---
    function openModal(type) {
        closeAllModals();
        if (type === 'publish') {
            document.getElementById('mrModalPublish').classList.add('show');
            // 自動帶入暱稱
            const nickInput = document.getElementById('mrPublishName');
            if (nickInput) {
                const storedNick = (typeof PikminAuthGate !== 'undefined' && PikminAuthGate.getStoredNicknameForForm) 
                    ? PikminAuthGate.getStoredNicknameForForm() 
                    : (localStorage.getItem('pikmin_player_nickname') || "");
                nickInput.value = storedNick;
            }
        }
        if (type === 'apply') document.getElementById('mrModalApply').classList.add('show');
        if (type === 'myTasks') {
            document.getElementById('mrModalMyTasks').classList.add('show');
            renderMyTasks();
        }
        if (type === 'report') document.getElementById('mrModalReport').classList.add('show');
        document.body.classList.add('modal-open');
    }

    async function submitReport() {
        const user = firebase.auth().currentUser;
        const type = document.getElementById('mrInputReportType').value;
        const desc = document.getElementById('mrInputReportDesc').value.trim();

        if (!desc) { alert("請填寫具體說明唷！"); return; }

        try {
            await db.collection("mushroomReports").add({
                type, desc,
                uid: user ? user.uid : "anonymous",
                createdAt: Date.now()
            });
            alert("⚠️ 通報已送出，管理員會盡快處理，感謝回報！");
            document.getElementById('mrInputReportDesc').value = "";
            closeAllModals();
        } catch (e) {
            alert("通報失敗：" + e.message);
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.mr-modal-backdrop').forEach(m => m.classList.remove('show'));
        document.body.classList.remove('modal-open');
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // 當頁面載入完成後啟動
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 強力監控：防止其他腳本延遲渲染導致抓不到 (頻率調快 2000ms -> 500ms，但成功後立即停止)
    let retryCount = 0;
    const retryInterval = setInterval(() => {
        const isReady = !!document.getElementById('v37MushroomRealtimeBar');
        if (isReady) {
            clearInterval(retryInterval);
            return;
        }
        createBarSkeleton();
        retryCount++;
        if (retryCount > 10) clearInterval(retryInterval); 
    }, 500);

})();
