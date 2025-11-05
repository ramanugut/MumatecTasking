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
  environmentGrid: document.getElementById('environmentGrid'),
  deploymentTimeline: document.getElementById('deploymentTimeline'),
  automationQueue: document.getElementById('automationQueue'),
  clientList: document.getElementById('clientList'),
  billingList: document.getElementById('billingList'),
  refreshBtn: document.getElementById('refreshEnvironments')
};

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

function renderEnvironmentGrid() {
  if (!elements.environmentGrid) return;
  elements.environmentGrid.innerHTML = '';

  if (!state.servers.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No environments found. Connect a server to begin monitoring.';
    elements.environmentGrid.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.servers.forEach(server => {
    const card = document.createElement('article');
    card.className = 'environment-card';
    const status = (server.status || server.health?.status || 'operational').toLowerCase();
    const incidentsOpen = Number(server.incidentsOpen || server.openIncidents || 0);
    const uptime = server.uptime ?? server.uptimePercent ?? server.health?.uptime;
    const environment = server.environment || server.tier || 'Production';
    const region = server.region || server.location || 'Global';
    const lastCheck = server.lastCheck || server.checkedAt;

    const statusClass = status.includes('crit') ? 'critical' : status.includes('warn') || status.includes('degraded') ? 'warning' : 'ok';
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    card.innerHTML = `
      <header>
        <div>
          <div class="environment-name">${server.name || server.hostname || 'Unnamed Server'}</div>
          <div class="environment-meta">${region} • ${environment}</div>
        </div>
        <span class="status-pill ${statusClass}">
          <span class="material-icons" aria-hidden="true">${statusClass === 'critical' ? 'error' : statusClass === 'warning' ? 'report_problem' : 'check_circle'}</span>
          ${statusLabel}
        </span>
      </header>
      <div class="environment-health">
        <span>Uptime</span>
        <strong>${formatPercent(uptime)}</strong>
      </div>
      <div class="environment-health">
        <span>Open incidents</span>
        <strong>${incidentsOpen}</strong>
      </div>
      <div class="environment-health">
        <span>Last check</span>
        <strong>${formatDate(lastCheck)}</strong>
      </div>
      <div class="environment-actions">
        <span class="tag">${environment}</span>
        <span class="tag">${region}</span>
        ${server.automation?.length ? `<span class="tag">${server.automation.length} automations</span>` : ''}
      </div>
    `;

    fragment.appendChild(card);
  });

  elements.environmentGrid.appendChild(fragment);
}

function renderTimeline() {
  if (!elements.deploymentTimeline) return;
  elements.deploymentTimeline.innerHTML = '';

  const events = [];

  state.sites.forEach(site => {
    const last = site.lastDeployment || site.deployedAt || site.updatedAt;
    const upcoming = site.nextDeployment || site.scheduledDeployment;
    if (last) {
      events.push({
        type: 'deployment',
        time: asDate(last),
        title: `${site.name || 'Site'} deployed`,
        description: site.deploymentSummary || `Deployed ${site.branch || 'main'} to ${site.environment || 'production'}`
      });
    }
    if (upcoming) {
      events.push({
        type: 'upcoming',
        time: asDate(upcoming),
        title: `Scheduled: ${site.name || 'Site'}`,
        description: site.nextDeploymentSummary || `Queued for ${site.environment || 'production'}`
      });
    }
  });

  state.incidents.forEach(incident => {
    const started = asDate(incident.startedAt || incident.openedAt || incident.createdAt);
    if (started) {
      events.push({
        type: 'incident',
        time: started,
        title: `${incident.severity ? incident.severity.toUpperCase() : 'Incident'} - ${incident.title || incident.summary || 'Unnamed incident'}`,
        description: incident.status ? `Status: ${incident.status}` : 'Investigation in progress'
      });
    }
  });

  events
    .filter(evt => evt.time)
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8)
    .forEach(event => {
      const item = document.createElement('li');
      item.className = 'timeline-item';
      item.innerHTML = `
        <time datetime="${event.time.toISOString()}">${formatDate(event.time, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
        <h3>${event.title}</h3>
        <p>${event.description}</p>
      `;
      elements.deploymentTimeline.appendChild(item);
    });

  if (!elements.deploymentTimeline.children.length) {
    const empty = document.createElement('li');
    empty.className = 'timeline-item';
    empty.innerHTML = '<h3>No deployment activity yet</h3><p>Deployments, incidents, and schedules will appear here in real-time.</p>';
    elements.deploymentTimeline.appendChild(empty);
  }
}

