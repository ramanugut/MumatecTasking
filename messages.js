import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, addDoc, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const userList = document.getElementById('userList');
const chatSection = document.getElementById('chatSection');
const chatWith = document.getElementById('chatWith');
const messagesEl = document.getElementById('messages');
const msgForm = document.getElementById('msgForm');
const msgInput = document.getElementById('msgInput');

let currentUser = null;
let currentTarget = null;
let unsub = null;

function convoId(a, b) {
  return [a, b].sort().join('_');
}

async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  userList.innerHTML = '';
  snap.forEach(docSnap => {
    if (docSnap.id === currentUser.uid) return;
    const d = docSnap.data();
    const btn = document.createElement('button');
    btn.textContent = d.displayName || d.email;
    btn.addEventListener('click', () => openChat(docSnap.id, d));
    userList.appendChild(btn);
  });
}

function openChat(uid, data) {
  currentTarget = uid;
  chatWith.textContent = data.displayName || data.email;
  chatSection.style.display = 'block';
  if (unsub) unsub();
  const q = query(collection(db, 'messages', convoId(currentUser.uid, uid), 'msgs'), orderBy('ts'));
  unsub = onSnapshot(q, snap => {
    messagesEl.innerHTML = '';
    snap.forEach(m => {
      const d = m.data();
      const div = document.createElement('div');
      div.textContent = `${d.from === currentUser.uid ? 'Me' : chatWith.textContent}: ${d.text}`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

msgForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentTarget || !msgInput.value.trim()) return;
  const ref = collection(db, 'messages', convoId(currentUser.uid, currentTarget), 'msgs');
  await addDoc(ref, { from: currentUser.uid, text: msgInput.value.trim(), ts: Date.now() });
  msgInput.value = '';
});

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  loadUsers();
});
