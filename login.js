import { auth } from './firebase.js';

import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';


document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);

    window.location.href = 'index.html';

  } catch (err) {
    errorEl.textContent = err.message;
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  }
});
