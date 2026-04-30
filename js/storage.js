const USER_ID_KEY = "pikmin_current_user_id";

let postcardsCache = [];
let db = null;
let auth = null;
let currentUserId = localStorage.getItem(USER_ID_KEY) || "";
let isFirebaseReady = false;
let isAuthReady = false;

function getCurrentUserId() {
  return currentUserId || localStorage.getItem(USER_ID_KEY) || "";
}

function getPostcards() {
  return postcardsCache;
}

function getPostcardById(id) {
  return postcardsCache.find(item => String(item.id) === String(id));
}

function isOwnedByCurrentUser(item) {
  return Boolean(item && item.ownerId && item.ownerId === getCurrentUserId());
}

function normalizePostcard(id, data) {
  return {
    id,
    image: data.image || "",
    category: data.category || "全球",
    tag: data.tag || "", // 🔥 加這行
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
  isFirebaseReady = true;

  db.collection(collectionName).onSnapshot(snapshot => {
    postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
    postcardsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    onChange();
  }, error => {
    console.error("Firestore 讀取失敗：", error);
    alert("Firestore 讀取失敗，請查看 Console");
  });

  auth = firebase.auth();
  auth.signInAnonymously()
    .then(result => {
      currentUserId = result.user.uid;
      isAuthReady = true;
      localStorage.setItem(USER_ID_KEY, currentUserId);
      onChange();
    })
    .catch(error => {
      console.error("匿名登入失敗：", error);
      isAuthReady = false;
    });
}

function assertWriteReady() {
  if (!isFirebaseReady || !db) {
    alert("Firebase 還沒準備好，請稍後再試");
    return false;
  }

  if (!isAuthReady || !getCurrentUserId()) {
    alert("目前網域尚未通過 Firebase 匿名登入授權，或 API key 設定有誤。請檢查 Authentication → 設定 → 授權網域，並確認 firebaseConfig.js。");
    return false;
  }

  return true;
}

async function addPostcard(postcard) {
  if (!assertWriteReady()) return;

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

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
  if (!assertWriteReady()) return;

  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能刪除自己建立的明信片");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  await db.collection(collectionName).doc(id).delete();
}

async function togglePostcardLike(id) {
  if (!assertWriteReady()) return;

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const item = getPostcardById(id);

  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const hasLiked = likedBy.includes(userId);

  const nextLikedBy = hasLiked
    ? likedBy.filter(x => x !== userId)
    : [...likedBy, userId];

  await db.collection(collectionName).doc(id).update({
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length
  });
}
async function updatePostcard(id, updates) {
  if (!assertWriteReady()) return;

  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能編輯自己建立的明信片");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  await db.collection(collectionName).doc(id).update({
    ...updates,
    updatedAt: new Date().toISOString()
  });
}
