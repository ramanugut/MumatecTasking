import { auth, db } from './firebase.js';
import { onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, updateDoc, deleteField } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { TOTP, Secret } from 'https://cdn.jsdelivr.net/npm/otpauth@9.0.0/dist/otpauth.esm.js';

const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const tzInput = document.getElementById('timezone');
const langInput = document.getElementById('language');
const profileForm = document.getElementById('profileForm');
const profileMsg = document.getElementById('profileMsg');

const pwResetForm = document.getElementById('pwResetForm');
const pwMsg = document.getElementById('pwMsg');

const enableBtn = document.getElementById('enableTotp');
const disableBtn = document.getElementById('disableTotp');
const totpStatus = document.getElementById('totpStatus');
const totpSetup = document.getElementById('totpSetup');
const totpForm = document.getElementById('totpForm');
const totpSecretEl = document.getElementById('totpSecret');
const totpCodeInput = document.getElementById('totpCode');
const totpError = document.getElementById('totpError');

let currentUser = null;
let tempSecret = null;

function showEnabled() {
  totpStatus.textContent = 'Two-factor authentication is enabled.';
  enableBtn.style.display = 'none';
  disableBtn.style.display = 'block';
  totpSetup.style.display = 'none';
}

function showDisabled() {
  totpStatus.textContent = 'Two-factor authentication is not enabled.';
  enableBtn.style.display = 'block';
  disableBtn.style.display = 'none';
  totpSetup.style.display = 'none';
  totpSecretEl.textContent = '';
  totpCodeInput.value = '';
  totpError.textContent = '';
}

enableBtn?.addEventListener('click', () => {
  tempSecret = Secret.generate();
  totpSecretEl.textContent = tempSecret.base32;
  totpSetup.style.display = 'block';
});

totpForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const totp = new TOTP({ secret: tempSecret });
  const valid = totp.validate({ token: totpCodeInput.value.trim() }) !== null;
  if (!valid) {
    totpError.textContent = 'Invalid code.';
    return;
  }
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { totpSecret: tempSecret.base32 });
    showEnabled();
  } catch (err) {
    totpError.textContent = err.message;
  }
});

disableBtn?.addEventListener('click', async () => {
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), { totpSecret: deleteField() });
    showDisabled();
  } catch (err) {
    totpStatus.textContent = err.message;
  }
});

profileForm?.addEventListener('submit', async e => {
  e.preventDefault();
  profileMsg.textContent = '';
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      timezone: tzInput.value.trim(),
      language: langInput.value.trim()
    });
    profileMsg.textContent = 'Profile updated.';
  } catch (err) {
    profileMsg.textContent = err.message;
  }
});

pwResetForm?.addEventListener('submit', async e => {
  e.preventDefault();
  pwMsg.textContent = '';
  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    pwMsg.textContent = 'Reset email sent.';
  } catch (err) {
    pwMsg.textContent = err.message;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      nameInput.value = data.name || data.displayName || '';
      phoneInput.value = data.phone || '';
      tzInput.value = data.timezone || '';
      langInput.value = data.language || '';
      if (data.totpSecret) {
        showEnabled();
      } else {
        showDisabled();
      }
    } else {
      showDisabled();
    }
  } catch (err) {
    console.error('Failed to load profile', err);
  }
});
