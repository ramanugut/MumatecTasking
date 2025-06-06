import { db } from './firebase.js';
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const params = new URLSearchParams(window.location.search);
const boardId = params.get('id');
if (!boardId) {
  window.location.href = 'boards.html';
}
const boardTitleEl = document.getElementById('boardTitle');
const listsContainer = document.getElementById('listsContainer');
const addListForm = document.getElementById('addListForm');

async function loadBoard() {
  const boardRef = doc(db, 'boards', boardId);
  const snap = await getDoc(boardRef);
  if (snap.exists()) {
    boardTitleEl.textContent = snap.data().title;
    loadLists();
  }
}

function loadLists() {
  const listsCol = collection(db, 'boards', boardId, 'lists');
  const q = query(listsCol, orderBy('order'));
  onSnapshot(q, snap => {
    listsContainer.innerHTML = '';
    snap.forEach(d => {
      const list = d.data();
      const div = document.createElement('div');
      div.className = 'board-list';
      div.innerHTML = `
        <h3>${list.title}</h3>
        <div class="cards" id="cards-${d.id}"></div>
        <form data-list="${d.id}" class="add-card-form">
          <input type="text" placeholder="Add card" required />
        </form>
      `;
      listsContainer.appendChild(div);
      loadCards(d.id);
    });
  });
}

function loadCards(listId) {
  const cardsCol = collection(db, 'boards', boardId, 'lists', listId, 'cards');
  const q = query(cardsCol, orderBy('order'));
  onSnapshot(q, snap => {
    const container = document.getElementById(`cards-${listId}`);
    if (!container) return;
    container.innerHTML = '';
    snap.forEach(c => {
      const card = c.data();
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card-item';
      cardDiv.textContent = card.title;
      container.appendChild(cardDiv);
    });
  });
}

if (addListForm) {
  addListForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('listTitle').value.trim();
    const listsCol = collection(db, 'boards', boardId, 'lists');
    await addDoc(listsCol, { title, order: Date.now() });
    addListForm.reset();
  });
}

listsContainer.addEventListener('submit', async e => {
  if (!e.target.classList.contains('add-card-form')) return;
  e.preventDefault();
  const listId = e.target.getAttribute('data-list');
  const title = e.target.querySelector('input').value.trim();
  const cardsCol = collection(db, 'boards', boardId, 'lists', listId, 'cards');
  await addDoc(cardsCol, { title, order: Date.now(), createdAt: Timestamp.now() });
  e.target.reset();
});

loadBoard();
