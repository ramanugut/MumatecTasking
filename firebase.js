import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';


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
// Real-time database and Cloud Functions are not used in the simplified build

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Firestore persistence error:', err);
});

// Expose for non-module scripts
window.auth = auth;
window.db = db;


