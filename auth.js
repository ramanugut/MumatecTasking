import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  if (user) {
    let name = user.displayName || '';
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (!name) name = data.displayName || data.name || '';
      }
    } catch (e) {
      console.error('Failed to fetch user info', e);
    }
    const nameEl = document.getElementById('userName');
    if (nameEl && name) nameEl.textContent = name;
    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});

window.logout = () => signOut(auth);
