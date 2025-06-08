import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const chartEl = document.getElementById('chart');

function buildTree(users) {
  const byId = {};
  users.forEach(u => { byId[u.id] = { ...u, children: [] }; });
  const roots = [];
  users.forEach(u => {
    const node = byId[u.id];
    if (u.managerUid && byId[u.managerUid]) {
      byId[u.managerUid].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function renderNode(node) {
  const li = document.createElement('li');
  li.textContent = `${node.displayName || node.email}${node.jobTitle ? ' - ' + node.jobTitle : ''}`;
  if (node.children.length) {
    const ul = document.createElement('ul');
    node.children.forEach(c => ul.appendChild(renderNode(c)));
    li.appendChild(ul);
  }
  return li;
}

function renderTree(roots) {
  chartEl.innerHTML = '';
  const ul = document.createElement('ul');
  roots.forEach(r => ul.appendChild(renderNode(r)));
  chartEl.appendChild(ul);
}

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const tree = buildTree(users);
  renderTree(tree);
});
