// Firebase 設定檔
// 1. 到 Firebase Console 建立 Web App
// 2. 複製 firebaseConfig 後貼到下面
// 3. 沒填設定時，系統會自動退回 localStorage 測試模式

 const firebaseConfig = {
    apiKey: "AIzaSyAZDSSH1IPKg5f0H59Rs7cuI_UfgpHfZ7E",
    authDomain: "pikmin-collection.firebaseapp.com",
    databaseURL: "https://pikmin-collection-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pikmin-collection",
    storageBucket: "pikmin-collection.firebasestorage.app",
    messagingSenderId: "727063039400",
    appId: "1:727063039400:web:10ca96f30693d9c671e19d",
    measurementId: "G-30MNTMTE3N"
  };

window.PIKMIN_FIREBASE_COLLECTION = "pikmin_postcards";
