import { auth, db } from './firebase.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('clientDone').addEventListener('click', async () => {
    await updateDoc(doc(db, 'users', user.uid), { onboarded: true });
    window.location.href = 'index.html';
  });
});
