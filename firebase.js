
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDT01V2niUl83vaYXUEukc5fGzUppwfQEI",
  authDomain: "mumatectasking.firebaseapp.com",
  projectId: "mumatectasking",
  storageBucket: "mumatectasking.firebasestorage.app",
  messagingSenderId: "659745805145",
  appId: "1:659745805145:web:abb6f7a2629978846e7248",
  measurementId: "G-BFBY59K73J"

};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
