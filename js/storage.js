const STORAGE_KEY = "pikmin_postcards_v3_fallback";
const USER_ID_KEY = "pikmin_current_user_id";

let postcardsCache = [];
let db = null;
let isFirebaseReady = false;
let unsubscribePostcards = null;

function isValidFirebaseConfig(config) {
  return Boolean(
    config &&
    config.apiKey &&
    config.projectId &&
    !String(config.apiKey).includes("PASTE_") &&
    !String(config.projectId).includes("PASTE_")
  );
}

function getCurrentUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

function normalizePostcard(docId, data) {
  return {
    id: docId || data.id || String(Date.now()),
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

function sortPostcards(list) {
  return list.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

function loadLocalPostcards() {
  try {
    postcardsCache = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    postcardsCache = [];
  }
}

function saveLocalPostcards() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(postcardsCache));
}

function initializeFirebaseStorage(onChange) {
  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";

  if (isValidFirebaseConfig(config) && window.firebase) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      db = firebase.firestore();
      isFirebaseReady = true;

      if (unsubscribePostcards) unsubscribePostcards();

      unsubscribePostcards = db
        .collection(collectionName)
        .orderBy("createdAt", "desc")
        .onSnapshot(function (snapshot) {
          postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
          onChange();
        }, function (error) {
          console.error("Firestore 讀取失敗，改用 localStorage：", error);
          isFirebaseReady = false;
          loadLocalPostcards();
          onChange();
        });

      return;
    } catch (error) {
      console.error("Firebase 初始化失敗，改用 localStorage：", error);
    }
  }

  isFirebaseReady = false;
  loadLocalPostcards();
  onChange();
}

function getPostcards() {
  return postcardsCache;
}

function getPostcardById(id) {
  return getPostcards().find(item => String(item.id) === String(id));
}

async function addPostcard(postcard) {
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const data = {
    ...postcard,
    category: postcard.category || "全球",
    likedBy: Array.isArray(postcard.likedBy) ? postcard.likedBy : [],
    likeCount: Number(postcard.likeCount || 0),
    createdAt: postcard.createdAt || new Date().toISOString()
  };

  if (isFirebaseReady && db) {
    const ref = await db.collection(collectionName).add(data);
    return ref.id;
  }

  const localCard = {
    ...data,
    id: data.id || String(Date.now())
  };

  postcardsCache.unshift(localCard);
  saveLocalPostcards();
  return localCard.id;
}

async function deletePostcard(indexOrId) {
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const item = typeof indexOrId === "number"
    ? postcardsCache[indexOrId]
    : getPostcardById(indexOrId);

  if (!item) return;

  if (isFirebaseReady && db) {
    await db.collection(collectionName).doc(item.id).delete();
    return;
  }

  postcardsCache = postcardsCache.filter(card => card.id !== item.id);
  saveLocalPostcards();
}

async function togglePostcardLike(indexOrId) {
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  const userId = getCurrentUserId();
  const item = typeof indexOrId === "number"
    ? postcardsCache[indexOrId]
    : getPostcardById(indexOrId);

  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? item.likedBy : [];
  const hasLiked = likedBy.includes(userId);
  const nextLikedBy = hasLiked
    ? likedBy.filter(id => id !== userId)
    : [...likedBy, userId];

  const nextData = {
    likedBy: nextLikedBy,
    likeCount: nextLikedBy.length
  };

  if (isFirebaseReady && db) {
    await db.collection(collectionName).doc(item.id).update(nextData);
    return;
  }

  postcardsCache = postcardsCache.map(card => {
    if (card.id !== item.id) return card;
    return { ...card, ...nextData };
  });

  saveLocalPostcards();
}
