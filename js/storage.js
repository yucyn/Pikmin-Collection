const USER_ID_KEY = "pikmin_current_user_id";

let postcardsCache = [];
let db = null;
let auth = null;
let currentUserId = null;
let isFirebaseReady = false;

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
    ownerId: data.ownerId || "",
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    likeCount: Number(data.likeCount || 0),
    locationText: data.locationText || "",
    lat: Number(data.lat),
    lng: Number(data.lng),
    createdAt: data.createdAt || new Date().toISOString()
  };
}

async function initializeAnonymousAuth() {
  auth = firebase.auth();

  if (auth.currentUser) {
    currentUserId = auth.currentUser.uid;
    localStorage.setItem(USER_ID_KEY, currentUserId);
    return currentUserId;
  }

  const result = await auth.signInAnonymously();
  currentUserId = result.user.uid;
  localStorage.setItem(USER_ID_KEY, currentUserId);

  return currentUserId;
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

  initializeAnonymousAuth()
    .then(function () {
      db = firebase.firestore();
      isFirebaseReady = true;

      db.collection(collectionName)
        .onSnapshot(snapshot => {
          postcardsCache = snapshot.docs.map(doc =>
            normalizePostcard(doc.id, doc.data())
          );

          postcardsCache.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );

          onChange();
        }, error => {
          console.error("Firestore 讀取失敗：", error);
          alert("Firestore 讀取失敗，請查看 Console");
        });
    })
    .catch(function (error) {
      console.error("匿名登入失敗：", error);
      alert("Firebase 匿名登入失敗，請確認 Authentication → Anonymous 已啟用");
    });
}

async function addPostcard(postcard) {
  if (!isFirebaseReady || !db || !getCurrentUserId()) {
    alert("Firebase 還沒準備好，請稍後再試");
    return;
  }

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
  if (!isFirebaseReady || !db) return;

  const item = getPostcardById(id);

  if (!isOwnedByCurrentUser(item)) {
    alert("你只能刪除自己建立的明信片");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  await db.collection(collectionName).doc(id).delete();
}

async function togglePostcardLike(id) {
  if (!isFirebaseReady || !db || !getCurrentUserId()) return;

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
