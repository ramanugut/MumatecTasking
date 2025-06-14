
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { getFunctions } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { getDatabase, ref, onDisconnect, set } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js';


export const firebaseConfig = {
  apiKey: "AIzaSyDT01V2niUl83vaYXUEukc5fGzUppwfQEI",
  authDomain: "mumatectasking.firebaseapp.com",
  projectId: "mumatectasking",
  storageBucket: "mumatectasking.appspot.com",
  messagingSenderId: "10382608024",
  appId: "1:10382608024:web:0d94eae7dcb524b40f32ed",
  measurementId: "G-57MJ7G5HX2"
  };


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const rtdb = getDatabase(app);

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Firestore persistence error:', err);
});

// Expose for non-module scripts
window.auth = auth;
window.db = db;
window.functions = functions;
window.rtdb = rtdb;

export function initPresence(uid) {
  if (!uid) return;
  const userRef = ref(rtdb, `presence/${uid}`);
  set(userRef, { state: 'online', lastChanged: Date.now() });
  onDisconnect(userRef).set({ state: 'offline', lastChanged: Date.now() });
}
