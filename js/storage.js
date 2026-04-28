const app = firebase.initializeApp(window.PIKMIN_FIREBASE_CONFIG);
const db = firebase.firestore();

let currentUser = null;

firebase.auth().signInAnonymously();

firebase.auth().onAuthStateChanged(user => {
  currentUser = user;
});

function addPostcard(data) {
  return db.collection(window.PIKMIN_FIREBASE_COLLECTION).add({
    ...data,
    ownerId: currentUser?.uid || null,
    createdAt: new Date().toISOString(),
    likeCount: 0
  });
}

function subscribePostcards(callback) {
  return db.collection(window.PIKMIN_FIREBASE_COLLECTION)
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(list);
    });
}
