import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

onAuthStateChanged(auth, (user) => {
  window.currentUser = user;
  if (user) {
    updateUserUI(user);
    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});

async function updateUserUI(user) {
  const snap = await getDoc(doc(db, 'users', user.uid));
  const data = snap.exists() ? snap.data() : {};
  const nameEl = document.querySelector('.user-name');
  if (nameEl) nameEl.textContent = data.name || user.email;
  const avatarEl = document.querySelector('.user-avatar');
  if (avatarEl && data.photoURL) {
    avatarEl.innerHTML = `<img src="${data.photoURL}" alt="avatar" style="width:32px;height:32px;border-radius:50%">`;
  }
}

window.logout = () => signOut(auth);
