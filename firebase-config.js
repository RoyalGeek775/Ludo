// ============================================
// LUDO ROYAL — Firebase Config
// ============================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXbKc8dr-qOTfSD87BlluX255QpdWhBho",
  authDomain: "ludo-f404e.firebaseapp.com",
  databaseURL: "https://ludo-f404e-default-rtdb.firebaseio.com",
  projectId: "ludo-f404e",
  storageBucket: "ludo-f404e.firebasestorage.app",
  messagingSenderId: "359777043287",
  appId: "1:359777043287:web:ecaca7e3c7155da36b7412",
  measurementId: "G-DZRSX52KEH"
};

// Load Firebase SDKs sequentially (database depends on app being loaded first)
(function loadFirebase() {
  const scripts = [
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"
  ];

  function loadNext(index) {
    if (index >= scripts.length) {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      window._firebaseReady = true;
      document.dispatchEvent(new Event('firebase-ready'));
      return;
    }
    const s = document.createElement('script');
    s.src = scripts[index];
    s.onload = () => loadNext(index + 1);
    s.onerror = () => console.error('Failed to load:', scripts[index]);
    document.head.appendChild(s);
  }

  loadNext(0);
})();
