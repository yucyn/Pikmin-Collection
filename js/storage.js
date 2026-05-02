const ADMIN_USER_IDS = [
  "am42ZiJikLNEt8RSsWipgBDj4h32"
];

const USER_ID_KEY = "pikmin_current_user_id";
const LOCAL_POSTCARDS_KEY = "pikmin_postcards_local_backup";

let postcardsCache = [];
let db = null;
let auth = null;
let currentUserId = localStorage.getItem(USER_ID_KEY) || "";
let isFirebaseReady = false;
let isAuthReady = false;
let unsubscribePostcards = null;

function createLocalUserId() {
  const id = "local_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(USER_ID_KEY, id);
  return id;
}

function getCurrentUserId() {
  if (!currentUserId) {
    currentUserId = localStorage.getItem(USER_ID_KEY) || createLocalUserId();
  }
  return currentUserId;
}

function isAdminUser() {
  return ADMIN_USER_IDS.includes(getCurrentUserId());
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

function loadLocalPostcards() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTCARDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    postcardsCache = Array.isArray(list)
      ? list.map(item => normalizePostcard(item.id || ("local_" + Date.now()), item))
      : [];
    postcardsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.warn("本機備援資料讀取失敗，已重置：", error);
    postcardsCache = [];
    localStorage.removeItem(LOCAL_POSTCARDS_KEY);
  }
}

function saveLocalPostcards() {
  try {
    localStorage.setItem(LOCAL_POSTCARDS_KEY, JSON.stringify(postcardsCache));
  } catch (error) {
    console.warn("本機備援資料儲存失敗：", error);
  }
}

function notifyChange(onChange) {
  if (typeof onChange === "function") {
    try { onChange(); } catch (error) { console.error(error); }
  }
}

function initializeFirebaseStorage(onChange) {
  // V35.11：永遠先啟用本機備援，避免 Firebase 卡住時畫面空白。
  getCurrentUserId();
  loadLocalPostcards();
  notifyChange(onChange);

  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!config || String(config.apiKey || "").includes("PASTE_")) {
    console.warn("Firebase 設定尚未完成，已使用本機備援。");
    return;
  }

  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK 未載入，已使用本機備援。");
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

    unsubscribePostcards = db.collection(collectionName).onSnapshot(snapshot => {
      snapshotArrived = true;
      postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
      postcardsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      saveLocalPostcards();
      notifyChange(onChange);
    }, error => {
      console.error("Firestore 讀取失敗，已使用本機備援：", error);
      isFirebaseReady = false;
      loadLocalPostcards();
      notifyChange(onChange);
    });

    // 如果 Firestore 長時間沒回來，也先用本機資料渲染，不卡頁面。
    setTimeout(() => {
      if (!snapshotArrived) {
        console.warn("Firestore 尚未回應，先使用本機備援資料。");
        loadLocalPostcards();
        notifyChange(onChange);
      }
    }, 1200);

    auth.signInAnonymously()
      .then(result => {
        currentUserId = result.user.uid;
        isAuthReady = true;
        localStorage.setItem(USER_ID_KEY, currentUserId);
        notifyChange(onChange);
      })
      .catch(error => {
        console.error("匿名登入失敗，已改用本機使用者 ID：", error);
        isAuthReady = false;
        getCurrentUserId();
        notifyChange(onChange);
      });

  } catch (error) {
    console.error("Firebase 初始化失敗，已使用本機備援：", error);
    isFirebaseReady = false;
    isAuthReady = false;
    loadLocalPostcards();
    notifyChange(onChange);
  }
}

function assertWriteReady() {
  // V35.11：Firebase 未就緒時不阻擋，改走本機備援。
  getCurrentUserId();
  return true;
}

async function addPostcard(postcard) {
  assertWriteReady();

  const localItem = normalizePostcard("local_" + Date.now(), {
    ...postcard,
    ownerId: getCurrentUserId(),
    category: postcard.category || "全球",
    likedBy: Array.isArray(postcard.likedBy) ? postcard.likedBy : [],
    likeCount: Number(postcard.likeCount || 0),
    createdAt: postcard.createdAt || new Date().toISOString()
  });

  if (isFirebaseReady && db && isAuthReady) {
    try {
      const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
      await db.collection(collectionName).add({
        ...postcard,
        ownerId: getCurrentUserId(),
        category: postcard.category || "全球",
        likedBy: Array.isArray(postcard.likedBy) ? postcard.likedBy : [],
        likeCount: Number(postcard.likeCount || 0),
        createdAt: postcard.createdAt || new Date().toISOString()
      });
      return;
    } catch (error) {
      console.error("Firebase 新增失敗，已改存本機：", error);
    }
  }

  postcardsCache.unshift(localItem);
  saveLocalPostcards();
}

async function deletePostcard(id) {
  assertWriteReady();

  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能刪除自己建立的明信片");
    return;
  }

  if (isFirebaseReady && db && isAuthReady && !String(id).startsWith("local_")) {
    try {
      const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
      await db.collection(collectionName).doc(id).delete();
      return;
    } catch (error) {
      console.error("Firebase 刪除失敗，已改刪本機快取：", error);
    }
  }

  postcardsCache = postcardsCache.filter(item => String(item.id) !== String(id));
  saveLocalPostcards();
}

async function togglePostcardLike(id) {
  assertWriteReady();

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const item = getPostcardById(id);

  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const hasLiked = likedBy.includes(userId);

  const nextLikedBy = hasLiked
    ? likedBy.filter(x => x !== userId)
    : [...likedBy, userId];

  if (isFirebaseReady && db && isAuthReady && !String(id).startsWith("local_")) {
    try {
      await db.collection(collectionName).doc(id).update({
        likedBy: nextLikedBy,
        likeCount: nextLikedBy.length
      });
      return;
    } catch (error) {
      console.error("Firebase 收藏更新失敗，已改存本機：", error);
    }
  }

  item.likedBy = nextLikedBy;
  item.likeCount = nextLikedBy.length;
  saveLocalPostcards();
}

async function updatePostcard(id, updates) {
  assertWriteReady();

  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能編輯自己建立的明信片");
    return;
  }

  const nextUpdates = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (isFirebaseReady && db && isAuthReady && !String(id).startsWith("local_")) {
    try {
      const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
      await db.collection(collectionName).doc(id).update(nextUpdates);
      return;
    } catch (error) {
      console.error("Firebase 編輯失敗，已改存本機：", error);
    }
  }

  Object.assign(item, nextUpdates);
  saveLocalPostcards();
}
