(function() {
    "use strict";

    const TASKS_COLL = "mushroomTasks";
    const APPS_COLL = "mushroomApplications";
    const CLEANUP_MS = 3 * 60 * 60 * 1000; // 3 小時過期

    // 蘑菇選單定義
    const MUSHROOM_TYPES = {
        "顏色蘑菇": ["紅蘑菇", "黃蘑菇", "藍蘑菇", "紫蘑菇", "白蘑菇", "粉紅蘑菇", "灰色蘑菇", "冰藍蘑菇"],
        "屬性蘑菇": ["火蘑菇", "水蘑菇", "電蘑菇", "毒蘑菇", "水晶蘑菇"],
        "特殊": ["活動蘑菇", "巨大活動蘑菇"]
    };
    const MUSHROOM_SIZES = ["一般", "小", "大"];

    let mushroomTasks = [];
    let myTasks = [];
    let db = null;

    // --- 初始化 ---
    function init() {
        // 建立 UI 骨架與彈窗
        createBarSkeleton();
        createModals();
        
        if (window.firebase && firebase.apps.length) {
            db = firebase.firestore();
            listenToTasks();
            listenToMyApplications();
        } else {
            const checkFB = setInterval(() => {
                if (window.firebase && firebase.apps.length) {
                    db = firebase.firestore();
                    listenToTasks();
                    listenToMyApplications();
                    clearInterval(checkFB);
                }
            }, 1000);
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
                    <button class="mr-btn mr-btn-publish" id="mrPublishBtn">＋發布</button>
                    <button class="mr-btn mr-btn-my" id="mrMyTasksBtn">
                        我的任務 <span id="mrNotifDot" class="mr-notif-dot" style="display:none;">0</span>
                    </button>
                </div>
            </div>
            <div class="mr-task-scroller" id="mrTaskScroller">
                <div style="color:#9ca3af; font-size:12px; padding:10px;">載入情報中...</div>
            </div>
        `;

        // 重新綁定按鈕
        setTimeout(() => {
            const pubBtn = document.getElementById('mrPublishBtn');
            const myBtn = document.getElementById('mrMyTasksBtn');
            if (pubBtn) pubBtn.onclick = () => openModal('publish');
            if (myBtn) myBtn.onclick = () => openModal('myTasks');
        }, 100);
    }

    // --- UI: 彈窗 HTML ---
    function createModals() {
        if (document.getElementById('v37MushroomModals')) return;
        const wrap = document.createElement('div');
        wrap.id = "v37MushroomModals";
        wrap.innerHTML = `
            <!-- 發布彈窗 -->
            <div id="mrModalPublish" class="mr-modal-backdrop">
                <div class="mr-modal-panel">
                    <div class="mr-modal-header"><h3>發布蘑菇情報</h3><button class="mr-modal-close">×</button></div>
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
                            <label class="mr-form-label">缺幾人</label>
                            <input id="mrInputNeeded" type="number" class="mr-form-input" value="3" min="1" max="4">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">票券</label>
                            <select id="mrInputTicket" class="mr-form-select">
                                <option value="免券">免券</option>
                                <option value="需券">需券</option>
                            </select>
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">戰力需求</label>
                            <input id="mrInputPower" type="text" class="mr-form-input" placeholder="">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">發布者暱稱</label>
                            <input id="mrInputOwnerNick" type="text" class="mr-form-input" placeholder="小花">
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
                            <input id="mrInputCoords" type="text" class="mr-form-input" placeholder="25.0330, 121.5654">
                        </div>
                        <button id="mrSubmitPublish" class="mr-btn mr-btn-publish" style="width:100%; justify-content:center; min-height:44px; font-size:15px; font-weight:600; margin-top:20px; margin-bottom:10px;">發布情報</button>
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
                            <input id="mrApplyNick" type="text" class="mr-form-input" placeholder="小花">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">你的 Pikmin 邀請碼</label>
                            <input id="mrApplyInvite" type="text" class="mr-form-input" placeholder="1234 5678 0000">
                        </div>
                        <div class="mr-form-group">
                            <label class="mr-form-label">備註</label>
                            <input id="mrApplyNote" type="text" class="mr-form-input" placeholder="現在可以進">
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
                        <div style="color:#9ca3af; text-align:center; padding:20px;">目前沒有發布中的任務</div>
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
            bd.onclick = (e) => { if(e.target === bd) closeAllModals(); };
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
                        coordsInput.placeholder = "25.0330, 121.5654";
                    }
                }
            };
        });

        document.getElementById('mrSubmitPublish').onclick = submitTask;
        document.getElementById('mrSubmitApply').onclick = submitApplication;

        // 特殊蘑菇禁用大小選單邏輯
        const typeSelect = document.getElementById('mrInputType');
        const sizeSelect = document.getElementById('mrInputSize');
        if (typeSelect && sizeSelect) {
            typeSelect.onchange = () => {
                const isSpecial = MUSHROOM_TYPES["特殊"].includes(typeSelect.value);
                sizeSelect.disabled = isSpecial;
                sizeSelect.style.opacity = isSpecial ? "0.5" : "1";
                sizeSelect.style.cursor = isSpecial ? "not-allowed" : "default";
                if (isSpecial) sizeSelect.value = "一般";
            };
        }
    }

    // --- 邏輯: 任務監聽 ---
    function listenToTasks() {
        const now = Date.now();
        const startTime = now - CLEANUP_MS;

        db.collection(TASKS_COLL)
          .where('createdAt', '>', startTime)
          .orderBy('createdAt', 'desc')
          .onSnapshot(snap => {
            mushroomTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTaskBar();
            renderMyTasks();
        });
    }

    // --- 邏輯: 申請紅點監聽 ---
    function listenToMyApplications() {
        firebase.auth().onAuthStateChanged(user => {
            if (!user) return;
            db.collection(APPS_COLL)
              .where('ownerId', '==', user.uid)
              .where('status', '==', 'pending')
              .onSnapshot(snap => {
                const dot = document.getElementById('mrNotifDot');
                if (dot) {
                    const count = snap.size;
                    dot.textContent = count;
                    dot.style.display = count > 0 ? 'flex' : 'none';
                }
                renderMyTasks(); // 申請更新時重繪管理面板
            });
        });
    }

    // --- UI: 渲染情報條 ---
    function renderTaskBar() {
        const scroller = document.getElementById('mrTaskScroller');
        if (!scroller) return;

        if (mushroomTasks.length === 0) {
            scroller.innerHTML = `<div style="color:#9ca3af; font-size:12px; padding:10px;">目前暫無情報，快來發布第一個吧！</div>`;
            return;
        }

        const now = Date.now();
        scroller.innerHTML = mushroomTasks.map(t => {
            const isFull = t.needed <= 0 || t.status === 'full';
            const timeStr = formatTime(t.createdAt);
            const displayNeeded = isFull ? "已滿" : `缺${t.needed}`;
            const icon = isFull ? "🔒" : (t.mode === 'fly' ? "📍" : "📨");
            const modeText = isFull ? "" : (t.mode === 'fly' ? "自飛" : "邀請");

            // 特殊蘑菇不顯示大小
            const isSpecial = MUSHROOM_TYPES["特殊"].includes(t.type);
            const displayType = isSpecial ? t.type : `${t.size}${t.type}`;

            return `
                <div class="mr-task-card ${isFull ? 'full' : ''}" onclick="handleTaskClick('${t.id}')">
                    <span style="color:#f97316;">✨</span>
                    <span class="mr-task-type">${displayType}</span> / 
                    <span class="mr-task-needed">${displayNeeded}</span> / 
                    <span>${t.ticket}</span> / 
                    <span>限${t.power}</span> / 
                    <span class="mr-task-mode ${t.mode}">${icon} ${modeText}</span>
                    <span class="mr-task-time">${timeStr}</span>
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
            alert("這是您自己發布的任務唷！請至「我的任務」管理申請名單。");
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
            const ownerNameDisplay = t.ownerName ? `<br><span style="font-size:12px; color:#6b7280;">發布者：${t.ownerName}</span>` : "";
            info.innerHTML = `✨ ${displayType} / 缺${t.needed} / 限${t.power}${ownerNameDisplay}`;
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

    // --- 邏輯: 發布情報 ---
    async function submitTask() {
        const user = firebase.auth().currentUser;
        if (!user) { alert("系統尚未就緒，請稍後再試。"); return; }

        const ownerNick = document.getElementById('mrInputOwnerNick').value.trim();
        if (!ownerNick) {
            alert("請填寫發布者暱稱唷！");
            document.getElementById('mrInputOwnerNick').focus();
            return;
        }

        const mode = document.querySelector('.mr-mode-tab.active').dataset.mode;
        const coords = document.getElementById('mrInputCoords').value.trim();

        // 驗證：若為自飛模式，座標為必填
        if (mode === 'fly' && !coords) {
            alert("📍 自飛模式必須填寫座標才能發布唷！");
            document.getElementById('mrInputCoords').focus();
            return;
        }

        const data = {
            size: document.getElementById('mrInputSize').value,
            type: document.getElementById('mrInputType').value,
            needed: parseInt(document.getElementById('mrInputNeeded').value),
            ticket: document.getElementById('mrInputTicket').value,
            power: document.getElementById('mrInputPower').value || "都可",
            mode: mode,
            coords: coords,
            ownerId: user.uid,
            ownerName: ownerNick,
            status: 'active',
            createdAt: Date.now()
        };

        try {
            await db.collection(TASKS_COLL).add(data);
            alert("🍄 情報發布成功！");
            closeAllModals();
        } catch (e) {
            alert("發布失敗：" + e.message);
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
    async function renderMyTasks() {
        const user = firebase.auth().currentUser;
        const panel = document.getElementById('mrMyTasksContent');
        if (!user || !panel) return;

        const myTasks = mushroomTasks.filter(t => t.ownerId === user.uid);
        if (myTasks.length === 0) {
            panel.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:20px;">目前沒有發布中的任務</div>`;
            return;
        }

        // 抓取所有相關申請
        const appsSnap = await db.collection(APPS_COLL).where('ownerId', '==', user.uid).get();
        const allApps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        panel.innerHTML = myTasks.map(t => {
            const taskApps = allApps.filter(a => a.taskId === t.id);
            const isSpecial = MUSHROOM_TYPES["特殊"].includes(t.type);
            const displayType = isSpecial ? t.type : `${t.size}${t.type}`;
            
            return `
                <div style="border:1px solid #e1f0de; border-radius:16px; padding:15px; margin-bottom:15px; background:#fff;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong style="color:#4a6a43;">✨ ${displayType} / 缺${t.needed} / ${t.mode === 'fly' ? '📍自飛' : '📨邀請'}</strong>
                        <button onclick="deleteMushroomTask('${t.id}')" style="color:#ef4444; border:0; background:none; cursor:pointer; font-size:12px;">撤回任務</button>
                    </div>
                    <div class="mr-applicant-list">
                        ${taskApps.length === 0 ? '<div style="font-size:12px; color:#9ca3af;">尚未有人申請</div>' : taskApps.map(a => `
                            <div class="mr-applicant-item">
                                <div class="mr-applicant-info">
                                    <div style="display:flex; justify-content:space-between;">
                                        <b>${a.nickname}</b>
                                        <span style="font-size:11px; color:${a.status==='invited'?'#10b981':'#f59e0b'}">${a.status==='invited'?'✅ 已邀請':'⏳ 待處理'}</span>
                                    </div>
                                    <div style="font-size:12px; color:#4b5563;">邀請碼：<code style="background:#eee; padding:2px 4px; border-radius:4px;">${a.invite}</code></div>
                                    <div style="font-size:12px; color:#6b7280;">備註：${a.note || '無'}</div>
                                </div>
                                <div class="mr-applicant-actions">
                                    <button class="mr-btn-action mr-btn-done" ${a.status==='invited'?'disabled':''} onclick="handleApprove('${a.id}', '${t.id}')">
                                        ${a.status==='invited' ? '已處理' : '已邀請'}
                                    </button>
                                    <button class="mr-btn-action mr-btn-reject" onclick="handleReject('${a.id}')">拒絕</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
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
                
                trans.update(tRef, { 
                    needed: finalNeeded,
                    status: finalNeeded === 0 ? 'full' : 'active'
                });
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
            await db.collection(TASKS_COLL).doc(id).delete();
        } catch (e) { alert("撤回失敗"); }
    };

    // --- 工具 ---
    function openModal(type) {
        closeAllModals();
        if (type === 'publish') {
            document.getElementById('mrModalPublish').classList.add('show');
            // 自動帶入暱稱
            const nickInput = document.getElementById('mrInputOwnerNick');
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
        document.body.classList.add('modal-open');
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

    // 強力監控：防止其他腳本延遲渲染導致抓不到
    let retryCount = 0;
    const retryInterval = setInterval(() => {
        createBarSkeleton();
        retryCount++;
        if (retryCount > 10) clearInterval(retryInterval); // 執行 10 次後停止
    }, 2000);

})();
