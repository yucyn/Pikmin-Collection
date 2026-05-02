const ADMIN_USER_IDS = [
  "am42ZiJikLNEt8RSsWipgBDj4h32"
];

function isAdminUser() {
  return ADMIN_USER_IDS.includes(getCurrentUserId());
}

const USER_ID_KEY = "pikmin_current_user_id";
const LOCAL_POSTCARDS_KEY = "pikmin_postcards_local_backup_v3510";

let postcardsCache = [];
let db = null;
let auth = null;
let currentUserId = localStorage.getItem(USER_ID_KEY) || "";
let isFirebaseReady = false;
let isAuthReady = false;
let isUsingLocalFallback = false;
let storageOnChange = null;

function notifyStorageChange() {
  if (typeof storageOnChange === "function") {
    try { storageOnChange(); } catch (error) { console.error("onChange 執行失敗：", error); }
  }
}

function ensureLocalUserId() {
  if (!currentUserId) {
    currentUserId = localStorage.getItem(USER_ID_KEY) || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(USER_ID_KEY, currentUserId);
  }
  return currentUserId;
}

function getCurrentUserId() {
  return ensureLocalUserId();
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

function normalizePostcard(id, data = {}) {
  return {
    id,
    image: data.image || "",
    category: data.category || "全球",
    tag: data.tag || "",
    ownerId: data.ownerId || "",
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    likeCount: Number(data.likeCount || 0),
    locationText: data.locationText || "",
    lat: Number(data.lat),
    lng: Number(data.lng),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || ""
  };
}

function sortPostcards() {
  postcardsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function loadLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTCARDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    postcardsCache = Array.isArray(list)
      ? list.map(item => normalizePostcard(item.id || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`, item))
      : [];
    sortPostcards();
  } catch (error) {
    console.warn("本機備援資料讀取失敗，已重置：", error);
    postcardsCache = [];
    localStorage.removeItem(LOCAL_POSTCARDS_KEY);
  }
}

function saveLocalBackup() {
  try {
    localStorage.setItem(LOCAL_POSTCARDS_KEY, JSON.stringify(postcardsCache));
  } catch (error) {
    console.warn("本機備援資料儲存失敗：", error);
  }
}

function switchToLocalFallback(reason) {
  isUsingLocalFallback = true;
  console.warn("已切換本機備援模式：", reason);
  loadLocalBackup();
  notifyStorageChange();
}

function initializeFirebaseStorage(onChange) {
  storageOnChange = onChange;
  ensureLocalUserId();

  // 先用本機備援資料渲染一次，避免首頁空白或無限等待。
  loadLocalBackup();
  notifyStorageChange();

  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!config || String(config.apiKey || "").includes("PASTE_")) {
    switchToLocalFallback("Firebase 設定尚未完成");
    return;
  }

  if (typeof firebase === "undefined") {
    switchToLocalFallback("頁面沒有載入 Firebase SDK");
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseReady = true;

    let snapshotArrived = false;

    db.collection(collectionName).onSnapshot(snapshot => {
      snapshotArrived = true;
      isUsingLocalFallback = false;
      postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
      sortPostcards();
      saveLocalBackup();
      notifyStorageChange();
    }, error => {
      console.error("Firestore 讀取失敗，改用本機備援：", error);
      switchToLocalFallback(error);
    });

    // 如果 Firestore 太久沒有回來，先不要讓畫面空白。
    setTimeout(() => {
      if (!snapshotArrived && postcardsCache.length === 0) {
        notifyStorageChange();
      }
    }, 1200);

    auth.signInAnonymously()
      .then(result => {
        currentUserId = result.user.uid;
        isAuthReady = true;
        localStorage.setItem(USER_ID_KEY, currentUserId);
        notifyStorageChange();
      })
      .catch(error => {
        console.error("匿名登入失敗，新增/編輯會改用本機備援：", error);
        isAuthReady = false;
        ensureLocalUserId();
        notifyStorageChange();
      });
  } catch (error) {
    console.error("Firebase 初始化失敗，改用本機備援：", error);
    switchToLocalFallback(error);
  }
}

function canWriteFirebase() {
  return isFirebaseReady && db && isAuthReady && getCurrentUserId() && !isUsingLocalFallback;
}

function upsertLocalPostcard(postcard) {
  const id = postcard.id || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const normalized = normalizePostcard(id, {
    ...postcard,
    id,
    ownerId: postcard.ownerId || getCurrentUserId(),
    createdAt: postcard.createdAt || new Date().toISOString()
  });
  postcardsCache = [normalized, ...postcardsCache.filter(item => String(item.id) !== String(id))];
  sortPostcards();
  saveLocalBackup();
  notifyStorageChange();
  return normalized;
}

async function addPostcard(postcard) {
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!canWriteFirebase()) {
    upsertLocalPostcard(postcard);
    return;
  }

  await db.collection(collectionName).add({
    ...postcard,
    ownerId: getCurrentUserId(),
    category: postcard.category || "全球",
    likedBy: Array.isArray(postcard.likedBy) ? postcard.likedBy : [],
    likeCount: Number(postcard.likeCount || 0),
    createdAt: postcard.createdAt || new Date().toISOString()
  });
}

async function deletePostcard(id) {
  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能刪除自己建立的明信片");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!canWriteFirebase() || String(id).startsWith("local_")) {
    postcardsCache = postcardsCache.filter(item => String(item.id) !== String(id));
    saveLocalBackup();
    notifyStorageChange();
    return;
  }

  await db.collection(collectionName).doc(id).delete();
}

async function togglePostcardLike(id) {
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const item = getPostcardById(id);

  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const hasLiked = likedBy.includes(userId);

  const nextLikedBy = hasLiked
    ? likedBy.filter(x => x !== userId)
    : [...likedBy, userId];

  if (!canWriteFirebase() || String(id).startsWith("local_")) {
    item.likedBy = nextLikedBy;
    item.likeCount = nextLikedBy.length;
    saveLocalBackup();
    notifyStorageChange();
    return;
  }

  await db.collection(collectionName).doc(id).update({
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length
  });
}

async function updatePostcard(id, updates) {
  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能編輯自己建立的明信片");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const nextUpdates = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (!canWriteFirebase() || String(id).startsWith("local_")) {
    Object.assign(item, nextUpdates);
    saveLocalBackup();
    notifyStorageChange();
    return;
  }

  await db.collection(collectionName).doc(id).update(nextUpdates);
}
