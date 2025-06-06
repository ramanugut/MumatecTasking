
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDT01V2niUl83vaYXUEukc5fGzUppwfQEI",
  authDomain: "mumatectasking.firebaseapp.com",
  projectId: "mumatectasking",
  storageBucket: "mumatectasking.firebasestorage.app",
  messagingSenderId: "10382608024",
  appId: "1:10382608024:web:f8a04a0196b97e6b0f32ed",
  measurementId: "G-09GVTSPW3W"

};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
