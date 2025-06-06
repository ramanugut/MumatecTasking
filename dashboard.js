import { db } from './firebase.js';
import { collection, addDoc, query, where, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

class Dashboard {
  constructor() {
    this.tasksCol = null;
    this.scheduleCol = null;
    this.messagesCol = null;
    this.chart = null;
    this.init();
  }

  async init() {
    if (window.currentUser) {
      const uid = window.currentUser.uid;
      this.tasksCol = collection(db, 'users', uid, 'tasks');
      this.scheduleCol = collection(db, 'users', uid, 'schedule');
      this.messagesCol = collection(db, 'users', uid, 'messages');
      this.listen();
      document.getElementById('createTask').addEventListener('click', () => this.addTask());
    }
  }

  listen() {
    onSnapshot(this.tasksCol, (snap) => {
      const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.renderTasks(tasks);
      this.updateStats(tasks);
      this.updateChart(tasks);
    });
    onSnapshot(this.scheduleCol, (snap) => {
      const events = snap.docs.map(d => d.data());
      this.renderSchedule(events);
    });
    onSnapshot(this.messagesCol, (snap) => {
      const msgs = snap.docs.map(d => d.data());
      this.renderMessages(msgs);
    });
  }

  async addTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) return;
    await addDoc(this.tasksCol, { title, status: 'pending', createdAt: Date.now() });
    document.getElementById('newTaskTitle').value = '';
  }

  renderTasks(tasks) {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t.title;
      list.appendChild(li);
    });
  }

  renderSchedule(events) {
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    events.forEach(ev => {
      const div = document.createElement('div');
      div.className = 'schedule-item';
      div.textContent = `${ev.title} - ${ev.time}`;
      container.appendChild(div);
    });
  }

  renderMessages(msgs) {
    const container = document.getElementById('messageList');
    container.innerHTML = '';
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'message-item';
      div.textContent = `${m.from}: ${m.text}`;
      container.appendChild(div);
    });
  }

  updateStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const pending = total - completed;
    document.getElementById('taskCount').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('pendingCount').textContent = pending;
  }

  updateChart(tasks) {
    const ctx = document.getElementById('taskChart').getContext('2d');
    const data = {};
    tasks.forEach(t => {
      const d = new Date(t.createdAt).toLocaleDateString();
      data[d] = (data[d] || 0) + 1;
    });
    const labels = Object.keys(data);
    const counts = Object.values(data);
    if (this.chart) this.chart.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Tasks', data: counts, fill: true, backgroundColor: 'rgba(0,122,255,0.2)', borderColor: '#007AFF' }] },
      options: { scales: { y: { beginAtZero: true } } }
    });
  }
}

window.initDashboard = () => new Dashboard();