function renderAutomationQueue() {
  if (!elements.automationQueue) return;
  elements.automationQueue.innerHTML = '';

  const queue = [];

  state.servers.forEach(server => {
    const items = server.automationQueue || server.automation || [];
    items.forEach(item => {
      queue.push({
        server: server.name || server.hostname || 'Server',
        name: item.name || item.job || 'Automation Task',
        type: item.type || 'general',
        status: item.status || 'queued',
        scheduled: item.scheduledAt || item.runAt || item.createdAt,
        progress: item.progress
      });
    });
  });

  if (!queue.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Automation pipeline is idle. New jobs will appear here instantly.';
    elements.automationQueue.appendChild(empty);
    return;
  }

  queue
    .sort((a, b) => {
      const timeA = asDate(a.scheduled)?.getTime() || 0;
      const timeB = asDate(b.scheduled)?.getTime() || 0;
      return timeB - timeA;
    })
    .slice(0, 10)
    .forEach(item => {
      const el = document.createElement('article');
      el.className = 'list-item';
      const status = (item.status || '').toLowerCase();
      const statusClass = status.includes('fail') || status.includes('error') ? 'error'
        : status.includes('run') || status.includes('in-progress') ? 'warning'
        : 'success';
      const progress = item.progress != null ? `${Math.round(Number(item.progress) * (Number(item.progress) <= 1 ? 100 : 1))}%` : '';
      el.innerHTML = `
        <header>
          <h3>${item.name}</h3>
          <span class="badge ${statusClass}">${item.status || 'Queued'}</span>
        </header>
        <p>${item.type ? item.type.replace(/_/g, ' ') : 'automation'} • ${item.server}</p>
        <div class="list-item-footer">
          <span>${formatDate(item.scheduled)}</span>
          <span>${progress}</span>
        </div>
      `;
      elements.automationQueue.appendChild(el);
    });
}

function renderClients() {
  if (!elements.clientList) return;
  elements.clientList.innerHTML = '';

  if (!state.sites.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No client sites onboarded yet. Provision a site to see details here.';
    elements.clientList.appendChild(empty);
    return;
  }

  const planMap = new Map(state.plans.map(plan => [plan.id || plan.uid || plan.slug, plan]));

  state.sites
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .forEach(site => {
      const item = document.createElement('article');
      item.className = 'list-item';
      const plan = planMap.get(site.planId) || planMap.get(site.plan) || planMap.get(site.planSlug);
      const status = (site.status || '').toLowerCase();
      const statusClass = status === 'active' ? 'success' : status === 'warning' ? 'warning' : status === 'paused' ? 'warning' : 'success';
      item.innerHTML = `
        <header>
          <h3>${site.name || site.domain || 'Client Site'}</h3>
          <span class="badge ${statusClass}">${site.status || 'Active'}</span>
        </header>
        <p>${site.domain || site.url || '—'} • ${plan ? (plan.name || 'Custom plan') : (site.plan || 'Unassigned plan')}</p>
        <div class="list-item-footer">
          <span>Last deploy: ${formatDate(site.lastDeployment || site.updatedAt)}</span>
          <span>Visitors: ${(site.monthlyVisitors ?? site.traffic ?? '—')}</span>
        </div>
      `;
      elements.clientList.appendChild(item);
    });
}

function renderBilling() {
  if (!elements.billingList) return;
  elements.billingList.innerHTML = '';

  if (!state.invoices.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No invoices available. When billing is generated it will show up here instantly.';
    elements.billingList.appendChild(empty);
    return;
  }

  state.invoices
    .slice()
    .sort((a, b) => {
      const dueA = asDate(a.dueDate)?.getTime() || 0;
      const dueB = asDate(b.dueDate)?.getTime() || 0;
      return dueA - dueB;
    })
    .forEach(invoice => {
      const item = document.createElement('article');
      item.className = 'list-item';
      const status = (invoice.status || '').toLowerCase();
      let statusClass = 'success';
      if (status.includes('past') || status.includes('overdue')) statusClass = 'error';
      else if (status.includes('pending') || status.includes('draft')) statusClass = 'warning';

      item.innerHTML = `
        <header>
          <h3>${invoice.client || invoice.account || 'Client'}</h3>
          <span class="badge ${statusClass}">${invoice.status || 'Pending'}</span>
        </header>
        <p>Invoice ${invoice.number || invoice.reference || '#'} • ${formatCurrency(invoice.amount, invoice.currency || 'USD')}</p>
        <div class="list-item-footer">
          <span>Due ${formatDate(invoice.dueDate, { month: 'short', day: 'numeric' })}</span>
          <span>${invoice.plan || invoice.service || 'Hosting plan'}</span>
        </div>
      `;
      elements.billingList.appendChild(item);
    });
}

function renderAll() {
  calculateHeroMetrics();
  renderEnvironmentGrid();
  renderTimeline();
  renderAutomationQueue();
  renderClients();
  renderBilling();
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
  if (elements.refreshBtn) {
    elements.refreshBtn.addEventListener('click', () => {
      renderAll();
    });
  }

  setupRealtime();
  renderAll();
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
  unsubscribers.forEach(unsub => {
    if (typeof unsub === 'function') unsub();
  });
});
