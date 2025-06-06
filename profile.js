import { auth, db } from './firebase.js';
import { onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const photoEl = document.getElementById('photoURL');
const notifEl = document.getElementById('notifications');
const msgEl = document.getElementById('msg');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  emailEl.value = user.email;
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (snap.exists()) {
    const data = snap.data();
    nameEl.value = data.name || '';
    photoEl.value = data.photoURL || '';
    notifEl.checked = data.notifications !== false;
  }
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  const user = auth.currentUser;
  if (!user) return;
  const name = nameEl.value.trim();
  const photoURL = photoEl.value.trim();
  try {
    await updateProfile(user, { displayName: name, photoURL: photoURL || null });
    await setDoc(doc(db, 'users', user.uid), {
      name,
      email: user.email,
      photoURL: photoURL || null,
      notifications: notifEl.checked
    });
    msgEl.textContent = 'Profile updated';
  } catch (err) {
    msgEl.textContent = err.message;
  }
});
