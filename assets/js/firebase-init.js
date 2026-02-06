// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDbfk_o3gLvN_CplkHwyJvuZFcJrS2qbqY",
  authDomain: "supermax-8f827.firebaseapp.com",
  projectId: "supermax-8f827",
  storageBucket: "supermax-8f827.firebasestorage.app",
  messagingSenderId: "850750232390",
  appId: "1:850750232390:web:57bab74a19863277313747",
  measurementId: "G-8EYCBJ79LX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
let storage = null;
try {
  const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js");
  storage = getStorage(app);
} catch (e) {
  console.warn("Firebase Storage not loaded:", e);
}

// Expose for use in non-module scripts (optional)
if (typeof window !== "undefined") {
  window.firebaseApp = app;
  window.firebaseAnalytics = analytics;
  window.firebaseDb = db;
  window.firebaseStorage = storage;
  window.dispatchEvent(new CustomEvent("firebaseReady"));
}

export { app, analytics, db, storage };
