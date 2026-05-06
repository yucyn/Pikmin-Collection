// V38: 移除 IIFE 包裹以確保與舊有腳本的全域變數相容性
// 恢復原本的全域變數模式，但保留新功能 (beenThereBy)

function getAdminUids() {
  const list = window.PIKMIN_ADMIN_UIDS;
  return Array.isArray(list) && list.length ? list.filter(Boolean) : ["am42ZiJikLNEt8RSsWipgBDj4h32"];
}

function isAdminUser() {
  return getAdminUids().includes(getCurrentUserId());
}

const USER_ID_KEY = "pikmin_current_user_id";

var postcardsCache = [];
var db = null;
var auth = null;
var currentUserId = localStorage.getItem(USER_ID_KEY) || "";
var isFirebaseReady = false;
var isAuthReady = false;

// 確保這些變數在全域範圍內可見 (為了相容於 app.js)
window.db = db;
window.auth = auth;
window.postcardsCache = postcardsCache;
window.isFirebaseReady = isFirebaseReady;
window.isAuthReady = isAuthReady;

function getCurrentUserId() {
  // 優先使用 Firebase 認證的 UID，這對符合 Security Rules 至關重要
  if (window.auth && window.auth.currentUser) {
    return window.auth.currentUser.uid;
  }
  if (currentUserId) return currentUserId;
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id || id === "null" || id === "undefined") {
    id = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem(USER_ID_KEY, id);
  }
  currentUserId = id;
  return id;
}

function getPostcards() {
  return postcardsCache;
}

function getPostcardById(id) {
  return postcardsCache.find(item => String(item.id) === String(id));
}

function isOwnedByCurrentUser(item) {
  return isAdminUser() || Boolean(item && item.ownerId && item.ownerId === getCurrentUserId());
}

function normalizePostcard(id, data) {
  const imageFocusX = Number(data.imageFocusX);
  const imageFocusY = Number(data.imageFocusY);
  return {
    id,
    ...data,
    image: data.image || "",
    category: data.category || "全球",
    tag: data.tag || "",
    beenThereBy: Array.isArray(data.beenThereBy) ? data.beenThereBy : [],
    beenThereCount: Number(data.beenThereCount || 0),
    likeCount: Number(
      data.likeCount ??
      data.likes ??
      (Array.isArray(data.likedBy) ? data.likedBy.length : 0)
    ),
    likes: Number(
      data.likeCount ??
      data.likes ??
      (Array.isArray(data.likedBy) ? data.likedBy.length : 0)
    ),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    imageFocusX: Number.isFinite(imageFocusX) ? Math.min(100, Math.max(0, imageFocusX)) : 50,
    imageFocusY: Number.isFinite(imageFocusY) ? Math.min(100, Math.max(0, imageFocusY)) : 50,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function initializeFirebaseStorage(onChange) {
  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!config || String(config.apiKey).includes("PASTE_")) {
    alert("Firebase 設定尚未完成，請檢查 js/firebaseConfig.js");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  db = firebase.firestore();
  window.db = db; // 同步更新全域變數
  if (typeof firebase.analytics === "function") {
    firebase.analytics();
  }
  isFirebaseReady = true;
  window.isFirebaseReady = true;

  db.collection(collectionName).onSnapshot(snapshot => {
    postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
    postcardsCache.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt) : 0;
        const db = b.createdAt ? new Date(b.createdAt) : 0;
        return db - da;
    });
    // V38: 只要資料一進來就立刻更新畫面，不等待登入成功
    onChange();
  }, error => {
    console.error("Firestore 讀取失敗：", error);
    // 即使失敗也回傳一次，讓 UI 能顯示「目前無資料」而非一直卡在載入中
    onChange();
  });

  auth = firebase.auth();
  window.auth = auth; // 同步更新全域變數
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUserId = user.uid;
      isAuthReady = true;
      localStorage.setItem(USER_ID_KEY, currentUserId);
      onChange();
    } else {
      // 訪客自動匿名登入 (背景進行)
      auth.signInAnonymously().catch(e => {
        console.error("匿名登入失敗", e);
        // 如果匿名登入徹底失敗，我們依然需要讓頁面可以正常運作
        isAuthReady = false;
        onChange();
      });
    }
  });
}

function assertWriteReady() {
  // 根據你的 Security Rules，必須 request.auth != null 才能更新
  if (!isFirebaseReady || !db || !auth) return false;
  // 檢查 Firebase Auth 是否已經完成初始化並取得使用者身分
  return !!auth.currentUser;
}

