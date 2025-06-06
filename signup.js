import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const photoURL = document.getElementById('photoURL').value.trim();
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      photoURL: photoURL || null,
      notifications: true
    });
    window.location.href = 'index.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
