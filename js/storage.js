const USER_ID_KEY = "pikmin_current_user_id";

let postcardsCache = [];
let db = null;
let isFirebaseReady = false;

function getCurrentUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

function getPostcards() {
  return postcardsCache;
}

function getPostcardById(id) {
  return postcardsCache.find(item => String(item.id) === String(id));
}

function normalizePostcard(id, data) {
  return {
    id,
    image: data.image || "",
    category: data.category || "全球",
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    likeCount: Number(data.likeCount || 0),
    locationText: data.locationText || "",
    lat: Number(data.lat),
    lng: Number(data.lng),
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
}

async function addPostcard(postcard) {
  if (!isFirebaseReady || !db) {
    alert("Firebase 還沒準備好，請稍後再試");
    return;
  }

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  await db.collection(collectionName).add({
    ...postcard,
    category: postcard.category || "全球",
    likedBy: postcard.likedBy || [],
    likeCount: Number(postcard.likeCount || 0),
    createdAt: postcard.createdAt || new Date().toISOString()
  });
}

async function deletePostcard(id) {
  if (!isFirebaseReady || !db) return;

  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  await db.collection(collectionName).doc(id).delete();
}

async function togglePostcardLike(id) {
  if (!isFirebaseReady || !db) return;

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
  function isOwnedByCurrentUser(item) {
  const userId = getCurrentUserId();

  if (!item || !item.ownerId) {
    return false;
  }

  return item.ownerId === userId;
}
}
