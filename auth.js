
import { auth, db, functions, initPresence, rtdb } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { ref, set } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js';

const sessionId = localStorage.getItem('sessionId') || Math.random().toString(36).slice(2);
localStorage.setItem('sessionId', sessionId);
const logSession = httpsCallable(functions, 'logUserSession');


onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  if (user) {
    try {
      await logSession({ action: 'start', sessionId, userAgent: navigator.userAgent });
    } catch (e) {
      console.error('Failed to start session', e);
    }
    initPresence(user.uid);
    let role = null;
    let name = user.displayName || '';
    let docData = null;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        docData = snap.data();
        role = docData.role || null;
        if (!name) name = docData.displayName || docData.name || '';
        if (docData.guestExpiresAt && docData.guestExpiresAt.toDate() < new Date()) {
          alert('Your temporary access has expired.');
          await signOut(auth);
          return;
        }
        if (docData.onboarded === false && !location.pathname.endsWith('onboarding.html') && !location.pathname.endsWith('client-onboarding.html')) {
          if (role === 'client') {
            window.location.href = 'client-onboarding.html';
          } else {
            window.location.href = 'onboarding.html';
          }
          return;
        }
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
      adminLink.style.display = ['admin','superAdmin'].includes(role) ? 'inline-block' : 'none';
    }
    const orgLink = document.getElementById('orgLink');
    if (orgLink) {
      orgLink.style.display = ['admin','superAdmin'].includes(role) ? 'inline-block' : 'none';
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



window.logout = () => {
  const uid = auth.currentUser?.uid;
  if (uid) {
    set(ref(rtdb, `presence/${uid}`), { state: 'offline', lastChanged: Date.now() });
    logSession({ action: 'end', sessionId }).catch(()=>{});
  }
  return signOut(auth);
};

window.addEventListener('beforeunload', () => {
  if (auth.currentUser) {
    logSession({ action: 'end', sessionId }).catch(()=>{});
  }
});
