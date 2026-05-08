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
window.isLikedByCurrentUser = function(item, cachedUserId) {
  const userId = cachedUserId || window.getCurrentUserId();
  return Array.isArray(item.likedBy) && item.likedBy.includes(userId);
};

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

window.getPostcardImageSrc = function(card) {
  if (!card) return "";
  return card.imageUrl || card.imageBase64 || card.image || "";
};

window.uploadImageToStorage = async function(base64Data) {
  if (!base64Data || !base64Data.startsWith("data:")) return base64Data;
  console.log("開始準備上傳至 Storage...");
  try {
    const storage = firebase.storage();
    const filename = `postcards/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const storageRef = storage.ref().child(filename);
    
    console.log("正在上傳圖片資料 (Base64)...", filename);
    // 使用 putString 上傳 Data URL
    const snapshot = await storageRef.putString(base64Data, 'data_url');
    console.log("上傳完成，正在取得下載網址...");
    const downloadURL = await snapshot.ref.getDownloadURL();
    console.log("取得網址成功:", downloadURL);
    return downloadURL;
  } catch (err) {
    console.error("Storage 上傳詳細錯誤:", err);
    // 針對常見錯誤進行提示
    let errMsg = "圖片儲存失敗。";
    if (err.code === 'storage/unauthorized') {
      errMsg += " (權限不足，請檢查 Firebase Storage Rules)";
    } else if (err.message && err.message.includes("CORS")) {
      errMsg += " (跨網域錯誤 CORS，請設定 Storage CORS)";
    } else {
      errMsg += ` (${err.message || "未知錯誤"})`;
    }
    throw new Error(errMsg);
  }
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
    // 公開項目：所有人可見
    if (item.reviewStatus === "approved" && item.visibility === "public") return true;
    // 會員項目：所有人皆可見到（但在 render 時會根據權限顯示為 "待解鎖"）
    if (item.reviewStatus === "approved" && item.visibility === "members") return true;
    // 自己上傳的項目：始終可見
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
    // V38 優化：使用 ISO 字串直接進行字典排序，避免大量 new Date() 造成的 CPU 負擔
    window.postcardsCache.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
  
  // V39: 新增上傳流程 - 優先上傳圖片到 Storage
  let finalImageUrl = "";
  if (postcard.image && postcard.image.startsWith("data:")) {
    finalImageUrl = await window.uploadImageToStorage(postcard.image);
  }

  const isAdmin = window.isCurrentUserAdmin();
  const isPublic = postcard.publicUnlock !== false;
  const defaults = isAdmin ? { reviewStatus: "approved", visibility: isPublic ? "public" : "hidden", isHidden: !isPublic }
                           : { reviewStatus: "pending", visibility: "hidden", isHidden: true };

  // 移除原本的 image 字串，改存 imageUrl
  const { image, ...restOfPostcard } = postcard;

  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").add({
    ...restOfPostcard, 
    imageUrl: finalImageUrl,
    ...defaults, 
    ownerId: window.getCurrentUserId(), 
    createdAt: new Date().toISOString()
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
  if (!window.assertWriteReady()) {
    console.error("Update failed: DB not ready");
    return false;
  }
  const item = window.getPostcardById(id);
  if (!window.isOwnedByCurrentUser(item)) {
    alert("權限不足：您不是此明信片的擁有者，或管理員權限判定失敗。");
    return false;
  }
  try {
    await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").doc(id).update({
      ...data, updatedAt: new Date().toISOString()
    });
    return true;
  } catch (e) {
    console.error("Firestore Update Error:", e);
    alert("資料庫更新失敗：" + e.message);
    return false;
  }
};

window.togglePostcardLike = async function(id) {
  if (!window.assertWriteReady()) throw new Error("請先登入以使用收藏功能");
  const userId = window.getCurrentUserId();
  const item = window.getPostcardById(id);
  if (!item) return;

  const likedBy = Array.isArray(item.likedBy) ? [...item.likedBy] : [];
  const index = likedBy.indexOf(userId);
  let nextLikedBy;
  let increment;

  if (index === -1) {
    nextLikedBy = [...likedBy, userId];
    increment = 1;
  } else {
    nextLikedBy = likedBy.filter(uid => uid !== userId);
    increment = -1;
  }

  const nextLikeCount = Math.max(0, (Number(item.likeCount) || 0) + increment);

  await window.db.collection(window.PIKMIN_FIREBASE_COLLECTION || "pikmin_postcards").doc(id).update({
    likedBy: nextLikedBy,
    likeCount: nextLikeCount,
    updatedAt: new Date().toISOString()
  });
};
