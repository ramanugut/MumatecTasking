import { db } from './firebase.js';
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const state = {
  servers: [],
  sites: [],
  plans: [],
  incidents: [],
  invoices: []
};

const elements = {
  uptimeValue: document.getElementById('uptimeValue'),
  uptimeSubtitle: document.getElementById('uptimeSubtitle'),
  incidentsValue: document.getElementById('incidentsValue'),
  incidentsSubtitle: document.getElementById('incidentsSubtitle'),
  plansValue: document.getElementById('plansValue'),
  plansSubtitle: document.getElementById('plansSubtitle'),
  boardColumns: {
    'get-started': document.getElementById('column-get-started'),
    requests: document.getElementById('column-requests'),
    progress: document.getElementById('column-progress'),
    approved: document.getElementById('column-approved')
  },
  boardCounts: {
    'get-started': document.getElementById('count-get-started'),
    requests: document.getElementById('count-requests'),
    progress: document.getElementById('count-progress'),
    approved: document.getElementById('count-approved')
  }
};

const boardColumnsConfig = [
  { id: 'get-started', keywords: ['kickoff', 'start', 'brief', 'pending'] },
  { id: 'requests', keywords: ['request', 'backlog', 'review', 'awaiting'] },
  { id: 'progress', keywords: ['progress', 'building', 'wip', 'active', 'develop'] },
  { id: 'approved', keywords: ['approved', 'done', 'launch', 'complete'] }
];

const sampleBoardTasks = [
  {
    column: 'get-started',
    title: 'Process design brief',
    subtitle: 'Finalize onboarding docs & scope',
    tags: ['Branding', 'Intake'],
    owner: 'Mila',
    dateLabel: 'Due today',
    icon: 'assignment'
  },
  {
    column: 'get-started',
    title: 'Branding refresh',
    subtitle: 'Upload client files + guidelines',
    tags: ['Creative', 'High priority'],
    owner: 'Leo',
    dateLabel: 'Apr 12',
    icon: 'palette'
  },
  {
    column: 'requests',
    title: 'Keyword cover',
    subtitle: 'Create short-form showcase assets',
    tags: ['SEO', 'Content'],
    owner: 'Rena',
    dateLabel: 'Apr 15',
    icon: 'lightbulb'
  },
  {
    column: 'requests',
    title: 'Facebook cover',
    subtitle: 'Prep seasonal creative kit',
    tags: ['Social', 'Campaign'],
    owner: 'Sam',
    dateLabel: 'Apr 17',
    icon: 'share'
  },
  {
    column: 'progress',
    title: 'Schedule onboarding call',
    subtitle: 'Confirm access + priorities',
    tags: ['Client', 'Call'],
    owner: 'Alex',
    dateLabel: 'Tomorrow',
    icon: 'phone'
  },
  {
    column: 'progress',
    title: 'Check keyword list',
    subtitle: 'QA deliverables before send-off',
    tags: ['Quality', 'Search'],
    owner: 'Dana',
    dateLabel: 'Apr 18',
    icon: 'task_alt'
  },
  {
    column: 'approved',
    title: 'Signed checkout flow',
    subtitle: 'Ready for deployment approval',
    tags: ['Product', 'Payments'],
    owner: 'Chris',
    dateLabel: 'Queued',
    icon: 'verified'
  }
];

const unsubscribers = [];

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, options = {}) {
  const date = asDate(value);
  if (!date) return '—';
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
  return formatter.format(date);
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const num = Math.min(Math.max(Number(value), 0), 100);
  return `${num.toFixed(2)}%`;
}

function formatCurrency(value, currency = 'USD') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
}

function calculateHeroMetrics() {
  const uptimeValues = state.servers
    .map(server => Number(server.uptime ?? server.uptimePercent ?? server.health?.uptime))
    .filter(num => !Number.isNaN(num));

  if (uptimeValues.length) {
    const total = uptimeValues.reduce((sum, num) => sum + num, 0);
    const avg = total / uptimeValues.length;
    elements.uptimeValue.textContent = formatPercent(avg);
    const worst = Math.min(...uptimeValues);
    elements.uptimeSubtitle.textContent = `Lowest region: ${formatPercent(worst)}`;
  } else {
    elements.uptimeValue.textContent = '—';
    elements.uptimeSubtitle.textContent = 'Awaiting telemetry from monitoring agents';
  }

  const openIncidents = state.incidents.filter(incident => {
    const status = (incident.status || incident.state || '').toLowerCase();
    return status && status !== 'resolved' && status !== 'closed';
  });

  elements.incidentsValue.textContent = openIncidents.length.toString();
  if (openIncidents.length) {
    const severities = openIncidents.map(incident => (incident.severity || incident.priority || 'normal').toLowerCase());
    const rank = ['critical', 'high', 'major', 'medium', 'minor', 'low'];
    const topSeverity = severities.sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0] || 'normal';
    elements.incidentsSubtitle.textContent = `Highest severity: ${topSeverity.toUpperCase()}`;
  } else {
    elements.incidentsSubtitle.textContent = 'All services operational';
  }

  const activePlans = state.plans.filter(plan => {
    if (plan.active === false) return false;
    const status = (plan.status || '').toLowerCase();
    if (!status) return true;
    return status === 'active' || status === 'live';
  });

  elements.plansValue.textContent = activePlans.length.toString();
  const totalClients = state.sites.length;
  if (activePlans.length && totalClients) {
    const averageClients = totalClients / activePlans.length;
    elements.plansSubtitle.textContent = `${totalClients} sites · avg ${averageClients.toFixed(1)} per plan`;
  } else if (activePlans.length) {
    elements.plansSubtitle.textContent = 'Ready for new client deployments';
  } else {
    elements.plansSubtitle.textContent = 'No active plans yet';
  }
}

