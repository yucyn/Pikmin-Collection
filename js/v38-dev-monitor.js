/**
 * Pikmin Collection - Developer Monitoring Dashboard (V38)
 * 功能：提供管理員一個「齒輪按鈕」，點擊後開啟即時監控面板，不需進入彈窗即可看到所有動態。
 */
(function() {
    "use strict";

    let db = null;
    let auth = null;
    let isAdmin = false;

    // --- 初始化 ---
    function init() {
        const checkFB = setInterval(() => {
            if (window.firebase && firebase.apps.length) {
                db = firebase.firestore();
                auth = firebase.auth();
                clearInterval(checkFB);
                startAdminCheck();
            }
        }, 500);
    }

    function startAdminCheck() {
        auth.onAuthStateChanged(user => {
            const adminUids = window.PIKMIN_ADMIN_UIDS || ["am42ZiJikLNEt8RSsWipgBDj4h32"];
            isAdmin = Boolean(user && !user.isAnonymous && adminUids.includes(user.uid));
            
            if (isAdmin) {
                renderMonitorUI();
                startListeners();
            } else {
                removeMonitorUI();
            }
        });
    }

    // --- UI 渲染 ---
    function renderMonitorUI() {
        if (document.getElementById('devMonitorGear')) return;

        // 1. 注入 CSS
        const style = document.createElement('style');
        style.id = "devMonitorStyles";
        style.textContent = `
            #devMonitorGear {
                position: fixed;
                bottom: 112px;
                right: 12px;
                width: 44px;
                height: 44px;
                background: rgba(255, 255, 255, 0.25);
                backdrop-filter: blur(15px) saturate(150%);
                -webkit-backdrop-filter: blur(15px) saturate(150%);
                color: #4a6741;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 10001;
                box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.4);
                font-size: 22px;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            #devMonitorGear:hover {
                transform: rotate(180deg) scale(1.1);
                background: rgba(255, 255, 255, 0.4);
                box-shadow: 0 12px 40px rgba(31, 38, 135, 0.25);
                color: #5d8252;
            }
            #devMonitorPanel {
                position: fixed;
                bottom: 165px;
                right: 12px;
                width: 280px;
                max-height: 500px;
                background: rgba(255, 255, 255, 0.35);
                backdrop-filter: blur(25px) saturate(200%);
                -webkit-backdrop-filter: blur(25px) saturate(200%);
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 24px;
                z-index: 10000;
                display: none;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.1);
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #devMonitorPanel.show {
                display: flex;
                animation: devSlideIn 0.5s cubic-bezier(0.19, 1, 0.22, 1);
            }
            @keyframes devSlideIn {
                from { opacity: 0; transform: translateY(40px) scale(0.9); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .dev-mon-header {
                padding: 14px 20px;
                background: linear-gradient(135deg, rgba(120, 201, 107, 0.4), rgba(74, 103, 65, 0.4));
                color: #2d4128;
                font-weight: 700;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }
            .dev-mon-content {
                padding: 8px 0;
                overflow-y: auto;
                flex: 1;
            }
            .dev-mon-section {
                padding: 12px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .dev-mon-title {
                font-size: 10px;
                color: #4a6741;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 1.1px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                opacity: 0.8;
            }
            .dev-mon-item {
                font-size: 12px;
                margin-bottom: 10px;
                padding: 10px 12px;
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.4);
                box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                transition: all 0.3s ease;
                backdrop-filter: blur(5px);
            }
            .dev-mon-item:hover {
                transform: translateX(4px) scale(1.02);
                background: rgba(255, 255, 255, 0.6);
                box-shadow: 0 8px 20px rgba(0,0,0,0.05);
            }
            .dev-mon-item.msg { border-left: 4px solid rgba(95, 175, 255, 0.7); }
            .dev-mon-item.app { border-left: 4px solid rgba(249, 115, 22, 0.7); }
            .dev-mon-item.card { border-left: 4px solid rgba(120, 201, 107, 0.7); }
            .dev-mon-item:last-child { margin-bottom: 0; }
            .dev-stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            .dev-stat-box {
                background: rgba(255, 255, 255, 0.25);
                padding: 12px 8px;
                border-radius: 18px;
                text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.4);
                transition: transform 0.2s;
            }
            .dev-stat-box:hover {
                transform: translateY(-2px);
                background: rgba(255, 255, 255, 0.4);
            }
            .dev-stat-val {
                font-size: 20px;
                font-weight: 900;
                color: #2d4128;
                text-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .dev-stat-lbl {
                font-size: 9px;
                color: #4a6741;
                font-weight: 700;
                margin-top: 4px;
                opacity: 0.7;
            }
            .dev-copy-btn {
                font-size: 9px;
                background: rgba(120, 201, 107, 0.3);
                color: #2d4128;
                border: 1px solid rgba(255, 255, 255, 0.5);
                padding: 3px 8px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 6px;
                display: inline-block;
                font-weight: 700;
                backdrop-filter: blur(5px);
            }
            .dev-copy-btn:hover { background: rgba(120, 201, 107, 0.5); }
        `;
        document.head.appendChild(style);

        // 2. 建立齒輪按鈕
        const gear = document.createElement('div');
        gear.id = "devMonitorGear";
        gear.innerHTML = "⚙️";
        gear.title = "開發者監控面板";
        gear.onclick = togglePanel;
        document.body.appendChild(gear);

        // 3. 建立面板
        const panel = document.createElement('div');
        panel.id = "devMonitorPanel";
        panel.innerHTML = `
            <div class="dev-mon-header">
                <span>🛠️ 實時監控牆</span>
                <span style="font-size:10px; opacity:0.8;">Admin Only</span>
            </div>
            <div class="dev-mon-content">
                <div class="dev-mon-section">
                    <div class="dev-mon-title"><span>系統狀態</span></div>
                    <div class="dev-stats-grid" style="grid-template-columns: repeat(2, 1fr);">
                        <div class="dev-stat-box"><div class="dev-stat-val" id="monStatOnline">0</div><div class="dev-stat-lbl">在線人數</div></div>
                        <div class="dev-stat-box"><div class="dev-stat-val" id="monStatTasks">0</div><div class="dev-stat-lbl">發佈中任務</div></div>
                        <div class="dev-stat-box"><div class="dev-stat-val" id="monStatPending">0</div><div class="dev-stat-lbl">待處理申請</div></div>
                        <div class="dev-stat-box"><div class="dev-stat-val" id="monStatReview">0</div><div class="dev-stat-lbl">卡片待審核</div></div>
                    </div>
                </div>
                <div class="dev-mon-section">
                    <div class="dev-mon-title"><span>即時動態 (Feed)</span></div>
                    <div style="margin-bottom: 8px; display: flex; gap: 4px;">
                        <input type="text" id="monSearchUid" placeholder="搜尋 UID..." style="flex: 1; font-size: 11px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px;">
                        <button onclick="searchByUid()" style="font-size: 11px; padding: 4px 8px; cursor: pointer; background: #78c96b; color: white; border: 0; border-radius: 4px;">搜尋</button>
                    </div>
                    <div id="devMonFeed">
                        <div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">等待動態中...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
    }

    function removeMonitorUI() {
        const gear = document.getElementById('devMonitorGear');
        const panel = document.getElementById('devMonitorPanel');
        const style = document.getElementById('devMonitorStyles');
        if (gear) gear.remove();
        if (panel) panel.remove();
        if (style) style.remove();
    }

    function togglePanel() {
        const panel = document.getElementById('devMonitorPanel');
        if (panel) panel.classList.toggle('show');
    }

    // --- 監聽邏輯 ---
    let unsubscribes = [];

    function startListeners() {
        stopListeners();
        if (!db) return;

        // 1. 監聽在線人數
        const unsubPresence = db.collection('presence').onSnapshot(snap => {
            const now = Date.now();
            const fiveMinsAgo = now - 300000;
            const onlineCount = snap.docs.filter(d => (d.data().lastSeen || 0) > fiveMinsAgo).length;
            const el = document.getElementById('monStatOnline');
            if (el) el.textContent = onlineCount;
        });
        unsubscribes.push(unsubPresence);

        // 2. 監聽所有「待處理」申請 (跨任務監控)
        const unsubApps = db.collection('mushroomApplications')
            .where('status', '==', 'pending')
            .onSnapshot(async snap => {
                const apps = snap.docs.map(d => ({id: d.id, ...d.data()}));
                
                // 為了精確度，我們需要確認這些申請對應的任務是否還存在
                const THREE_HOURS = 3 * 60 * 60 * 1000;
                const tasksSnap = await db.collection('mushroomTasks')
                    .where('createdAt', '>', Date.now() - THREE_HOURS)
                    .get();
                const activeTaskIds = tasksSnap.docs.map(d => d.id);
                
                // 過濾掉「幽靈申請」（任務已刪除或已過期的申請）
                const validApps = apps.filter(a => activeTaskIds.includes(a.taskId));
                validApps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                
                const el = document.getElementById('monStatPending');
                if (el) el.textContent = validApps.length;
                updateFeed('apps', validApps.slice(0, 5));
            }, err => console.warn("Monitor Apps Error:", err));
        unsubscribes.push(unsubApps);

        // 3. 監聽最新留言
        const unsubGuestbook = db.collection('guestbook')
            .onSnapshot(snap => {
                let msgs = snap.docs.map(d => ({id: d.id, ...d.data()}));
                msgs.sort((a, b) => (b.time || 0) - (a.time || 0));
                updateFeed('msgs', msgs.slice(0, 5));
            }, err => console.warn("Monitor Guestbook Error:", err));
        unsubscribes.push(unsubGuestbook);

        // 4. 監聽待審核卡片
        // 優先讀取 window 上的設定，若無則預設為 "pikmin_postcards"
        const postcardColl = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
        const unsubReview = db.collection(postcardColl)
            .where('reviewStatus', '==', 'pending')
            .onSnapshot(snap => {
                let cards = snap.docs.map(d => ({id: d.id, ...d.data()}));
                // 本地排序
                cards.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
                
                const el = document.getElementById('monStatReview');
                if (el) el.textContent = cards.length;
                updateFeed('cards', cards.slice(0, 5));
            }, err => console.warn("Monitor Review Error:", err));
        unsubscribes.push(unsubReview);

        // 5. 監聽發佈中任務
        const THREE_HOURS = 3 * 60 * 60 * 1000;
        const unsubTasks = db.collection('mushroomTasks')
            .where('createdAt', '>', Date.now() - THREE_HOURS)
            .onSnapshot(snap => {
                const activeTasks = snap.docs.filter(d => {
                    const data = d.data();
                    return data.status === 'active' && data.needed > 0;
                });
                const el = document.getElementById('monStatTasks');
                if (el) el.textContent = activeTasks.length;
            }, err => console.warn("Monitor Tasks Error:", err));
        unsubscribes.push(unsubTasks);
    }

    function stopListeners() {
        unsubscribes.forEach(unsub => unsub());
        unsubscribes = [];
    }

    let feedItems = { apps: [], msgs: [], cards: [] };

    function updateFeed(type, items) {
        feedItems[type] = items;
        renderFeed();
    }

    function renderFeed() {
        const container = document.getElementById('devMonFeed');
        if (!container) return;

        // 合併並排序
        let all = [
            ...feedItems.apps.map(a => ({ 
                type: 'app', 
                time: a.createdAt, 
                html: `<div class="dev-mon-item app">
                    <b>📩 ${a.nickname || '玩家'}</b> 申請任務 
                    <div style="font-size:10px; color:#666;">UID: ${a.applicantId || 'unknown'}</div>
                    <button class="dev-copy-btn" onclick="copyInvite('${a.invite}')">複製邀請碼</button>
                    <div style="font-size:10px; color:#888;">${new Date(a.createdAt).toLocaleTimeString()}</div>
                </div>`
            })),
            ...feedItems.msgs.map(m => ({ 
                type: 'msg', 
                time: m.time, 
                html: `<div class="dev-mon-item msg">
                    <b>💬 ${m.name || '匿名'}</b>: ${m.text}
                    <div style="font-size:10px; color:#666;">UID: ${m.uid || 'unknown'}</div>
                    <div style="font-size:10px; color:#888;">${new Date(m.time).toLocaleTimeString()}</div>
                </div>`
            })),
            ...feedItems.cards.map(c => ({ 
                type: 'card', 
                time: new Date(c.createdAt).getTime(), 
                html: `<div class="dev-mon-item" style="border-left-color:#78c96b;">
                    <b>📷 ${c.author || '匿名'}</b> 上傳了新卡片 
                    <div style="font-size:10px; color:#666;">UID: ${c.ownerId || 'unknown'}</div>
                    <div style="font-size:10px; color:#888;">${new Date(c.createdAt).toLocaleTimeString()}</div>
                </div>`
            }))
        ];

        all.sort((a, b) => b.time - a.time);
        all = all.slice(0, 8);

        if (all.length === 0) {
            container.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">目前暫無動態</div>`;
            return;
        }

        container.innerHTML = all.map(x => x.html).join('');
    }

    // 全域複製函式
    window.copyInvite = function(code) {
        const clean = String(code).replace(/\D/g, "");
        navigator.clipboard.writeText(clean).then(() => {
            alert("✅ 邀請碼已複製: " + clean);
        });
    };

    // 搜尋特定 UID 的所有活動
    window.searchByUid = async function() {
        const input = document.getElementById('monSearchUid');
        const uid = input.value.trim();
        const container = document.getElementById('devMonFeed');
        
        if (!uid) {
            alert("請輸入 UID");
            return;
        }

        container.innerHTML = `<div style="color:#aaa; font-size:12px; text-align:center; padding:10px;">正在深度搜尋資料庫...</div>`;

        try {
            const postcardColl = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
            
            // 併發查詢三種資料來源
            const [cardsSnap, appsSnap, msgsSnap] = await Promise.all([
                db.collection(postcardColl).where('ownerId', '==', uid).limit(20).get(),
                db.collection('mushroomApplications').where('applicantId', '==', uid).limit(20).get(),
                db.collection('guestbook').where('uid', '==', uid).limit(20).get()
            ]);

            let results = [
                ...cardsSnap.docs.map(d => ({ 
                    type: 'card', 
                    time: new Date(d.data().createdAt).getTime(), 
                    html: `<div class="dev-mon-item" style="border-left-color:#78c96b;">
                        <b>📷 卡片</b>: ${d.data().locationText || '未命名'}
                        <div style="font-size:10px; color:#888;">${new Date(d.data().createdAt).toLocaleString()}</div>
                    </div>`
                })),
                ...appsSnap.docs.map(d => ({ 
                    type: 'app', 
                    time: d.data().createdAt, 
                    html: `<div class="dev-mon-item app">
                        <b>📩 任務申請</b>: ${d.data().nickname || '玩家'}
                        <div style="font-size:10px; color:#888;">${new Date(d.data().createdAt).toLocaleString()}</div>
                    </div>`
                })),
                ...msgsSnap.docs.map(d => ({ 
                    type: 'msg', 
                    time: d.data().time, 
                    html: `<div class="dev-mon-item msg">
                        <b>💬 留言</b>: ${d.data().text}
                        <div style="font-size:10px; color:#888;">${new Date(d.data().time).toLocaleString()}</div>
                    </div>`
                }))
            ];

            results.sort((a, b) => b.time - a.time);

            if (results.length === 0) {
                container.innerHTML = `<div style="color:#f87171; font-size:12px; text-align:center; padding:10px;">找不到該 UID 的任何紀錄</div>`;
            } else {
                container.innerHTML = `
                    <div style="font-size:11px; background:#f0f4ef; padding:4px 8px; margin-bottom:8px; border-radius:4px; color:#4a6741;">
                        🔍 搜尋結果 (${results.length} 筆) 
                        <button onclick="location.reload()" style="float:right; cursor:pointer; background:none; border:0; text-decoration:underline; font-size:10px;">回到即時監控</button>
                    </div>
                    ${results.map(x => x.html).join('')}
                `;
            }
        } catch (err) {
            console.error("UID Search Error:", err);
            alert("搜尋失敗：" + err.message);
        }
    };

    // 啟動
    init();

})();
