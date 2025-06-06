import { db, auth } from './firebase.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const boardsListEl = document.getElementById('boardsList');
const createForm = document.getElementById('createBoardForm');

function renderBoards(boards) {
  boardsListEl.innerHTML = '';
  boards.forEach(b => {
    const div = document.createElement('div');
    div.className = 'board-item';
    div.innerHTML = `
      <h3>${b.title}</h3>
      <p>${b.description || ''}</p>
      <a href="board.html?id=${b.id}">Open</a>
    `;
    boardsListEl.appendChild(div);
  });
}

function loadBoards() {
  const user = auth.currentUser;
  if (!user) return;
  const q = query(collection(db, 'boards'), where('members', 'array-contains', user.uid));
  onSnapshot(q, snap => {
    const boards = [];
    snap.forEach(doc => boards.push({ id: doc.id, ...doc.data() }));
    renderBoards(boards);
  });
}

if (createForm) {
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('boardTitle').value.trim();
    const description = document.getElementById('boardDesc').value.trim();
    const visibility = document.getElementById('boardVisibility').value;
    const user = auth.currentUser;
    await addDoc(collection(db, 'boards'), {
      title,
      description,
      visibility,
      ownerId: user.uid,
      members: [user.uid],
      createdAt: Timestamp.now()
    });
    createForm.reset();
  });
}

loadBoards();
