import { auth } from './firebase.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';

document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const msgEl = document.getElementById('msg');
  msgEl.textContent = '';
  try {
    await sendPasswordResetEmail(auth, email);
    msgEl.textContent = 'Password reset email sent!';
  } catch (err) {
    msgEl.textContent = err.message;
  }
});
