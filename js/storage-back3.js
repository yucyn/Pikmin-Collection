// V38: 最終穩定版 - 徹底移除所有可能導致衝突的變數宣告
// 直接操作 window 物件，確保跨檔案間的參照絕對同步

const USER_ID_KEY = "pikmin_current_user_id";

// 初始化全域容器（如果尚未存在）
if (typeof window.postcardsCache === "undefined") window.postcardsCache = [];
if (typeof window.db === "undefined") window.db = null;
if (typeof window.auth === "undefined") window.auth = null;
if (typeof window.isFirebaseReady === "undefined") window.isFirebaseReady = false;
if (typeof window.isAuthReady === "undefined") window.isAuthReady = false;

// 強制讓全域名稱可用
window.getAdminUids = function() {
  const list = window.PIKMIN_ADMIN_UIDS;
  return Array.isArray(list) && list.length ? list.filter(Boolean) : ["am42ZiJikLNEt8RSsWipgBDj4h32"];
};

window.isAdminUser = function() {
  return window.getAdminUids().includes(window.getCurrentUserId());
};

window.isCurrentUserAdmin = function() {
  try {
    if (window.PikminAuthGate && typeof window.PikminAuthGate.isFirebaseAdmin === "function") {
      return window.PikminAuthGate.isFirebaseAdmin();
    }
  } catch (e) {}
  if (window.auth && window.auth.currentUser) {
    return window.getAdminUids().includes(window.auth.currentUser.uid);
  }
  return false;
};

window.getCurrentUserId = function() {
  if (window.auth && window.auth.currentUser) return window.auth.currentUser.uid;
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id || id === "null" || id === "undefined") {
    id = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

window.getPostcards = function() { return window.postcardsCache || []; };

window.getPostcardById = function(id) {
  return (window.postcardsCache || []).find(item => String(item.id) === String(id));
};

window.isOwnedByCurrentUser = function(item) {
  return window.isAdminUser() || Boolean(item && item.ownerId && item.ownerId === window.getCurrentUserId());
};

function normalizePostcard(id, data) {
  if (!data) return null;
  const reviewStatus = data.reviewStatus || "approved";
  const visibility   = data.visibility   || "public";
  const isHidden = (data.isHidden !== undefined) ? Boolean(data.isHidden) : (visibility !== "public");
  return {
    id, ...data,
    category: data.category || "全球",
    tag: data.tag || "",
    beenThereBy: Array.isArray(data.beenThereBy) ? data.beenThereBy : [],
    likeCount: Number(data.likeCount ?? data.likes ?? (Array.isArray(data.likedBy) ? data.likedBy.length : 0)),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    createdAt: data.createdAt || new Date().toISOString(),
    reviewStatus, visibility, isHidden
  };
}

window.getVisiblePostcards = function() {
  const all = Array.isArray(window.postcardsCache) ? window.postcardsCache : [];
  const isAdmin = window.isCurrentUserAdmin();
  const currentUser = window.auth ? window.auth.currentUser : null;
  const isRealUser = !!(currentUser && !currentUser.isAnonymous);
  const myUid = currentUser ? currentUser.uid : null;

  if (isAdmin) return all;

  return all.filter(item => {
    if (!item) return false;
    if (item.reviewStatus === "approved" && item.visibility === "public") return true;
    if (item.reviewStatus === "approved" && item.visibility === "members") return isRealUser;
    if (myUid && item.ownerId === myUid) return true;
    return false;
  });
};

window.initializeFirebaseStorage = function(onChange) {
  const config = window.PIKMIN_FIREBASE_CONFIG;
  const collectionName = window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards";
  if (!config) return;

  if (!firebase.apps.length) firebase.initializeApp(config);
  window.db = firebase.firestore();
  window.isFirebaseReady = true;

  window.db.collection(collectionName).onSnapshot(snapshot => {
    window.postcardsCache = snapshot.docs.map(doc => normalizePostcard(doc.id, doc.data()));
    window.postcardsCache.sort((a,b) => (new Date(b.createdAt||0)) - (new Date(a.createdAt||0)));
    onChange();
  }, () => { onChange(); });

  window.auth = firebase.auth();
  window.auth.onAuthStateChanged(() => {
    window.isAuthReady = true;
    onChange();
    if (!window.auth.currentUser) window.auth.signInAnonymously().catch(()=>{});
  });
};

window.assertWriteReady = function() {
  return window.isFirebaseReady && window.db && window.auth && window.auth.currentUser;
};

window.addPostcard = async function(postcard) {
  if (!window.assertWriteReady()) throw new Error("Firebase 未就緒");
  const isAdmin = window.isCurrentUserAdmin();
  const isPublic = postcard.publicUnlock !== false;
  const defaults = isAdmin ? { reviewStatus: "approved", visibility: isPublic ? "public" : "hidden", isHidden: !isPublic }
                           : { reviewStatus: "pending", visibility: "hidden", isHidden: true };

  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").add({
    ...postcard, ...defaults, ownerId: window.getCurrentUserId(), createdAt: new Date().toISOString()
  });
  return true;
};

window.deletePostcard = async function(id) {
  if (!window.assertWriteReady()) return;
  const item = window.getPostcardById(id);
  if (!window.isOwnedByCurrentUser(item)) return;
  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").doc(id).delete();
};

window.reviewPostcard = async function(id, action) {
  if (!window.assertWriteReady() || !window.isCurrentUserAdmin()) return;
  if (action === "delete") return await window.deletePostcard(id);
  let updates = {};
  if (action === "approve_public") updates = { reviewStatus: "approved", visibility: "public", isHidden: false };
  else if (action === "approve_members") updates = { reviewStatus: "approved", visibility: "members", isHidden: false };
  else if (action === "reject") updates = { reviewStatus: "rejected", visibility: "hidden", isHidden: true };
  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").doc(id).update({
    ...updates, updatedAt: new Date().toISOString()
  });
};

window.updatePostcard = async function(id, data) {
  if (!window.assertWriteReady()) return false;
  const item = window.getPostcardById(id);
  if (!window.isOwnedByCurrentUser(item)) return false;
  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").doc(id).update({
    ...data, updatedAt: new Date().toISOString()
  });
  return true;
};
