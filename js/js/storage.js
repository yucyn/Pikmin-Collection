const ADMIN_USER_IDS = [
  "am42ZiJikLNEt8RSsWipgBDj4h32"
];

const USER_ID_KEY = "pikmin_current_user_id";
const LOCAL_POSTCARDS_KEY = "pikmin_postcards_local_backup_v35";

let postcardsCache = [];
let db = null;
let auth = null;
let currentUserId = localStorage.getItem(USER_ID_KEY) || "";
let isFirebaseReady = false;
let isAuthReady = false;
let isUsingLocalFallback = false;
let firebaseUnsubscribe = null;

function createLocalUserId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureCurrentUserId() {
  if (!currentUserId) {
    currentUserId = localStorage.getItem(USER_ID_KEY) || createLocalUserId();
    localStorage.setItem(USER_ID_KEY, currentUserId);
  }
  return currentUserId;
}

function getCurrentUserId() {
  return ensureCurrentUserId();
}

function isAdminUser() {
  return ADMIN_USER_IDS.includes(getCurrentUserId());
}

function readLocalPostcards() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTCARDS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.warn("[Pikmin] local backup parse failed; reset local backup.", error);
    localStorage.removeItem(LOCAL_POSTCARDS_KEY);
    return [];
  }
}

function writeLocalPostcards(list) {
  try {
    localStorage.setItem(LOCAL_POSTCARDS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (error) {
    console.warn("[Pikmin] local backup save failed.", error);
  }
}

function sortPostcards() {
  postcardsCache.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function setCacheFromLocal() {
  postcardsCache = readLocalPostcards().map(item => normalizePostcard(item.id || createLocalId(), item));
  sortPostcards();
}

function getPostcards() {
  return Array.isArray(postcardsCache) ? postcardsCache : [];
}

function getPostcardById(id) {
  return getPostcards().find(item => String(item.id) === String(id));
}

function isOwnedByCurrentUser(item) {
  return isAdminUser() || Boolean(item && item.ownerId && item.ownerId === getCurrentUserId());
}

function createLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizePostcard(id, data = {}) {
  return {
    id,
    image: data.image || "",
    category: data.category || "全球",
    tag: data.tag || "",
    ownerId: data.ownerId || getCurrentUserId(),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    likeCount: Number(data.likeCount || 0),
    locationText: data.locationText || "",
    lat: Number(data.lat),
    lng: Number(data.lng),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || ""
  };
}

function initializeFirebaseStorage(onChange = function () {}) {
  ensureCurrentUserId();

  // 先用本機備援渲染，Firebase 成功後會覆蓋成線上資料。
  setCacheFromLocal();
  try { onChange(); } catch (error) { console.error("[Pikmin] onChange local failed", error); }

  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (!config || String(config.apiKey || "").includes("PASTE_")) {
    console.warn("[Pikmin] Firebase config missing; local fallback enabled.");
    isUsingLocalFallback = true;
    return;
  }

  if (typeof firebase === "undefined") {
    console.warn("[Pikmin] Firebase SDK not loaded; local fallback enabled.");
    isUsingLocalFallback = true;
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    db = firebase.firestore();
    auth = firebase.auth();
    isFirebaseReady = true;
    isUsingLocalFallback = false;
  } catch (error) {
    console.error("[Pikmin] Firebase init failed; local fallback enabled.", error);
    isUsingLocalFallback = true;
    return;
  }

  try {
    firebaseUnsubscribe = db.collection(collectionName).onSnapshot(snapshot => {
      postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
      sortPostcards();
      writeLocalPostcards(postcardsCache);
      isUsingLocalFallback = false;
      try { onChange(); } catch (error) { console.error("[Pikmin] onChange snapshot failed", error); }
    }, error => {
      console.error("[Pikmin] Firestore read failed; local fallback enabled.", error);
      isUsingLocalFallback = true;
      setCacheFromLocal();
      try { onChange(); } catch (changeError) { console.error("[Pikmin] onChange fallback failed", changeError); }
    });
  } catch (error) {
    console.error("[Pikmin] Firestore listener failed; local fallback enabled.", error);
    isUsingLocalFallback = true;
    setCacheFromLocal();
    try { onChange(); } catch (changeError) { console.error("[Pikmin] onChange fallback failed", changeError); }
  }

  auth.signInAnonymously()
    .then(result => {
      currentUserId = result.user.uid;
      isAuthReady = true;
      localStorage.setItem(USER_ID_KEY, currentUserId);
      try { onChange(); } catch (error) { console.error("[Pikmin] onChange auth failed", error); }
    })
    .catch(error => {
      console.error("[Pikmin] anonymous auth failed; read-only/local write fallback enabled.", error);
      isAuthReady = false;
      ensureCurrentUserId();
      try { onChange(); } catch (changeError) { console.error("[Pikmin] onChange auth fallback failed", changeError); }
    });
}

function canWriteFirebase() {
  return Boolean(isFirebaseReady && db && isAuthReady && getCurrentUserId() && !isUsingLocalFallback);
}

function saveLocalMutation(nextList) {
  postcardsCache = nextList.map(item => normalizePostcard(item.id || createLocalId(), item));
  sortPostcards();
  writeLocalPostcards(postcardsCache);
}

async function addPostcard(postcard) {
  const data = {
    ...postcard,
    ownerId: getCurrentUserId(),
    category: postcard.category || "全球",
    likedBy: Array.isArray(postcard.likedBy) ? postcard.likedBy : [],
    likeCount: Number(postcard.likeCount || 0),
    createdAt: postcard.createdAt || new Date().toISOString()
  };

  if (canWriteFirebase()) {
    const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
    try {
      await db.collection(collectionName).add(data);
      return;
    } catch (error) {
      console.error("[Pikmin] Firebase add failed; saved locally.", error);
    }
  }

  saveLocalMutation([{ ...data, id: createLocalId() }, ...getPostcards()]);
}

async function deletePostcard(id) {
  const item = getPostcardById(id);
  if (!isOwnedByCurrentUser(item)) {
    alert("你只能刪除自己建立的明信片");
    return;
  }

  if (canWriteFirebase() && !String(id).startsWith("local_")) {
    const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
    try {
      await db.collection(collectionName).doc(id).delete();
      return;
    } catch (error) {
      console.error("[Pikmin] Firebase delete failed; deleted locally.", error);
    }
  }

  saveLocalMutation(getPostcards().filter(item => String(item.id) !== String(id)));
}

async function togglePostcardLike(id) {
  const userId = getCurrentUserId();
  const item = getPostcardById(id);
  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const hasLiked = likedBy.includes(userId);
  const nextLikedBy = hasLiked ? likedBy.filter(x => x !== userId) : [...likedBy, userId];
  const updates = { likedBy: nextLikedBy, likeCount: nextLikedBy.length };

  if (canWriteFirebase() && !String(id).startsWith("local_")) {
    const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
    try {
      await db.collection(collectionName).doc(id).update(updates);
      return;
    } catch (error) {
      console.error("[Pikmin] Firebase like failed; updated locally.", error);
    }
  }

  saveLocalMutation(getPostcards().map(card => String(card.id) === String(id) ? { ...card, ...updates } : card));
}

async function updatePostcard(id, updates) {
  const item = getPostcardById(id);
  if (!isOwnedByCurrentUser(item)) {
    alert("你只能編輯自己建立的明信片");
    return;
  }

  const payload = { ...updates, updatedAt: new Date().toISOString() };

  if (canWriteFirebase() && !String(id).startsWith("local_")) {
    const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
    try {
      await db.collection(collectionName).doc(id).update(payload);
      return;
    } catch (error) {
      console.error("[Pikmin] Firebase update failed; updated locally.", error);
    }
  }

  saveLocalMutation(getPostcards().map(card => String(card.id) === String(id) ? { ...card, ...payload } : card));
}