function determineColumnForSite(site = {}) {
  const stageValue = [
    site.pipelineStage,
    site.stage,
    site.status,
    site.workflowStatus,
    site.progress,
    site.phase
  ]
    .map(value => (value || '').toString().toLowerCase())
    .filter(Boolean)
    .join(' ');

  if (!stageValue) {
    return site.approved || site.launchReady ? 'approved' : 'requests';
  }

  const matchedColumn = boardColumnsConfig.find(column =>
    column.keywords.some(keyword => stageValue.includes(keyword))
  );

  if (matchedColumn) return matchedColumn.id;

  return stageValue.includes('approve') || stageValue.includes('launch')
    ? 'approved'
    : stageValue.includes('progress') || stageValue.includes('active')
      ? 'progress'
      : 'requests';
}

function buildTaskFromSite(site, planMap) {
  const column = determineColumnForSite(site);
  const plan = planMap.get(site.planId) || planMap.get(site.plan) || planMap.get(site.planSlug) || planMap.get(site.planName);
  const tags = [];
  if (plan?.name) tags.push(plan.name);
  if (site.environment) tags.push(site.environment);
  if (site.priority) tags.push(site.priority);

  const title = site.name || site.domain || 'Client request';
  const subtitle = site.brief || site.description || site.goal || site.domain || 'Awaiting requirements';
  const owner = site.owner || site.pointOfContact || site.accountOwner || 'Unassigned';
  const date = site.dueDate || site.launchDate || site.nextDeployment || site.updatedAt;
  const dateLabel = date ? formatDate(date, { month: 'short', day: 'numeric' }) : 'No date';
  let icon = site.icon;
  if (!icon) {
    icon = column === 'approved' ? 'verified'
      : column === 'progress' ? 'bolt'
      : column === 'requests' ? 'lightbulb'
      : 'assignment';
  }

  return { column, title, subtitle, tags, owner, dateLabel, icon };
}

function renderTaskCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  const tags = (task.tags || [])
    .filter(Boolean)
    .map(tag => `<span class="task-tag">${tag}</span>`)
    .join('');

  card.innerHTML = `
    <header>
      <div>
        <p class="task-title">${task.title}</p>
        <p class="task-subtitle">${task.subtitle || ''}</p>
      </div>
      <div class="task-indicator" data-column="${task.column}">
        <span class="material-icons" aria-hidden="true">${task.icon || 'radio_button_unchecked'}</span>
      </div>
    </header>
    ${tags ? `<div class="task-tags">${tags}</div>` : ''}
    <div class="task-footer">
      <span class="task-owner">${task.owner || 'Unassigned'}</span>
      <span class="task-date"><span class="material-icons" aria-hidden="true">event</span>${task.dateLabel || ''}</span>
    </div>
  `;

  return card;
}

function renderWorkspaceBoard() {
  if (!elements.boardColumns) return;
  const hasColumn = Object.values(elements.boardColumns).some(Boolean);
  if (!hasColumn) return;

  const planMap = new Map();
  state.plans.forEach(plan => {
    [plan.id, plan.uid, plan.slug, plan.name]
      .filter(Boolean)
      .forEach(key => planMap.set(key, plan));
  });
  const buckets = boardColumnsConfig.reduce((acc, column) => {
    acc[column.id] = [];
    return acc;
  }, {});

  const tasks = state.sites.length
    ? state.sites.map(site => buildTaskFromSite(site, planMap))
    : sampleBoardTasks;

  tasks.forEach(task => {
    const bucket = buckets[task.column] ? task.column : 'requests';
    buckets[bucket].push(task);
  });

  boardColumnsConfig.forEach(column => {
    const listEl = elements.boardColumns[column.id];
    const countEl = elements.boardCounts[column.id];
    if (!listEl) return;
    listEl.innerHTML = '';
    const columnTasks = buckets[column.id];
    if (!columnTasks.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state soft';
      empty.textContent = 'No work in this column yet.';
      listEl.appendChild(empty);
    } else {
      columnTasks.forEach(task => listEl.appendChild(renderTaskCard(task)));
    }
    if (countEl) {
      countEl.textContent = columnTasks.length.toString();
    }
  });
}

function renderAll() {
  calculateHeroMetrics();
  renderWorkspaceBoard();
}

function subscribeToCollection(name, handler, options = {}) {
  if (!db) {
    handler([]);
    return;
  }

  const col = collection(db, name);
  const source = options.orderBy ? orderBy(options.orderBy.field, options.orderBy.direction || 'desc') : null;
  const ref = source ? query(col, source) : col;
  const unsubscribe = onSnapshot(ref, snapshot => {
    const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    handler(docs);
  }, error => {
    console.error(`Failed to subscribe to ${name}`, error);
    handler([]);
  });
  unsubscribers.push(unsubscribe);
}

function setupRealtime() {
  subscribeToCollection('servers', docs => {
    state.servers = docs;
    renderAll();
  });

  subscribeToCollection('sites', docs => {
    state.sites = docs;
    renderAll();
  });

  subscribeToCollection('plans', docs => {
    state.plans = docs;
    renderAll();
  });

  subscribeToCollection('incidents', docs => {
    state.incidents = docs;
    renderAll();
  });

  subscribeToCollection('invoices', docs => {
    state.invoices = docs;
    renderAll();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') return;
  renderAll();
});

function init() {
  setupRealtime();
  renderAll();
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  unsubscribers.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });
});
