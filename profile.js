import { auth, db, functions } from './firebase.js';
import { onAuthStateChanged, updateProfile, updatePassword } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-storage.js';

const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const avatarEl = document.getElementById('avatar');
const avatarPreview = document.getElementById('avatarPreview');
const jobEl = document.getElementById('jobTitle');
const deptEl = document.getElementById('department');
const phoneEl = document.getElementById('phone');
const tzEl = document.getElementById('timezone');
const skillsEl = document.getElementById('skills');
const statusEl = document.getElementById('status');
const emailNotifEl = document.getElementById('emailNotif');
const pushNotifEl = document.getElementById('pushNotif');
const msgEl = document.getElementById('msg');
const newPassEl = document.getElementById('newPassword');
const confirmPassEl = document.getElementById('confirmPassword');
const changePassBtn = document.getElementById('changePassword');
const setup2faBtn = document.getElementById('setup2fa');
const sessionInfo = document.getElementById('sessionInfo');
const sessionsList = document.getElementById('sessionsList');
let cropper;

avatarEl.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  avatarPreview.src = url;
  avatarPreview.style.display = 'block';
  if (cropper) cropper.destroy();
  cropper = new window.Cropper(avatarPreview, { aspectRatio: 1, viewMode: 1 });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  emailEl.value = user.email;
  sessionInfo.textContent = `Last sign-in: ${user.metadata.lastSignInTime}`;
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (snap.exists()) {
    const data = snap.data();
    nameEl.value = data.name || '';
    jobEl.value = data.jobTitle || '';
    deptEl.value = data.department || '';
    phoneEl.value = data.phone || '';
    tzEl.value = data.timezone || '';
    const skillVals = data.skills || [];
    Array.from(skillsEl.options).forEach(opt => {
      opt.selected = skillVals.includes(opt.value);
    });
    statusEl.value = data.status || 'online';
    emailNotifEl.checked = data.notifications?.email !== false;
    pushNotifEl.checked = data.notifications?.push || false;
    if (data.photoURL) {
      avatarPreview.src = data.photoURL;
      avatarPreview.style.display = 'block';
    }
  }
  loadSessions(user.uid);
});

async function loadSessions(uid) {
  if (!sessionsList) return;
  const snap = await getDocs(collection(db, 'users', uid, 'sessions'));
  sessionsList.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const li = document.createElement('li');
    const start = d.startAt ? new Date(d.startAt.seconds * 1000).toLocaleString() : '';
    const end = d.endAt ? new Date(d.endAt.seconds * 1000).toLocaleString() : '';
    const active = d.active !== false;
    li.innerHTML = `${d.userAgent || 'device'} - ${start} ${active ? '(active)' : '(ended ' + end + ')' } <button data-end="${docSnap.id}">End</button>`;
    sessionsList.appendChild(li);
  });
}

sessionsList?.addEventListener('click', async e => {
  if (e.target.dataset.end) {
    const fn = httpsCallable(functions, 'logUserSession');
    await fn({ action: 'end', sessionId: e.target.dataset.end });
    loadSessions(auth.currentUser.uid);
  }
});

async function uploadAvatar(uid) {
  if (!cropper) return null;
  const storage = getStorage();
  const avatarRef = ref(storage, `avatars/${uid}.jpg`);
  const canvas = cropper.getCroppedCanvas({ width: 300, height: 300 });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
  await uploadBytes(avatarRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(avatarRef);
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  msgEl.textContent = '';
  const user = auth.currentUser;
  if (!user) return;
  const name = nameEl.value.trim();
  let photoURL = null;
  if (cropper) {
    photoURL = await uploadAvatar(user.uid);
  }
  const skillsArr = Array.from(skillsEl.selectedOptions).map(o => o.value);
  try {
    await updateProfile(user, { displayName: name, photoURL: photoURL || user.photoURL || null });
    await setDoc(doc(db, 'users', user.uid), {
      name,
      email: user.email,
      photoURL: photoURL || user.photoURL || null,
      jobTitle: jobEl.value.trim(),
      department: deptEl.value.trim(),
      phone: phoneEl.value.trim(),
      timezone: tzEl.value.trim(),
      skills: skillsArr,
      status: statusEl.value,
      notifications: { email: emailNotifEl.checked, push: pushNotifEl.checked }
    }, { merge: true });
    msgEl.textContent = 'Profile updated';
  } catch (err) {
    msgEl.textContent = err.message;
  }
});

changePassBtn.addEventListener('click', async () => {
  msgEl.textContent = '';
  if (newPassEl.value !== confirmPassEl.value) {
    msgEl.textContent = 'Passwords do not match';
    return;
  }
  try {
    await updatePassword(auth.currentUser, newPassEl.value);
    msgEl.textContent = 'Password changed';
    newPassEl.value = '';
    confirmPassEl.value = '';
  } catch (err) {
    msgEl.textContent = err.message;
  }
});

setup2faBtn.addEventListener('click', () => {
  alert('2FA setup not implemented in this demo');
});
