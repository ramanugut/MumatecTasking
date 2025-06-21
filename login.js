import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, collection, addDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { TOTP } from 'https://cdn.jsdelivr.net/npm/otpauth@9.0.0/dist/otpauth.esm.js';


const loginForm = document.getElementById('loginForm');
const totpContainer = document.getElementById('totpContainer');
const totpForm = document.getElementById('totpForm');
const totpInput = document.getElementById('totpCode');
const totpError = document.getElementById('totpError');

let pendingUser = null;
let pendingSecret = null;
let awaitingTotp = false;

async function recordLogin(user) {
  try {
    await addDoc(collection(db, 'users', user.uid, 'loginHistory'), {
      timestamp: new Date(),
      userAgent: navigator.userAgent
    });
  } catch (err) {
    console.error('Failed to record login', err);
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  const messages = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'Account disabled.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    const data = snap.exists() ? snap.data() : {};
    if (data.totpSecret) {
      awaitingTotp = true;
      pendingUser = cred.user;
      pendingSecret = data.totpSecret;
      loginForm.style.display = 'none';
      totpContainer.style.display = 'block';
    } else {
      await recordLogin(cred.user);
      window.location.href = 'index.html';
    }
  } catch (err) {
    errorEl.textContent = messages[err.code] || err.message;
  }
});

totpForm.addEventListener('submit', async e => {
  e.preventDefault();
  const totp = new TOTP({ secret: pendingSecret });
  const valid = totp.validate({ token: totpInput.value.trim() }) !== null;
  if (!valid) {
    totpError.textContent = 'Invalid code.';
    return;
  }
  awaitingTotp = false;
  await recordLogin(pendingUser);
  window.location.href = 'index.html';
});

onAuthStateChanged(auth, (user) => {
  if (user && !awaitingTotp) {
    window.location.href = 'index.html';
  }
});
