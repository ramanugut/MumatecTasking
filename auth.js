
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';


onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  if (user) {
    let role = null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) role = snap.data().role;
    } catch (e) {
      console.error('Failed to fetch user role', e);
    }
    window.currentUserRole = role;
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
      adminLink.style.display = role === 'admin' ? 'inline-block' : 'none';
    }
    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});


window.logout = () => signOut(auth);
