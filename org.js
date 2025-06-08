import { auth, db, functions } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const unauthEl = document.getElementById('unauthOrg');
const controlsEl = document.getElementById('orgControls');
const teamNameInput = document.getElementById('teamName');
const btnCreateTeam = document.getElementById('btnCreateTeam');
const clientNameInput = document.getElementById('clientName');
const btnCreateClient = document.getElementById('btnCreateClient');
const projectNameInput = document.getElementById('projectName');
const btnCreateProject = document.getElementById('btnCreateProject');
const projectTeamSelect = document.getElementById('projectTeam');
const projectClientSelect = document.getElementById('projectClient');
const teamsTableBody = document.querySelector('#teamsTable tbody');
const projectsTableBody = document.querySelector('#projectsTable tbody');

function optionHtml(id, name){
  return `<option value="${id}">${name}</option>`;
}

async function loadTeams(){
  const snap = await getDocs(collection(db, 'teams'));
  projectTeamSelect.innerHTML = '<option value="">--none--</option>';
  teamsTableBody.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    projectTeamSelect.insertAdjacentHTML('beforeend', optionHtml(docSnap.id, d.name));
    teamsTableBody.insertAdjacentHTML('beforeend', `<tr><td>${docSnap.id}</td><td>${d.name}</td></tr>`);
  });
}

async function loadClients(){
  const snap = await getDocs(collection(db, 'clients'));
  projectClientSelect.innerHTML = '<option value="">--none--</option>';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    projectClientSelect.insertAdjacentHTML('beforeend', optionHtml(docSnap.id, d.name));
  });
}

async function loadProjects(){
  const snap = await getDocs(collection(db, 'projects'));
  projectsTableBody.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    projectsTableBody.insertAdjacentHTML('beforeend', `<tr><td>${docSnap.id}</td><td>${d.name}</td><td>${d.teamId || ''}</td><td>${d.clientId || ''}</td></tr>`);
  });
}

onAuthStateChanged(auth, async user => {
  if(!user){ window.location.href = 'login.html'; return; }
  const token = await user.getIdTokenResult();
  const role = token.claims.role;
  if(['admin','superAdmin'].includes(role)){
    controlsEl.style.display = 'block';
    await Promise.all([loadTeams(), loadClients(), loadProjects()]);
  } else {
    unauthEl.style.display = 'block';
  }
});

if(btnCreateTeam){
  btnCreateTeam.addEventListener('click', async () => {
    const name = teamNameInput.value.trim();
    if(!name) return;
    const fn = httpsCallable(functions, 'createTeam');
    await fn({ name });
    teamNameInput.value = '';
    loadTeams();
  });
}

if(btnCreateClient){
  btnCreateClient.addEventListener('click', async () => {
    const name = clientNameInput.value.trim();
    if(!name) return;
    const fn = httpsCallable(functions, 'createClient');
    await fn({ name });
    clientNameInput.value = '';
    loadClients();
  });
}

if(btnCreateProject){
  btnCreateProject.addEventListener('click', async () => {
    const name = projectNameInput.value.trim();
    const teamId = projectTeamSelect.value || null;
    const clientId = projectClientSelect.value || null;
    if(!name) return;
    const fn = httpsCallable(functions, 'createProject');
    await fn({ name, teamId, clientId });
    projectNameInput.value = '';
    loadProjects();
  });
}
