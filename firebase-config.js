// ============================================
// FIREBASE CONFIG
// Uses FREE Firebase Realtime Database
// Users need to set up their own Firebase project
// OR use the default demo config below
// ============================================

// HOW TO SET UP YOUR OWN (FREE):
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (free)
// 3. Add a Realtime Database (start in test mode)
// 4. Replace the config below with yours
// 5. Deploy to GitHub Pages - DONE!

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDemo-Replace-With-Your-Own-Key",
  authDomain: "ludo-royal-demo.firebaseapp.com",
  databaseURL: "https://ludo-royal-demo-default-rtdb.firebaseio.com",
  projectId: "ludo-royal-demo",
  storageBucket: "ludo-royal-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

// ============================================
// LOAD FIREBASE SDKs DYNAMICALLY
// ============================================
(function loadFirebase() {
  const scripts = [
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"
  ];
  let loaded = 0;
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => {
      loaded++;
      if (loaded === scripts.length) {
        window._firebaseReady = true;
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        document.dispatchEvent(new Event('firebase-ready'));
      }
    };
    document.head.appendChild(s);
  });
})();
