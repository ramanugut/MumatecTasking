
import { auth, db, functions } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';


onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  if (user) {
    let role = null;
    let name = user.displayName || '';
    let docData = null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        docData = snap.data();
        role = docData.role || null;
        if (!name) name = docData.displayName || docData.name || '';
      }
    } catch (e) {
      console.error('Failed to fetch user role', e);
    }
    window.currentUserRole = role;
    // Update UI with name and role if elements exist
    const nameEl = document.getElementById('userName');
    if (nameEl && name) nameEl.textContent = name;
    const roleEl = document.getElementById('userRole');
    if (roleEl && role) roleEl.textContent = role;
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
      adminLink.style.display = role === 'admin' ? 'inline-block' : 'none';
    }
    try {
      const logLogin = httpsCallable(functions, 'logUserLogin');
      logLogin();
    } catch (e) {
      console.error('Failed to log login', e);
    }
    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});


window.logout = () => signOut(auth);