async function addPostcard(postcard) {
  if (!assertWriteReady()) {
    throw new Error("Firebase 尚未準備好（正在進行匿名登入），請稍後再試");
  }
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  try {
    await db.collection(collectionName).add({
      ...postcard,
      ownerId: getCurrentUserId(),
      createdAt: postcard.createdAt || new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("addPostcard failed:", error);
    throw error;
  }
}

async function deletePostcard(id) {
  if (!assertWriteReady()) return;
  const item = getPostcardById(id);
  if (!isOwnedByCurrentUser(item)) return;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  await db.collection(collectionName).doc(id).delete();
}

async function togglePostcardLike(id) {
  if (!id) {
    console.error("togglePostcardLike: missing id");
    throw new Error("缺少卡片 ID");
  }
  if (!assertWriteReady()) {
    console.error("togglePostcardLike: Firebase not ready", { isFirebaseReady, hasDb: !!db, userId: getCurrentUserId() });
    throw new Error("Firebase 尚未準備好，無法寫入愛心");
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const docRef = db.collection(collectionName).doc(String(id));

  const cachedItem = getPostcardById(id);

  // 先記錄原本狀態，失敗時可以還原
  const oldLikedBy = cachedItem && Array.isArray(cachedItem.likedBy)
    ? [...cachedItem.likedBy]
    : [];

  const oldLikeCount = cachedItem ? Number(cachedItem.likeCount || cachedItem.likes || 0) : 0;

  // 本地樂觀更新
  if (cachedItem) {
    const likedBy = Array.isArray(cachedItem.likedBy) ? cachedItem.likedBy : [];
    const hasLiked = likedBy.includes(userId);
    const nextLikedBy = hasLiked
      ? likedBy.filter(x => x !== userId)
      : [...likedBy, userId];

    cachedItem.likedBy = nextLikedBy;
    cachedItem.likeCount = nextLikedBy.length;
    cachedItem.likes = nextLikedBy.length;
  }

  try {
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(docRef);
      if (!snapshot.exists) {
        throw new Error("找不到這張明信片");
      }

      const data = snapshot.data();
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      const hasLiked = likedBy.includes(userId);

      const nextLikedBy = hasLiked
        ? likedBy.filter(x => x !== userId)
        : [...likedBy, userId];

      const nextCount = nextLikedBy.length;

      transaction.update(docRef, {
        likedBy: nextLikedBy,
        likeCount: nextCount,
        likes: nextCount,
        updatedAt: new Date().toISOString()
      });
    });

    return true;
  } catch (error) {
    // Firebase 寫入失敗時，把本地快取還原
    if (cachedItem) {
      cachedItem.likedBy = oldLikedBy;
      cachedItem.likeCount = oldLikeCount;
      cachedItem.likes = oldLikeCount;
    }

    console.error("togglePostcardLike failed:", error);
    throw error;
  }
}

async function togglePostcardBeenThere(id) {
  if (!assertWriteReady()) return;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const docRef = db.collection(collectionName).doc(id);

  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) return;
    const data = snapshot.data();
    const beenThereBy = Array.isArray(data.beenThereBy) ? data.beenThereBy : [];
    const hasBeenThere = beenThereBy.includes(userId);
    const nextBeenThereBy = hasBeenThere ? beenThereBy.filter(x => x !== userId) : [...beenThereBy, userId];
    transaction.update(docRef, { beenThereBy: nextBeenThereBy, beenThereCount: nextBeenThereBy.length });
  });
}

async function updatePostcard(id, updates) {
  if (!assertWriteReady()) {
    throw new Error("Firebase 認證尚未就緒，請稍後再試");
  }
  const item = getPostcardById(id);
  if (!item) {
    throw new Error("找不到該卡片資料");
  }
  
  const isOwner = isOwnedByCurrentUser(item);
  if (!isOwner) {
    console.warn("權限不足：", { 
      userId: getCurrentUserId(), 
      ownerId: item.ownerId, 
      isAdmin: isAdminUser() 
    });
    throw new Error("權限不足：你不是管理員，也不是此卡片的擁有者");
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  try {
    await db.collection(collectionName).doc(id).update({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("updatePostcard failed:", error);
    throw error;
  }
}

// 導出到全域
window.initializeFirebaseStorage = initializeFirebaseStorage;
window.addPostcard = addPostcard;
window.updatePostcard = updatePostcard;
window.deletePostcard = deletePostcard;
window.getPostcards = getPostcards;
window.getPostcardById = getPostcardById;
window.togglePostcardLike = togglePostcardLike;
window.togglePostcardBeenThere = togglePostcardBeenThere;
window.getCurrentUserId = getCurrentUserId;
window.isAdminUser = isAdminUser;
