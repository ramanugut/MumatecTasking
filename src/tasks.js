// Mumatec Tasking - Professional Application
import { db } from '../firebase.js';
import { generateId, escapeHtml as escapeHtmlUtil, parseCSVLine as parseCSVLineUtil, formatDate as formatDateUtil, debounce as debounceUtil, formatDuration as formatDurationUtil } from './utils.js';
import { setupDragAndDrop, setupAutoScroll } from './ui.js';
import { collection, setDoc, doc, deleteDoc, onSnapshot, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
class MumatecTaskManager {
    constructor() {
        this.tasks = [];
        this.currentView = 'dashboard';
        this.currentEditingTask = null;
        this.draggedTask = null;
        this.viewMode = 'kanban';
        this.searchTerm = '';
        this.activeFilter = null;
        this.statuses = ['todo', 'inprogress', 'review', 'done', 'blocked', 'cancelled'];

        this.priorities = ['low', 'medium', 'high', 'critical'];
        this.samplePushed = false;
        this.customTypes = [];
        this.users = [];
        this.userMap = {};
        this.labelsConfig = [];
        this.labelMap = {};
        this.projects = [];
        this.projectMap = {};
        this.activeTimers = {};
        this.categoryOrder = ['Work', 'Personal', 'Development'];
        this.categoryIcons = { Work: 'work', Personal: 'home', Development: 'code' };

        this.init();
    }

    normalizeTask(data) {
        return {
            id: data.id || generateId(),
            title: data.title || '',
            description: data.description || '',
            notes: data.notes || '',
            priority: data.priority || 'medium',
            status: data.status || 'todo',
            dueDate: data.dueDate || null,
            category: data.category || 'Work',
            type: data.type || 'General',
            projectId: data.projectId || null,
            assignedTo: data.assignedTo || null,
            dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
            estimate: Number(data.estimate) || 0,
            timeSpent: Number(data.timeSpent) || 0,
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
            comments: Array.isArray(data.comments) ? data.comments : [],
            tags: Array.isArray(data.tags) ? data.tags : [],
            watchers: Array.isArray(data.watchers) ? data.watchers : [],
            labels: Array.isArray(data.labels) ? data.labels : [],
            subtasks: Array.isArray(data.subtasks) ? data.subtasks : [],
            activity: Array.isArray(data.activity) ? data.activity : [],
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            reminderSent: data.reminderSent || false
        };
    }

    async init() {
        await this.loadTasks();
        await this.loadTaskTypes();
        await this.loadUsers();
        await this.loadProjects();
        this.loadLabels();
        this.loadTheme();
        this.loadSidebarState();
        this.loadStatusOrder();
        this.loadCategoryOrder();
        this.loadQuickNotes();
        this.setupEventListeners();
        this.setupSidebarToggle();
        setupDragAndDrop(this);
        setupAutoScroll(this);
        this.setupKeyboardShortcuts();
        this.requestNotificationPermission();
        this.startReminderSystem();
        this.updateUI();
        this.setupAutoSave();
        this.setupModalTabs();
        
        // Set today's date
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        this.setupRoleLinks();
    }

    // Data Management
    async loadTasks() {
        const loadingEl = document.getElementById('loadingOverlay');
        if (loadingEl) loadingEl.style.display = 'flex';

        console.log('Loading tasks. User:', window.currentUser ? window.currentUser.uid : 'none');
        try {
            if (window.currentUser && db) {
                const col = collection(db, 'users', window.currentUser.uid, 'tasks');
                console.log('Subscribing to Firestore collection:', `users/${window.currentUser.uid}/tasks`);

                this.unsubscribe = onSnapshot(col, (snap) => {
                    // Spread operator ensures all Firestore fields are merged correctly
                    const tasks = snap.docs.map(d => this.normalizeTask({ id: d.id, ...d.data() }));
                    if (tasks.length === 0 && !this.samplePushed) {
                        this.samplePushed = true;
                        this.createSampleTasks();
                        if (loadingEl) loadingEl.style.display = 'none';
                        return;
                    }
                    this.tasks = tasks;
                    this.updateUI();
                    if (loadingEl) loadingEl.style.display = 'none';
                }, (error) => {
                    console.error('Error loading tasks:', error);
                    this.showNotification('Error', 'Failed to load tasks', 'error');
                    if (loadingEl) loadingEl.style.display = 'none';
                });
            } else {
                this.createSampleTasks();
                if (loadingEl) loadingEl.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('Error', 'Failed to load tasks', 'error');
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    saveTasks() {
        // Data persistence handled by Firestore; function retained for backward compatibility
    }

    async saveTaskToFirestore(task) {
        if (!window.currentUser || !db) return;
        try {
            console.log('Saving task to Firestore:', task.id, task.title);
            await setDoc(doc(db, 'users', window.currentUser.uid, 'tasks', task.id), task);
            console.log('→ saved successfully');
        } catch (error) {
            console.error('Firestore save error:', error);
        }
    }

    async deleteTaskFromFirestore(taskId) {
        if (!window.currentUser || !db) return;
        try {
            console.log('Deleting task from Firestore:', taskId);
            await deleteDoc(doc(db, 'users', window.currentUser.uid, 'tasks', taskId));
            console.log('→ deleted successfully');
        } catch (error) {
            console.error('Firestore delete error:', error);
        }
    }

    async loadTaskTypes() {
        if (!db) return;
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'taskTypes'));
            this.customTypes = docSnap.exists() ? (docSnap.data().types || []) : ['Bug', 'Feature', 'Design', 'Hosting Setup'];
        } catch (e) {
            console.warn('Failed to load task types', e);
            this.customTypes = ['Bug', 'Feature', 'Design', 'Hosting Setup'];
        }
        this.populateTypeDatalist();
    }

    async loadUsers() {
        if (!db) return;
        try {
            const snap = await getDocs(collection(db, 'users'));
            // Merge Firestore user data using spread operator
            this.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.userMap = {};
            this.users.forEach(u => { this.userMap[u.id] = u; });
        } catch (e) {
            console.warn('Failed to load users', e);
            this.users = [];
            this.userMap = {};
        }
        this.populateAssigneeDropdown();
    }

    async loadProjects() {
        if (!db) return;
        try {
            const snap = await getDocs(collection(db, 'projects'));
            this.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.projectMap = {};
            this.projects.forEach(p => { this.projectMap[p.id] = p; });
        } catch (e) {
            console.warn('Failed to load projects', e);
            this.projects = [];
            this.projectMap = {};
        }
        this.populateProjectDropdown();
    }

    populateProjectDropdown() {
        const select = document.getElementById('taskProject');
        if (!select) return;
        select.innerHTML = this.projects.map(p => `<option value="${p.id}">${escapeHtmlUtil(p.name)}</option>`).join('');
        if (this.projects.length) {
            const saved = localStorage.getItem('lastProject');
            select.value = (saved && this.projectMap[saved]) ? saved : this.projects[0].id;
        }
        this.handleProjectChange();
    }

    async createProject() {
        if (!db) return;
        const name = prompt('Project name');
        if (!name) return;
        const type = prompt('Project type (software/marketing)') || 'software';
        try {
            const docRef = doc(collection(db, 'projects'));
            await setDoc(docRef, { name, type, createdAt: new Date().toISOString() });
            const proj = { id: docRef.id, name, type };
            this.projects.push(proj);
            this.projectMap[proj.id] = proj;
            this.populateProjectDropdown();
            const select = document.getElementById('taskProject');
            if (select) {
                select.value = proj.id;
                this.handleProjectChange();
            }
        } catch (e) {
            console.error('Failed to create project', e);
        }
    }

    handleProjectChange() {
        const select = document.getElementById('taskProject');
        const proj = this.projectMap[select?.value];
        const typeField = document.getElementById('taskTypeField');
        const categoryField = document.getElementById('taskCategoryField');
        if (!typeField || !categoryField) return;
        if (proj?.type === 'software') {
            typeField.style.display = '';
            categoryField.style.display = 'none';
        } else if (proj?.type === 'marketing') {
            typeField.style.display = 'none';
            categoryField.style.display = '';
        } else {
            typeField.style.display = '';
            categoryField.style.display = '';
        }
    }

    populateTypeDatalist() {
        const list = document.getElementById('typeSuggestions');
        if (!list) return;
        list.innerHTML = this.customTypes.map(t => `<option value="${escapeHtmlUtil(t)}"></option>`).join('');
    }

    populateAssigneeDropdown() {
        const select = document.getElementById('taskAssignee');
        if (!select) return;
        select.innerHTML = `<option value="">Unassigned</option>` +
            this.users.map(u => `<option value="${u.id}">${escapeHtmlUtil(u.displayName || u.email)}</option>`).join('');
    }

    loadLabels() {
        const saved = localStorage.getItem('taskLabels');
        if (saved) {
            try {
                this.labelsConfig = JSON.parse(saved);
            } catch (e) {
                console.warn('Failed to parse labels', e);
                this.labelsConfig = [];
            }
        }
        if (this.labelsConfig.length === 0) {
            this.labelsConfig = [
                { name: 'Client Work', color: '#42a5f5' },
                { name: 'Internal', color: '#66bb6a' },
                { name: 'Urgent', color: '#ef5350' }
            ];
        }
        this.labelsConfig.forEach(l => { this.labelMap[l.name] = l.color; });
        this.populateLabelDatalist();
        this.renderLabelDropdown();
    }

    saveLabels() {
        localStorage.setItem('taskLabels', JSON.stringify(this.labelsConfig));
    }

    populateLabelDatalist() {
        const list = document.getElementById('labelSuggestions');
        if (!list) return;
        list.innerHTML = this.labelsConfig.map(l => `<option value="${escapeHtmlUtil(l.name)}"></option>`).join('');
    }

    renderLabelDropdown() {
        const container = document.getElementById('labelList');
        if (!container) return;
        container.innerHTML = '';
        this.labelsConfig.forEach(l => {
            const div = document.createElement('div');
            div.className = 'label-item';
            div.innerHTML = `<span class="color-box" style="background:${l.color}"></span>${escapeHtmlUtil(l.name)}`;
            container.appendChild(div);
        });
    }

    addLabel(name, color) {
        if (!name) return;
        this.labelsConfig.push({ name, color });
        this.labelMap[name] = color;
        this.saveLabels();
        this.populateLabelDatalist();
        this.renderLabelDropdown();
    }

    createSampleTasks() {
        const sampleTasks = [
            {
                id: generateId(),
                title: 'Review server performance metrics',
                description: 'Analyze CPU and memory usage across all hosting servers',
                priority: 'high',
                status: 'todo',
                category: 'Work',
                type: 'Maintenance',
                tags: ['hosting', 'performance'],
                labels: ['Urgent'],
                assignedTo: null,
                dependencies: [],
                estimate: 2,
                timeSpent: 0,
                attachments: [],
                comments: [],
                watchers: [],
                notes: '',
                activity: [{ action: 'Created task', timestamp: new Date().toISOString() }],
                dueDate: new Date(Date.now() + 86400000).toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Update client documentation',
                description: 'Revise hosting packages and pricing documentation',
                priority: 'medium',
                status: 'inprogress',
                category: 'Work',
                type: 'Compliance',
                tags: ['documentation', 'clients'],
                labels: ['Client Work'],
                assignedTo: null,
                dependencies: [],
                estimate: 1,
                timeSpent: 0,
                attachments: [],
                comments: [],
                watchers: [],
                notes: '',
                activity: [{ action: 'Created task', timestamp: new Date().toISOString() }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: generateId(),
                title: 'Team standup meeting',
                description: 'Weekly team sync and progress review',
                priority: 'medium',
                status: 'done',
                category: 'Work',
                type: 'User Account Management',
                tags: ['meeting', 'team'],
                labels: ['Internal'],
                assignedTo: null,
                dependencies: [],
                estimate: 0.5,
                timeSpent: 0.5,
                attachments: [],
                comments: [],
                watchers: [],
                notes: '',
                activity: [{ action: 'Created task', timestamp: new Date().toISOString() }],
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        this.tasks = sampleTasks.map(t => this.normalizeTask(t));
        this.tasks.forEach(task => this.saveTaskToFirestore(task));
    }


    // Task Operations
    async addTask(taskData) {
        const task = this.normalizeTask({
            id: generateId(),
            title: taskData.title.trim(),
            description: taskData.description?.trim() || '',
            notes: taskData.notes?.trim() || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            dueDate: taskData.dueDate || null,
            category: taskData.category?.trim() || 'Work',
            type: taskData.type || 'General',
            projectId: taskData.projectId || null,
            assignedTo: taskData.assignedTo || null,
            dependencies: this.parseTags(taskData.dependencies),
            estimate: parseFloat(taskData.estimate) || 0,
            timeSpent: parseFloat(taskData.timeSpent) || 0,
            attachments: taskData.attachments || [],
            comments: taskData.comments || [],
            watchers: [window.currentUser?.uid].filter(Boolean),
            tags: this.parseTags(taskData.tags),
            activity: [{ action: 'Created task', timestamp: new Date().toISOString() }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reminderSent: false
        });


        this.tasks.push(task);
        this.saveTaskToFirestore(task);
        this.updateUI();
        this.showNotification('Success', 'Task created successfully', 'success');
        return task;
    }

    async updateTask(taskId, taskData) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return false;

        this.tasks[taskIndex] = this.normalizeTask({
            ...this.tasks[taskIndex],
            title: taskData.title.trim(),
            description: taskData.description?.trim() || '',
            notes: taskData.notes?.trim() || this.tasks[taskIndex].notes || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            dueDate: taskData.dueDate || null,
            category: taskData.category?.trim() || 'Work',
            type: taskData.type || 'General',
            projectId: taskData.projectId || this.tasks[taskIndex].projectId || null,
            assignedTo: taskData.assignedTo || this.tasks[taskIndex].assignedTo || null,
            dependencies: this.parseTags(taskData.dependencies),
            estimate: parseFloat(taskData.estimate) || this.tasks[taskIndex].estimate || 0,
            timeSpent: parseFloat(taskData.timeSpent) || this.tasks[taskIndex].timeSpent || 0,
            attachments: taskData.attachments && taskData.attachments.length ? [...(this.tasks[taskIndex].attachments || []), ...taskData.attachments] : (this.tasks[taskIndex].attachments || []),
            comments: taskData.comments ? [...(this.tasks[taskIndex].comments || []), ...taskData.comments] : (this.tasks[taskIndex].comments || []),
            watchers: Array.isArray(this.tasks[taskIndex].watchers) ? this.tasks[taskIndex].watchers : [],
            tags: this.parseTags(taskData.tags),
            updatedAt: new Date().toISOString()
        });
        this.tasks[taskIndex].activity = this.tasks[taskIndex].activity || [];
        this.tasks[taskIndex].activity.push({ action: 'Updated task', timestamp: new Date().toISOString() });


        this.saveTaskToFirestore(this.tasks[taskIndex]);
        this.updateUI();
        this.showNotification('Success', 'Task updated successfully', 'success');
        return true;
    }

    async deleteTask(taskId) {
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        this.deleteTaskFromFirestore(taskId);
        this.updateUI();
        this.showNotification('Success', 'Task deleted successfully', 'success');
    }


    async moveTask(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return false;

        task.status = newStatus;
        task.updatedAt = new Date().toISOString();
        task.activity = task.activity || [];
        task.activity.push({ action: `Moved to ${newStatus}`, timestamp: task.updatedAt });

        this.saveTaskToFirestore(task);
        this.updateUI();
        return true;
    }

    toggleTaskPriority(taskId) {

        const idx = this.tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return;
        const current = this.tasks[idx].priority || 'medium';
        const currentIndex = this.priorities.indexOf(current);
        const nextPriority = this.priorities[(currentIndex + 1) % this.priorities.length];
        this.tasks[idx].priority = nextPriority;
        this.tasks[idx].updatedAt = new Date().toISOString();
        this.tasks[idx].activity = this.tasks[idx].activity || [];
        this.tasks[idx].activity.push({ action: `Priority set to ${nextPriority}`, timestamp: this.tasks[idx].updatedAt });
        this.saveTaskToFirestore(this.tasks[idx]);
        this.updateUI();
    }

    parseTags(tagsString) {
        if (!tagsString) return [];
        return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    parseLabels(labelsString) {
        if (!labelsString) return [];
        return labelsString.split(',').map(l => l.trim()).filter(l => l);
    }

    comparePriority(a, b) {
        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
        return (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);
    }

    // UI Management

    updateUI() {
        const stats = this.getTaskStats();
        const timeTotals = this.computeTimeTotals();
        this.updateStats(stats);
        this.updateNavigationCounts(stats);
        this.renderCategoryTimeTotals(timeTotals);
        this.updateProductivityRing(stats);
        this.renderCurrentView();
        this.updateInsights();
    }

    updateStats(stats) {
        const { total, completed, inProgress } = stats;
        const streak = this.calculateStreak();

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('pendingTasks').textContent = inProgress;
        document.getElementById('streakDays').textContent = streak;
    }

    updateNavigationCounts(stats) {
        const { today, upcoming, completed, categories } = stats;

        document.getElementById('dashboardCount').textContent = stats.total;
        document.getElementById('todayCount').textContent = today;
        document.getElementById('upcomingCount').textContent = upcoming;
        document.getElementById('completedNavCount').textContent = completed;

        this.renderCategoryNav(categories);
    }

    renderCategoryNav(categoryCounts = {}) {
        const container = document.getElementById('categoryNavContainer');
        if (!container) return;
        container.innerHTML = '';
        this.categoryOrder.forEach(cat => {
            const count = categoryCounts[cat] || 0;
            const activeClass = this.activeFilter === cat ? 'active' : '';
            const icon = this.categoryIcons[cat] || 'folder';
            const item = document.createElement('div');
            item.className = `nav-item ${activeClass}`;
            item.dataset.filter = cat;
            item.innerHTML = `
                <span class="material-icons nav-icon">${icon}</span>
                <span class="nav-label">${escapeHtmlUtil(cat)}</span>
                <span class="nav-count">${count}</span>
                <div class="nav-controls">
                    <button class="move-btn move-cat" data-category="${escapeHtmlUtil(cat)}" data-direction="up" aria-label="Move category up"><span class="material-icons">arrow_upward</span></button>
                    <button class="move-btn move-cat" data-category="${escapeHtmlUtil(cat)}" data-direction="down" aria-label="Move category down"><span class="material-icons">arrow_downward</span></button>
                </div>`;
            container.appendChild(item);
        });

        container.querySelectorAll('.nav-item[data-filter]').forEach(item => {
            item.addEventListener('click', () => {
                this.activeFilter = this.activeFilter === item.dataset.filter ? null : item.dataset.filter;
                this.updateUI();
            });
        });

        container.querySelectorAll('.move-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveCategory(btn.dataset.category, btn.dataset.direction);
            });
        });
    }

    renderCategoryTimeTotals(totals = {}) {
        const container = document.getElementById('categoryTimeTotals');
        if (!container) return;
        container.innerHTML = '';
        this.categoryOrder.forEach(cat => {
            const total = totals[cat] || 0;
            const div = document.createElement('div');
            div.innerHTML = `<span>${escapeHtmlUtil(cat)}</span><span>${formatDurationUtil(total)}</span>`;
            container.appendChild(div);
        });
    }

    updateProductivityRing(stats) {
        const ring = document.getElementById('progressRing');
        const percentEl = document.getElementById('productivityPercent');
        if (!ring || !percentEl) return;

        const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const circumference = 2 * Math.PI * 25; // radius = 25
        const offset = circumference - (percentage / 100) * circumference;

        ring.style.strokeDashoffset = offset;
        percentEl.textContent = `${percentage}%`;
    }

    renderCurrentView() {
        // Hide all views
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.remove('active');
        });

        // Show current view
        const currentViewElement = document.getElementById(`${this.currentView}View`);
        if (currentViewElement) {
            currentViewElement.classList.add('active');
        }

        // Update page title
        const titles = {
            dashboard: 'Mumatec Tasking',
            today: 'Today\'s Tasks',
            upcoming: 'Upcoming Tasks',
            completed: 'Completed Tasks'
        };

        document.getElementById('pageTitle').textContent = titles[this.currentView] || 'Mumatec Tasking';

        // Render view content
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'today':
                this.renderTodayView();
                break;
            case 'upcoming':
                this.renderUpcomingView();
                break;
            case 'completed':
                this.renderCompletedView();
                break;
        }
    }

    renderDashboard() {
        if (this.viewMode === 'kanban') {
            this.renderKanbanBoard();
        } else {
            this.renderListView();
        }
        this.renderWeeklyChart();
    }

    renderKanbanBoard() {
        const filteredTasks = this.getFilteredTasks();
        const kanbanEl = document.querySelector('.kanban-container');
        const rowsEl = document.getElementById('rowsContainer');
        const gridEl = document.querySelector('.dashboard-grid');

        if (kanbanEl) kanbanEl.style.display = 'flex';
        if (gridEl) gridEl.style.display = 'grid';
        if (rowsEl) rowsEl.style.display = 'none';

        // Reorder columns based on saved order
        if (kanbanEl) {
            this.statuses.forEach(status => {
                const col = kanbanEl.querySelector(`.kanban-column[data-status="${status}"]`);
                if (col) kanbanEl.appendChild(col);
            });
        }

        // Clear boards
        const statusLabels = {
            todo: 'Todo',
            inprogress: 'In Progress',
            review: 'Review',
            done: 'Done',
            blocked: 'Blocked',
            cancelled: 'Cancelled'
        };
        this.statuses.forEach(status => {
            const board = document.getElementById(`${status}Board`);
            board.innerHTML = `
                <div class="add-task-card" onclick="todoApp.openAddTaskModal('${status}')">
                    <span class="material-icons add-icon">add</span>
                    <span>Add to ${statusLabels[status]}</span>
                </div>
            `;
        });

        const tasksByStatus = {};
        filteredTasks.forEach(task => {
            if (!tasksByStatus[task.status]) tasksByStatus[task.status] = [];
            tasksByStatus[task.status].push(task);
        });

        this.statuses.forEach(status => {
            const board = document.getElementById(`${status}Board`);
            const tasks = (tasksByStatus[status] || []).sort((a, b) => this.comparePriority(a, b));
            tasks.forEach(t => {
                const el = this.createTaskCard(t);
                board.appendChild(el);
            });
        });

        // Update column counts
        this.statuses.forEach(status => {
            const count = filteredTasks.filter(task => task.status === status).length;
            const countElement = document.getElementById(`${status}Count`);
            if (countElement) {
                countElement.textContent = count;
            }
        });

        this.attachMoveControls();
    }


    renderListView() {
        const filteredTasks = this.getFilteredTasks();
        const container = document.getElementById('rowsContainer');
        const kanbanEl = document.querySelector('.kanban-container');
        const gridEl = document.querySelector('.dashboard-grid');

        if (kanbanEl) kanbanEl.style.display = 'none';
        if (gridEl) gridEl.style.display = 'none';
        if (!container) return;
        container.style.display = 'flex';
        container.innerHTML = '';

        const statusLabels = {
            todo: 'Todo',
            inprogress: 'In Progress',
            review: 'Review',
            done: 'Done',
            blocked: 'Blocked',
            cancelled: 'Cancelled'
        };


        this.statuses.forEach(status => {
            const row = document.createElement('div');
            row.className = 'row-container';
            row.dataset.status = status;
            const count = filteredTasks.filter(t => t.status === status).length;
            row.innerHTML = `
                <div class="row-header">
                    <div class="row-title">${statusLabels[status]}</div>
                    <div class="row-count" id="${status}RowCount">${count}</div>
                    <div class="row-controls">
                        <button class="move-btn move-row" data-status="${status}" data-direction="up" aria-label="Move row up"><span class="material-icons">arrow_upward</span></button>
                        <button class="move-btn move-row" data-status="${status}" data-direction="down" aria-label="Move row down"><span class="material-icons">arrow_downward</span></button>
                    </div>
                </div>
                <div class="row-content" id="${status}Row">
                    <div class="add-task-card" onclick="todoApp.openAddTaskModal('${status}')">
                        <span class="material-icons add-icon">add</span>
                        <span>Add task</span>
                    </div>

                </div>
            `;
            container.appendChild(row);
        });


        filteredTasks.forEach(task => {
            const taskElement = this.createTaskCard(task);
            const target = document.getElementById(`${task.status}Row`);
            if (target) {
                target.appendChild(taskElement);
            }
        });

        this.attachMoveControls();
    }


    createTaskCard(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-card';
        taskDiv.draggable = true;
        taskDiv.dataset.taskId = task.id;

        const dueDateObj = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = dueDateObj && dueDateObj < new Date() && task.status !== 'done';
        const isDueSoon = dueDateObj && !isOverdue && (dueDateObj - new Date()) <= 3 * 24 * 60 * 60 * 1000;
        const dueText = task.dueDate ? formatDateUtil(dueDateObj) : '';
        if (isOverdue) {
            taskDiv.classList.add('overdue-task');
        } else if (isDueSoon) {
            taskDiv.classList.add('due-soon-task');
        }
        
        const tagsHtml = task.tags && task.tags.length > 0
            ? `<div class="task-tags">${task.tags.map(tag => `<span class="task-tag">${escapeHtmlUtil(tag)}</span>`).join('')}</div>`
            : '';

        const notesHtml = task.notes ? `<button class="toggle-notes-btn">Notes</button><div class="task-notes collapsed">${escapeHtmlUtil(task.notes)}</div>` : '';
        const commentsHtml = task.comments && task.comments.length ? `<button class="toggle-comments-btn">Comments (${task.comments.length})</button><div class="card-comments collapsed">${task.comments.map(c => `<div class="comment-item">${escapeHtmlUtil(c.text)}</div>`).join('')}</div>` : '';

        const labelsHtml = task.labels && task.labels.length > 0
            ? `<div class="task-labels">${task.labels.map(l => `<span class="task-label" style="background:${this.labelMap[l] || '#888'}">${escapeHtmlUtil(l)}</span>`).join('')}</div>`
            : '';

        const assignee = this.userMap[task.assignedTo];
        const avatar = assignee && assignee.photoURL ? `<img src="${assignee.photoURL}" class="task-avatar" alt="${escapeHtmlUtil(assignee.displayName || '')}">` : '';

        const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
        const completedSub = subtasks.filter(s => s.completed).length;
        const progress = subtasks.length ? Math.round((completedSub / subtasks.length) * 100) : 0;
        const subHtml = subtasks.map(st => `<label class="subtask-item"><input type="checkbox" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''}>${escapeHtmlUtil(st.text)}</label>`).join('');


        taskDiv.innerHTML = `
            <div class="task-priority priority-${task.priority}"></div>
            <div class="task-header">
                <span class="material-icons drag-handle" aria-hidden="true">drag_handle</span>
                <div class="task-title">${escapeHtmlUtil(task.title)}</div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="todoApp.openEditTaskModal('${task.id}')" title="Edit"><span class="material-icons">edit</span></button>
                    <button class="task-action-btn" onclick="todoApp.confirmDeleteTask('${task.id}')" title="Delete"><span class="material-icons">delete</span></button>
                </div>
            </div>


            ${tagsHtml}
            ${notesHtml}
            ${commentsHtml}
            <div class="task-meta">

                <span class="task-category">${escapeHtmlUtil(task.category || 'Work')}</span>
                <span class="task-type">${escapeHtmlUtil(task.type || 'General')}</span>
                ${task.dueDate ? `<span class="task-due ${isOverdue ? 'overdue' : (isDueSoon ? 'soon' : '')}">${dueText}</span>` : ''}
                ${avatar}
            </div>
            <div class="task-timer">
                <span class="timer-indicator" aria-hidden="true"></span>
                <button class="timer-btn task-start-btn" aria-label="Start timer">Start</button>
                <button class="timer-btn task-stop-btn" aria-label="Stop timer">Stop</button>
                <span class="task-time-spent">${formatDurationUtil(task.timeSpent)}</span>
            </div>
        `;

        const startBtn = taskDiv.querySelector('.task-start-btn');
        const stopBtn = taskDiv.querySelector('.task-stop-btn');
        const indicator = taskDiv.querySelector('.timer-indicator');

        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startTaskTimer(task.id);
        });
        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stopTaskTimer(task.id);
        });

        const notesToggle = taskDiv.querySelector('.toggle-notes-btn');
        if (notesToggle) {
            notesToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const notesEl = taskDiv.querySelector('.task-notes');
                if (notesEl) notesEl.classList.toggle('expanded');
            });
        }
        const commentsToggle = taskDiv.querySelector('.toggle-comments-btn');
        if (commentsToggle) {
            commentsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const comEl = taskDiv.querySelector('.card-comments');
                if (comEl) comEl.classList.toggle('expanded');
            });
        }

        if (this.activeTimers[task.id]) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-flex';
            indicator.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'none';
            indicator.style.display = 'none';
        }

        taskDiv.querySelectorAll('.subtask-item input').forEach(cb => {
            cb.addEventListener('change', (e) => {
                this.toggleSubtask(task.id, cb.dataset.subtaskId);
            });
        });
        const addBtn = taskDiv.querySelector('.add-subtask-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = prompt('New subtask');
                if (text) this.addSubtask(task.id, text);
            });
        }

        return taskDiv;
    }

    renderTodayView() {
        const today = new Date().toDateString();
        const todayTasks = this.tasks.filter(t => {
            return t.dueDate && new Date(t.dueDate).toDateString() === today;
        });

        const container = document.getElementById('todayTasks');
        container.innerHTML = '';

        if (todayTasks.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <span class="material-icons" style="font-size:48px;margin-bottom:16px;">celebration</span>
                    <h3 style="margin-bottom: 8px;">No tasks due today!</h3>
                    <p>Enjoy your free time or add new tasks for today.</p>
                </div>
            `;
            return;
        }

        todayTasks.forEach(task => {
            const taskElement = this.createTaskCard(task);
            taskElement.style.marginBottom = '12px';
            container.appendChild(taskElement);
        });
    }

    renderUpcomingView() {
        const upcoming = this.tasks.filter(t => {
            return t.dueDate && new Date(t.dueDate) > new Date() && 
                   new Date(t.dueDate).toDateString() !== new Date().toDateString();
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        const container = document.getElementById('upcomingTimeline');
        container.innerHTML = '';

        if (upcoming.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <span class="material-icons" style="font-size:48px;margin-bottom:16px;">event</span>
                    <h3 style="margin-bottom: 8px;">No upcoming tasks</h3>
                    <p>You're all caught up! Add tasks with due dates to see them here.</p>
                </div>
            `;
            return;
        }

        upcoming.forEach(task => {
            const taskElement = this.createTaskCard(task);
            taskElement.style.marginBottom = '12px';
            container.appendChild(taskElement);
        });
    }

    renderCompletedView() {
        const completed = this.tasks.filter(t => t.status === 'done')
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const container = document.getElementById('completedList');
        container.innerHTML = '';

        if (completed.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <span class="material-icons" style="font-size:48px;margin-bottom:16px;">check_circle</span>
                    <h3 style="margin-bottom: 8px;">No completed tasks yet</h3>
                    <p>Complete some tasks to see your achievements here!</p>
                </div>
            `;
            return;
        }

        completed.forEach(task => {
            const taskElement = this.createTaskCard(task);
            taskElement.style.marginBottom = '12px';
            taskElement.style.opacity = '0.8';
            container.appendChild(taskElement);
        });
    }

    renderWeeklyChart() {
        const chartContainer = document.getElementById('weeklyChart');
        if (!chartContainer) return;

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = this.getWeeklyData();
        // Use spread operator to calculate maximum value safely
        const maxValue = Math.max(...data, 5);

        chartContainer.innerHTML = days.map((day, index) => {
            const height = (data[index] / maxValue) * 100;
            return `
                <div class="chart-bar" 
                     style="height: ${Math.max(height, 4)}%;" 
                     data-day="${day}"
                     data-value="${data[index]}"
                     title="${day}: ${data[index]} tasks completed">
                </div>
            `;
        }).join('');
    }

    updateInsights() {
        const thisWeek = this.getWeekCompletedTasks(0);
        const lastWeek = this.getWeekCompletedTasks(1);
        const weeklyChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
        const dailyAverage = Math.round(thisWeek / 7);
        const bestDay = this.getBestDay();
        const focusScore = this.calculateFocusScore();

        document.getElementById('weeklyCompleted').textContent = thisWeek;
        document.getElementById('weeklyChange').textContent = weeklyChange >= 0 ? `+${weeklyChange}%` : `${weeklyChange}%`;
        document.getElementById('weeklyChange').className = `metric-change ${weeklyChange >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('dailyAverage').textContent = dailyAverage;
        document.getElementById('bestDay').textContent = bestDay;
        document.getElementById('focusScore').textContent = `${focusScore}%`;
    }

    // View Management
    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

        this.currentView = viewName;
        this.renderCurrentView();
        this.updateHeaderShadow();
    }

    switchViewMode(mode) {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const activeBtn = document.querySelector(`[data-view="${mode}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.setAttribute('aria-pressed', 'true');
        }

        this.viewMode = mode;

        // Reset scroll positions when switching views
        const activeView = document.querySelector('.view-container.active');
        if (activeView) activeView.scrollTop = 0;
        const kanban = document.querySelector('.kanban-container');
        if (kanban) kanban.scrollLeft = 0;
        const rows = document.getElementById('rowsContainer');
        if (rows) rows.scrollLeft = 0;
        this.renderCurrentView();
        this.updateHeaderShadow();
    }

    updateHeaderShadow() {
        const header = document.querySelector('.top-bar');
        const activeView = document.querySelector('.view-container.active');
        if (!header || !activeView) return;
        if (activeView.scrollTop > 0) {
            header.classList.add('sticky-active');
        } else {
            header.classList.remove('sticky-active');
        }
    }

    toggleEditFields(isEdit) {
        const modal = document.getElementById('taskModal');
        if (!modal) return;
        if (isEdit) {
            modal.classList.add('edit-mode');
            modal.classList.remove('add-mode');
        } else {
            modal.classList.remove('edit-mode');
            modal.classList.add('add-mode');
        }
    }

    // Modal Management
    openAddTaskModal(status = 'todo') {
        this.currentEditingTask = null;
        document.getElementById('modalTitle').textContent = 'Add New Task';
        this.toggleEditFields(false);
        this.clearTaskForm();
        document.getElementById('taskStatus').value = status;
        const projectSelect = document.getElementById('taskProject');
        if (projectSelect && this.projects.length) {
            const saved = localStorage.getItem('lastProject');
            projectSelect.value = (saved && this.projectMap[saved]) ? saved : this.projects[0].id;
        }
        const draftStr = localStorage.getItem('taskDraft');
        if (draftStr) {
            try {
                const d = JSON.parse(draftStr);
                document.getElementById('taskTitle').value = d.title || '';
                document.getElementById('taskProject').value = d.projectId || projectSelect.value;
                document.getElementById('taskAssignee').value = d.assignee || '';
                this.updatePriorityBadges(d.priority || 'medium');
                document.getElementById('taskDueDate').value = d.dueDate || '';
                document.getElementById('taskCategory').value = d.category || '';
                document.getElementById('taskType').value = d.type || '';
                document.getElementById('taskDescription').value = d.description || '';
                document.getElementById('taskEstimate').value = d.estimate || '';
                document.getElementById('taskTags').value = d.tags || '';
            } catch (e) {
                console.warn('Failed to parse draft', e);
            }
        } else {
            this.updatePriorityBadges('medium');
        }
        this.handleProjectChange();
        const commentsEl = document.getElementById('commentsContainer');
        if (commentsEl) commentsEl.innerHTML = '';
        const activityEl = document.getElementById('activityFeed');
        if (activityEl) activityEl.innerHTML = '';
        const attList = document.getElementById('attachmentsList');
        if (attList) attList.innerHTML = '';
        const count = document.getElementById('commentsCount');
        if (count) count.textContent = '';
        this.showModalTab(localStorage.getItem('taskModalTab') || 'detailsTab');
        this.updateWatchButton({watchers: []});
        const modalTime = document.getElementById('modalTimeSpent');
        if (modalTime) modalTime.textContent = '';
        this.updateTaskTimerUI('', false);
        const commentDraft = localStorage.getItem('commentDraft_new');
        const commentInputNew = document.getElementById('taskComment');
        if (commentInputNew) commentInputNew.value = commentDraft || '';
        const modal = document.getElementById('taskModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('taskTitle').focus();
    }

    openEditTaskModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.currentEditingTask = taskId;
        document.getElementById('modalTitle').textContent = 'Edit Task';
        this.toggleEditFields(true);
        
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        this.updatePriorityBadges(task.priority || 'medium');
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskDueDate').value = task.dueDate || '';
        document.getElementById('taskCategory').value = task.category || '';
        document.getElementById('taskType').value = task.type || '';
        const projectSelectEdit = document.getElementById('taskProject');
        if (projectSelectEdit) {
            projectSelectEdit.value = task.projectId || '';
        }
        this.handleProjectChange();
        const assignee = this.userMap[task.assignedTo];
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) assigneeSelect.value = task.assignedTo || '';
        const avatarEl = document.getElementById('assigneeAvatarPreview');
        if (avatarEl) {
            if (assignee && assignee.photoURL) {
                avatarEl.src = assignee.photoURL;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.style.display = 'none';
            }
        }
        const depEl = document.getElementById('taskDependencies');
        if (depEl) depEl.value = (task.dependencies || []).join(', ');
        const estEl = document.getElementById('taskEstimate');
        if (estEl) estEl.value = task.estimate || 0;
        const timeEl = document.getElementById('taskTimeSpent');
        if (timeEl) timeEl.value = task.timeSpent || 0;
        const attachEl = document.getElementById('taskAttachments');
        if (attachEl) attachEl.value = '';

        if (typeof this.renderComments === 'function') {
            this.renderComments(task);
        }
        this.renderAttachments(task);
        const commentInput = document.getElementById('taskComment');
        if (commentInput) commentInput.value = localStorage.getItem(`commentDraft_${taskId}`) || '';
        const notesEl = document.getElementById('taskNotes');
        if (notesEl) notesEl.value = task.notes || '';
        this.renderActivity(task);
        this.updateCommentsCount(task);
        this.updateWatchButton(task);
        const modalTime = document.getElementById('modalTimeSpent');
        if (modalTime) modalTime.textContent = formatDurationUtil(task.timeSpent);
        this.updateTaskTimerUI(taskId, !!this.activeTimers[taskId]);
        this.showModalTab(localStorage.getItem('taskModalTab') || 'detailsTab');
        const tagsEl = document.getElementById('taskTags');
        if (tagsEl) tagsEl.value = task.tags?.join(', ') || '';

        
        const modal = document.getElementById('taskModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('taskTitle').focus();
    }

    closeModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('edit-mode', 'add-mode');
        this.clearTaskForm();
        this.currentEditingTask = null;
    }

    clearTaskForm() {
        const get = id => document.getElementById(id);
        get('taskTitle').value = '';
        get('taskDescription').value = '';
        this.updatePriorityBadges('medium');
        get('taskStatus').value = 'todo';
        get('taskDueDate').value = '';
        get('taskCategory').value = '';
        get('taskType').value = '';
        if (this.projects.length) {
            get('taskProject').value = this.projects[0].id;
        } else {
            get('taskProject').value = '';
        }
        if (get('taskAssignee')) get('taskAssignee').value = '';
        const avatarEl = get('assigneeAvatarPreview');
        if (avatarEl) avatarEl.style.display = 'none';
        if (get('taskDependencies')) get('taskDependencies').value = '';
        get('taskEstimate').value = '';
        if (get('taskTimeSpent')) get('taskTimeSpent').value = '';
        if (get('taskAttachments')) get('taskAttachments').value = '';
        const attList = get('attachmentsList');
        if (attList) attList.innerHTML = '';
        if (get('taskComment')) get('taskComment').value = '';
        const comments = get('commentsContainer');
        if (comments) comments.innerHTML = '';
        const comCount = document.getElementById('commentsCount');
        if (comCount) comCount.textContent = '';
        if (get('taskNotes')) get('taskNotes').value = '';
        const act = get('activityFeed');
        if (act) act.innerHTML = '';
        get('taskTags').value = '';
        localStorage.removeItem('taskDraft');
        localStorage.removeItem('commentDraft_new');
        this.handleProjectChange();
    }


    // Quick Capture
    openQuickCapture() {
        const modal = document.getElementById('quickCaptureModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('quickTaskInput').focus();
        document.getElementById('quickTaskDueDate').value = '';
    }


    closeQuickCapture() {
        document.getElementById('quickCaptureModal').classList.remove('active');
        document.getElementById('quickTaskInput').value = '';
        document.getElementById('quickTaskDueDate').value = '';
    }

    openInsights() {
        document.getElementById('insightsModal').classList.add('active');
        this.updateInsights();
        this.renderWeeklyChart();
        document.getElementById('insightsClose').focus();
    }

    closeInsights() {
        document.getElementById('insightsModal').classList.remove('active');
        document.getElementById('insightsToggle')?.focus();
    }

    applyDateShortcut(type) {
        const input = document.getElementById('taskDueDate') || document.getElementById('quickTaskDueDate');
        const now = new Date();
        let date;

        switch (type) {
            case 'tomorrow':
                date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, now.getHours(), now.getMinutes());
                break;
            case 'next-week':
                date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, now.getHours(), now.getMinutes());
                break;
            case 'end-month':
                date = new Date(now.getFullYear(), now.getMonth() + 1, 0, now.getHours(), now.getMinutes());
                break;
            default:
                return;
        }

        if (input) {
            input.value = date.toISOString().slice(0, 16);
        }
    }

    saveQuickTask() {
        const title = document.getElementById('quickTaskInput').value.trim();
        const dueDate = document.getElementById('quickTaskDueDate').value;
        if (!title) return;

        this.addTask({ title, status: 'todo', category: 'Work', type: 'General', dueDate });
        this.closeQuickCapture();
    }

    // Utility Functions
    getFilteredTasks() {
        // Clone tasks array using the spread operator for filtering
        let filtered = [...this.tasks];

        if (this.searchTerm) {
            const search = this.searchTerm.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(search) ||
                (task.description && task.description.toLowerCase().includes(search)) ||
                (task.category && task.category.toLowerCase().includes(search)) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(search))) ||
                (task.labels && task.labels.some(l => l.toLowerCase().includes(search)))
            );
        }

        if (this.activeFilter) {
            filtered = filtered.filter(task => task.category === this.activeFilter);
        }

        return filtered;
    }

    getTaskStats() {
        const stats = {
            total: this.tasks.length,
            completed: 0,
            inProgress: 0,
            today: 0,
            upcoming: 0,
            categories: {}
        };

        const todayStr = new Date().toDateString();
        const now = new Date();

        for (const t of this.tasks) {
            if (t.status === 'done') stats.completed++;
            if (t.status === 'inprogress') stats.inProgress++;
            if (t.category) {
                stats.categories[t.category] = (stats.categories[t.category] || 0) + 1;
            }
            if (t.dueDate) {
                const due = new Date(t.dueDate);
                if (due.toDateString() === todayStr) stats.today++;
                else if (due > now && due.toDateString() !== todayStr) stats.upcoming++;
            }
        }


        return stats;
    }

    computeTimeTotals() {
        const totals = {};
        for (const t of this.tasks) {
            const cat = t.category || 'Uncategorized';
            const spent = parseFloat(t.timeSpent) || 0;
            totals[cat] = (totals[cat] || 0) + spent;
        }
        return totals;
    }

    getWeeklyData() {
        const data = new Array(7).fill(0);
        const today = new Date();
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - (6 - i));
            const dateString = date.toISOString().split('T')[0];
            
            data[i] = this.tasks.filter(task =>
                task.status === 'done' &&
                task.updatedAt &&
                task.updatedAt.startsWith(dateString)
            ).length;
        }
        
        return data;
    }

    getWeekCompletedTasks(weeksAgo = 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (7 * weeksAgo + 6));
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - (7 * weeksAgo));
        endDate.setHours(23, 59, 59, 999);

        return this.tasks.filter(task => {
            if (task.status !== 'done' || !task.updatedAt) return false;
            const taskDate = new Date(task.updatedAt);
            return taskDate >= startDate && taskDate <= endDate;
        }).length;
    }

    calculateStreak() {
        const today = new Date();
        let streak = 0;
        
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateString = checkDate.toISOString().split('T')[0];
            
            const hasCompletedTasks = this.tasks.some(task =>
                task.status === 'done' &&
                task.updatedAt &&
                task.updatedAt.startsWith(dateString)
            );
            
            if (hasCompletedTasks) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    getBestDay() {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayCounts = new Array(7).fill(0);
        
        this.tasks.filter(t => t.status === 'done').forEach(task => {
            if (task.updatedAt) {
                const day = new Date(task.updatedAt).getDay();
                dayCounts[day]++;
            }
        });
        
        const maxIndex = dayCounts.indexOf(Math.max(...dayCounts));
        return dayNames[maxIndex];
    }

    calculateFocusScore() {
        const highPriority = this.tasks.filter(t => t.priority === 'high');
        const completedHigh = highPriority.filter(t => t.status === 'done');
        return highPriority.length > 0 ? Math.round((completedHigh.length / highPriority.length) * 100) : 100;
    }

    getWeeklyTimeSpent() {
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        let total = 0;
        this.tasks.forEach(task => {
            if (!task.updatedAt) return;
            const d = new Date(task.updatedAt);
            if (d >= start && d <= end) {
                total += parseFloat(task.timeSpent || 0);
            }
        });
        return Math.round(total * 100) / 100;
    }

    updateWeeklyTime() {
        const el = document.getElementById('weeklyHours');
        if (el) {
            el.textContent = `${this.getWeeklyTimeSpent().toFixed(1)}h`;
        }
    }

    renderReactionButton(type, emoji, count) {
        return `<button type="button" class="emoji-btn" data-emoji="${type}">${emoji} <span>${count}</span></button>`;
    }

    renderComments(task) {
        const container = document.getElementById('commentsContainer');
        if (!container) return;
        container.innerHTML = (task.comments || []).map((c, idx) => {
            const reactions = c.reactions || { like: 0, love: 0, laugh: 0, wow: 0 };
            const avatar = this.userMap[c.userId]?.photoURL || 'https://via.placeholder.com/24';
            return `
                <div class="comment-item" data-comment-index="${idx}">
                    <div class="comment-meta"><img class="comment-avatar" src="${escapeHtmlUtil(avatar)}" alt=""> ${escapeHtmlUtil(c.author)} - ${formatDateUtil(new Date(c.timestamp))}</div>
                    <div>${escapeHtmlUtil(c.text)}</div>
                    <div class="comment-reactions">
                        ${this.renderReactionButton('like','👍', reactions.like || 0)}
                        ${this.renderReactionButton('love','❤️', reactions.love || 0)}
                        ${this.renderReactionButton('laugh','😂', reactions.laugh || 0)}
                        ${this.renderReactionButton('wow','😮', reactions.wow || 0)}
                    </div>
                </div>`;
        }).join('');

        container.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.closest('.comment-item').dataset.commentIndex, 10);
                this.addReaction(task.id, idx, btn.dataset.emoji);
            });
        });
    }

    addReaction(taskId, index, key) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task || !task.comments || !task.comments[index]) return;
        task.comments[index].reactions = task.comments[index].reactions || { like: 0, love: 0, laugh: 0, wow: 0 };
        task.comments[index].reactions[key] = (task.comments[index].reactions[key] || 0) + 1;
        this.saveTaskToFirestore(task);
        this.renderComments(task);
        this.updateUI();
    }

    collectNewComment() {
        const commentEl = document.getElementById('taskComment');
        if (!commentEl) return null;
        const text = commentEl.value.trim();
        if (!text) return null;
        const author = window.currentUser?.displayName || 'Me';
        const userId = window.currentUser?.uid || 'anonymous';
        return [{
            text,
            author,
            userId,
            timestamp: new Date().toISOString(),
            reactions: { like: 0, love: 0, laugh: 0, wow: 0 }
        }];
    }

    // Event Listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                this.switchView(item.dataset.view);
            });
        });

        // Category filters
        document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
            item.addEventListener('click', () => {
                this.activeFilter = this.activeFilter === item.dataset.filter ? null : item.dataset.filter;
                this.updateUI();
            });
        });

        // View mode toggles
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchViewMode(btn.dataset.view);
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', debounceUtil((e) => {
            this.searchTerm = e.target.value.trim();
            this.updateUI();
        }, 300));

        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        document.getElementById('taskForm').addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.handleFormSubmit();
            }
        });

        document.getElementById('taskForm').addEventListener('input', () => this.saveDraft());

        const titleInput = document.getElementById('taskTitle');
        if (titleInput) {
            titleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    projectSelect?.focus();
                }
            });
        }

        const assignBtn = document.getElementById('assignToMeBtn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => this.assignToMe());
        }

        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.createProject());
        }
        const projectSelect = document.getElementById('taskProject');
        if (projectSelect) {
            projectSelect.addEventListener('change', () => {
                this.handleProjectChange();
                localStorage.setItem('lastProject', projectSelect.value);
            });
        }

        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.addEventListener('change', () => {
                const uid = assigneeSelect.value;
                const user = this.userMap[uid];
                const avatarEl = document.getElementById('assigneeAvatarPreview');
                if (avatarEl) {
                    if (user && user.photoURL) {
                        avatarEl.src = user.photoURL;
                        avatarEl.style.display = 'block';
                    } else {
                        avatarEl.style.display = 'none';
                    }
                }
            });
        }

        // Quick capture
        document.getElementById('quickTaskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveQuickTask();
            }
        });

        // CSV import
        document.getElementById('csvImport').addEventListener('change', (e) => {
            this.importFromCSV(e);
        });

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        const userInfo = document.getElementById('userInfo');
        const profileDropdown = document.getElementById('profileDropdown');
        if (userInfo && profileDropdown) {
            userInfo.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!profileDropdown.contains(e.target) && e.target !== userInfo && !userInfo.contains(e.target)) {
                    profileDropdown.classList.remove('open');
                }
            });
        }

        document.querySelectorAll('#priorityBadges .priority-badge').forEach(b => {
            b.addEventListener('click', () => this.updatePriorityBadges(b.dataset.value));
        });

        const labelsToggle = document.getElementById('labelsToggle');
        const labelsDropdown = document.getElementById('labelsDropdown');
        if (labelsToggle && labelsDropdown) {
            labelsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                labelsDropdown.classList.toggle('open');
            });
            document.getElementById('addLabelBtn').addEventListener('click', () => {
                const name = document.getElementById('newLabelName').value.trim();
                const color = document.getElementById('newLabelColor').value;
                this.addLabel(name, color);
                document.getElementById('newLabelName').value = '';
            });
            document.addEventListener('click', (e) => {
                if (!labelsDropdown.contains(e.target) && e.target !== labelsToggle) {
                    labelsDropdown.classList.remove('open');
                }
            });
        }

        const watchBtn = document.getElementById('watchTaskBtn');
        if (watchBtn) {
            watchBtn.addEventListener('click', () => {
                if (this.currentEditingTask) {
                    this.toggleWatchTask(this.currentEditingTask);
                }
            });
        }

        const mStart = document.getElementById('modalTimerStart');
        const mStop = document.getElementById('modalTimerStop');
        if (mStart) {
            mStart.addEventListener('click', () => {
                if (this.currentEditingTask) this.startTaskTimer(this.currentEditingTask);
            });
        }
        if (mStop) {
            mStop.addEventListener('click', () => {
                if (this.currentEditingTask) this.stopTaskTimer(this.currentEditingTask);
            });
        }

        const insightsBtn = document.getElementById('insightsToggle');
        if (insightsBtn) {
            insightsBtn.addEventListener('click', () => this.openInsights());
        }
        const insightsClose = document.getElementById('insightsClose');
        if (insightsClose) {
            insightsClose.addEventListener('click', () => this.closeInsights());
        }
        const weeklyInsightsLink = document.getElementById('weeklyInsightsLink');
        if (weeklyInsightsLink) {
            weeklyInsightsLink.addEventListener('click', () => this.openInsights());
        }

        // Date shortcuts
        document.querySelectorAll('.date-shortcut-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyDateShortcut(btn.dataset.shortcut);
            });
        });

        // Modal close on outside click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'quickCaptureModal') {
                        this.closeQuickCapture();
                    } else if (modal.id === 'insightsModal') {
                        this.closeInsights();
                    } else {
                        this.closeModal();
                    }
                }
            });
        });

        // Header shadow on scroll
        document.querySelectorAll('.view-container').forEach(view => {
            view.addEventListener('scroll', () => this.updateHeaderShadow());
        });
        this.updateHeaderShadow();

        this.attachMoveControls();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Global shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.openAddTaskModal();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.openQuickCapture();
                        break;
                    case 's':
                        e.preventDefault();
                        this.exportToCSV();
                        break;
                    case '1':
                        e.preventDefault();
                        if (document.getElementById('taskModal').classList.contains('active')) {
                            this.showModalTab('detailsTab');
                        } else {
                            this.switchView('dashboard');
                        }
                        break;
                    case '2':
                        e.preventDefault();
                        if (document.getElementById('taskModal').classList.contains('active')) {
                            this.showModalTab('commentsTab');
                        } else {
                            this.switchView('today');
                        }
                        break;
                    case '3':
                        e.preventDefault();
                        if (document.getElementById('taskModal').classList.contains('active')) {
                            this.showModalTab('activityTab');
                        } else {
                            this.switchView('upcoming');
                        }
                        break;
                    case '4':
                        if (document.getElementById('taskModal').classList.contains('active')) {
                            e.preventDefault();
                            this.showModalTab('attachmentsTab');
                        }
                        break;
                }
            }
            
            // Escape key
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeQuickCapture();
                this.closeInsights();
            }
        });
    }

    // Drag and scroll helpers moved to ui.js

    setupAutoSave() {
        // Auto-save handled by Firestore real-time sync
    }

    // Form Handling
    handleFormSubmit() {
        const formData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            dueDate: document.getElementById('taskDueDate').value,
            category: document.getElementById('taskCategory').value,
            type: document.getElementById('taskType').value,
            projectId: document.getElementById('taskProject').value,
            assignedTo: document.getElementById('taskAssignee').value || null,
            estimate: document.getElementById('taskEstimate').value,
            tags: document.getElementById('taskTags').value
        };


        if (!formData.title.trim()) {
            this.showNotification('Error', 'Task title is required', 'error');
            document.getElementById('taskTitle').focus();
            return;
        }

        if (this.currentEditingTask) {
            this.updateTask(this.currentEditingTask, formData);
        } else {
            this.addTask(formData);
        }
        localStorage.removeItem('taskDraft');
        this.closeModal();
    }

    assignToMe() {
        const uid = window.currentUser?.uid;
        if (!uid) return;
        const select = document.getElementById('taskAssignee');
        if (select) select.value = uid;
        const user = this.userMap[uid];
        const avatarEl = document.getElementById('assigneeAvatarPreview');
        if (avatarEl) {
            if (user && user.photoURL) {
                avatarEl.src = user.photoURL;
                avatarEl.style.display = 'block';
            } else {
                avatarEl.style.display = 'none';
            }
        }
    }

    updateWatchButton(task) {
        const btn = document.getElementById('watchTaskBtn');
        if (!btn) return;
        const uid = window.currentUser?.uid;
        const watching = uid && task.watchers && task.watchers.includes(uid);
        btn.innerHTML = `<span class="material-icons">${watching ? 'notifications_active' : 'notifications_off'}</span>`;
        btn.setAttribute('aria-label', watching ? 'Unwatch task' : 'Watch task');
    }

    toggleWatchTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        const uid = window.currentUser?.uid;
        if (!task || !uid) return;
        task.watchers = Array.isArray(task.watchers) ? task.watchers : [];
        const idx = task.watchers.indexOf(uid);
        if (idx === -1) {
            task.watchers.push(uid);
            this.showNotification('Watching', 'You are now watching this task', 'success');
        } else {
            task.watchers.splice(idx, 1);
            this.showNotification('Unwatched', 'Stopped watching this task', 'info');
        }
        this.saveTaskToFirestore(task);
        this.updateWatchButton(task);
    }

    updatePriorityBadges(value) {
        const badges = document.querySelectorAll('#priorityBadges .priority-badge');
        badges.forEach(b => {
            if (b.dataset.value === value) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        const input = document.getElementById('taskPriority');
        if (input) input.value = value;
    }

    saveDraft() {
        const draft = {
            title: document.getElementById('taskTitle').value,
            projectId: document.getElementById('taskProject').value,
            assignee: document.getElementById('taskAssignee').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value,
            category: document.getElementById('taskCategory').value,
            type: document.getElementById('taskType').value,
            description: document.getElementById('taskDescription').value,
            estimate: document.getElementById('taskEstimate').value,
            tags: document.getElementById('taskTags').value
        };
        localStorage.setItem('taskDraft', JSON.stringify(draft));
    }

    confirmDeleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
            this.deleteTask(taskId);
        }
    }

    // Notifications & Reminders
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    startReminderSystem() {
        this.checkReminders();
        setInterval(() => {
            this.checkReminders();
        }, 60000); // Check every minute
    }

    checkReminders() {
        const now = new Date();
        
        this.tasks.forEach(task => {
            if (task.dueDate && task.status !== 'done' && !task.reminderSent) {
                const dueDate = new Date(task.dueDate);
                const timeDiff = dueDate.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 3600);
                
                if (hoursDiff <= 2 && hoursDiff > 0) {
                    task.reminderSent = true;
                    this.saveTaskToFirestore(task);
                    
                    const message = `"${task.title}" is due in ${Math.ceil(hoursDiff)} hour${Math.ceil(hoursDiff) !== 1 ? 's' : ''}`;
                    this.showNotification('Task Reminder', message, 'warning');
                    this.showSystemNotification('Mumatec Task Reminder', message);
                }
            }
        });
    }

    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <div class="notification-title">${escapeHtmlUtil(title)}</div>
            <div class="notification-body">${escapeHtmlUtil(message)}</div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(320px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showSystemNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: 'https://fonts.gstatic.com/s/i/materialicons/assignment/v1/24px.svg'
            });
        }
    }

    // CSV Import/Export
    exportToCSV() {
        if (this.tasks.length === 0) {
            this.showNotification('No Data', 'No tasks to export', 'warning');
            return;
        }

        const headers = ['ID', 'Title', 'Description', 'Priority', 'Status', 'Due Date', 'Category', 'Type', 'Tags', 'Created', 'Updated'];
        const csvData = [headers];

        this.tasks.forEach(task => {
            csvData.push([
                task.id,
                task.title,
                task.description || '',
                task.priority,
                task.status,
                task.dueDate || '',
                task.category || '',
                task.type || 'General',
                task.tags ? task.tags.join(';') : '',
                task.createdAt,
                task.updatedAt || task.createdAt
            ]);
        });

        const csvContent = csvData.map(row => 
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `mumatec-tasks-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Success', `Exported ${this.tasks.length} tasks`, 'success');
    }

    importFromCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                
                let importedCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    try {
                        const values = parseCSVLineUtil(line);
                        if (values.length < headers.length) continue;

                        const task = {
                            id: values[0] || generateId(),
                            title: values[1] || `Imported Task ${i}`,
                            description: values[2] || '',
                            priority: ['low', 'medium', 'high', 'critical'].includes(values[3]) ? values[3] : 'medium',
                            status: this.statuses.includes(values[4]) ? values[4] : 'todo',
                            dueDate: values[5] || null,
                            category: values[6] || 'Work',
                            type: values[7] || 'General',
                            tags: values[8] ? values[8].split(';').map(tag => tag.trim()).filter(tag => tag) : [],
                            createdAt: values[9] || new Date().toISOString(),
                            updatedAt: values[10] || new Date().toISOString(),
                            reminderSent: false
                        };

                        const existingTask = this.tasks.find(t => t.id === task.id);
                        if (existingTask) {
                            Object.assign(existingTask, task);
                        } else {
                            this.tasks.push(task);
                        }
                        this.saveTaskToFirestore(task);
                        importedCount++;
                    } catch (error) {
                        console.warn(`Error parsing line ${i + 1}:`, error);
                    }
                }

                this.updateUI();
                this.showNotification('Success', `Imported ${importedCount} tasks`, 'success');
            } catch (error) {
                console.error('CSV import error:', error);
                this.showNotification('Import Failed', 'Failed to parse CSV file', 'error');
            }
        };

        reader.readAsText(file);
        event.target.value = '';
    }

    loadStatusOrder() {
        const saved = localStorage.getItem('statusOrder');
        if (saved) {
            try {
                const arr = JSON.parse(saved);
                if (Array.isArray(arr)) {
                    const valid = arr.filter(s => this.statuses.includes(s));
                    this.statuses = valid.concat(this.statuses.filter(s => !valid.includes(s)));
                }
            } catch (e) {
                console.warn('Failed to parse status order', e);
            }
        }
    }

    saveStatusOrder() {
        localStorage.setItem('statusOrder', JSON.stringify(this.statuses));
    }

    loadCategoryOrder() {
        const saved = localStorage.getItem('categoryOrder');
        if (saved) {
            try {
                const arr = JSON.parse(saved);
                if (Array.isArray(arr)) {
                    this.categoryOrder = arr;
                }
            } catch (e) {
                console.warn('Failed to parse category order', e);
            }
        }
    }

    saveCategoryOrder() {
        localStorage.setItem('categoryOrder', JSON.stringify(this.categoryOrder));
    }

    moveCategory(cat, direction) {
        const idx = this.categoryOrder.indexOf(cat);
        if (idx === -1) return;
        if (direction === 'up' && idx > 0) {
            [this.categoryOrder[idx - 1], this.categoryOrder[idx]] = [this.categoryOrder[idx], this.categoryOrder[idx - 1]];
        } else if (direction === 'down' && idx < this.categoryOrder.length - 1) {
            [this.categoryOrder[idx + 1], this.categoryOrder[idx]] = [this.categoryOrder[idx], this.categoryOrder[idx + 1]];
        } else {
            return;
        }
        this.saveCategoryOrder();
        this.updateUI();
    }

    moveStatus(status, direction) {
        const idx = this.statuses.indexOf(status);
        if (idx === -1) return;
        if ((direction === 'left' || direction === 'up') && idx > 0) {
            [this.statuses[idx - 1], this.statuses[idx]] = [this.statuses[idx], this.statuses[idx - 1]];
        } else if ((direction === 'right' || direction === 'down') && idx < this.statuses.length - 1) {
            [this.statuses[idx + 1], this.statuses[idx]] = [this.statuses[idx], this.statuses[idx + 1]];
        } else {
            return;
        }
        this.saveStatusOrder();
        this.updateUI();
    }

    attachMoveControls() {
        document.querySelectorAll('.move-col').forEach(btn => {
            btn.onclick = () => this.moveStatus(btn.dataset.status, btn.dataset.direction);
        });
        document.querySelectorAll('.move-row').forEach(btn => {
            btn.onclick = () => this.moveStatus(btn.dataset.status, btn.dataset.direction);
        });
        document.querySelectorAll('.move-cat').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.moveCategory(btn.dataset.category, btn.dataset.direction);
            };
        });
    }

    updateTaskTimerUI(taskId, running) {
        const card = document.querySelector(`[data-task-id="${taskId}"]`);
        const modalStart = document.getElementById('modalTimerStart');
        const modalStop = document.getElementById('modalTimerStop');
        const modalInd = document.getElementById('modalTimerIndicator');
        const modalTime = document.getElementById('modalTimeSpent');
        if (card) {
            const startBtn = card.querySelector('.task-start-btn');
            const stopBtn = card.querySelector('.task-stop-btn');
            const indicator = card.querySelector('.timer-indicator');
            if (running) {
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'inline-flex';
                if (indicator) indicator.style.display = 'inline-block';
            } else {
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (stopBtn) stopBtn.style.display = 'none';
                if (indicator) indicator.style.display = 'none';
            }
        }
        if (modalStart && modalStop && modalInd) {
            if (running) {
                modalStart.style.display = 'none';
                modalStop.style.display = 'inline-flex';
                modalInd.style.display = 'inline-block';
            } else {
                modalStart.style.display = 'inline-flex';
                modalStop.style.display = 'none';
                modalInd.style.display = 'none';
            }
        }
        if (modalTime) {
            const task = this.tasks.find(t => t.id === taskId);
            modalTime.textContent = task ? formatDurationUtil(task.timeSpent) : '';
        }
    }

    startTaskTimer(taskId) {
        if (this.activeTimers[taskId]) return;
        this.activeTimers[taskId] = Date.now();
        this.updateTaskTimerUI(taskId, true);
    }

    async stopTaskTimer(taskId) {
        const start = this.activeTimers[taskId];
        if (!start) return;
        const minutes = Math.round((Date.now() - start) / 60000);
        delete this.activeTimers[taskId];
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.timeSpent = parseFloat(task.timeSpent || 0) + minutes / 60;
            task.updatedAt = new Date().toISOString();
            this.saveTaskToFirestore(task);
        }
        // Optionally log time entries via Cloud Functions in future
        this.updateTaskTimerUI(taskId, false);
        this.updateUI();
    }

    // Theme Management
    loadTheme() {
        if (typeof window.applySavedTheme === 'function') {
            window.applySavedTheme();
        } else {
            const saved = localStorage.getItem('mumatecTheme');
            if (saved === 'dark') {
                document.body.classList.add('dark-mode');
            }
        }
        this.updateThemeToggleIcon();
    }

    toggleTheme() {
        if (typeof window.toggleThemePreference === 'function') {
            window.toggleThemePreference();
        } else {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('mumatecTheme', isDark ? 'dark' : 'light');
        }
        this.updateThemeToggleIcon();
    }



    updateThemeToggleIcon() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.innerHTML = `<span class="material-icons">${document.body.classList.contains('dark-mode') ? 'light_mode' : 'dark_mode'}</span>`;
        }
    }

    // Sidebar collapse state
    loadSidebarState() {
        const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && collapsed && window.innerWidth > 768) {
            sidebar.classList.add('collapsed');
        }
        const btn = document.getElementById('sidebarToggle');
        if (btn) {
            btn.setAttribute('aria-expanded', String(!collapsed));
        }
    }

    setupSidebarToggle() {
        const btn = document.getElementById('sidebarToggle');
        if (btn) {
            btn.addEventListener('click', () => this.toggleSidebar());
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('open');
        } else {
            const collapsed = sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', collapsed);
            const btn = document.getElementById('sidebarToggle');
            if (btn) {
                btn.setAttribute('aria-expanded', String(!collapsed));
            }
        }
    }

    setupRoleLinks() {
        const links = document.querySelectorAll('.role-link');
        links.forEach(link => {
            const role = link.dataset.role || '';
            const roles = role.split(',').map(r => r.trim()).filter(Boolean);
            const visible = roles.some(r => window.currentUserRoles?.includes(r));
            link.style.display = visible ? 'block' : 'none';
        });
    }

    loadQuickNotes() {
        const area = document.getElementById('quickNotes');
        if (!area) return;
        area.value = localStorage.getItem('quickNotes') || '';
        area.addEventListener('input', () => {
            localStorage.setItem('quickNotes', area.value);
        });
    }

    // ----------------- Modal Enhancements -----------------
    setupModalTabs() {
        const buttons = document.querySelectorAll('#taskModal .tab-btn');
        const tabs = document.querySelectorAll('#taskModal .tab-content');
        const show = (id) => {
            tabs.forEach(t => {
                t.classList.toggle('active', t.id === id);
            });
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.tab === id);
            });
            localStorage.setItem('taskModalTab', id);
        };
        buttons.forEach(btn => {
            btn.addEventListener('click', () => show(btn.dataset.tab));
        });
        const stored = localStorage.getItem('taskModalTab');
        if (stored && document.getElementById(stored)) {
            show(stored);
        } else if (tabs[0]) {
            show(tabs[0].id);
        }

        const attachmentInput = document.getElementById('taskAttachments');
        const dropZone = document.getElementById('attachmentDropZone');
        if (attachmentInput && dropZone) {
            dropZone.addEventListener('click', () => attachmentInput.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length) {
                    this.addAttachments(this.currentEditingTask, e.dataTransfer.files);
                }
            });
            attachmentInput.addEventListener('change', () => {
                if (attachmentInput.files.length) {
                    this.addAttachments(this.currentEditingTask, attachmentInput.files);
                    attachmentInput.value = '';
                }
            });
        }

        const commentInputEl = document.getElementById('taskComment');
        const commentBtn = document.getElementById('addCommentBtn');
        if (commentInputEl) {
            commentInputEl.addEventListener('input', () => {
                if (this.currentEditingTask) {
                    localStorage.setItem(`commentDraft_${this.currentEditingTask}`, commentInputEl.value);
                } else {
                    localStorage.setItem('commentDraft_new', commentInputEl.value);
                }
            });
        }
        if (commentBtn) {
            commentBtn.addEventListener('click', () => {
                if (this.currentEditingTask) {
                    this.addComment(this.currentEditingTask);
                }
            });
        }
    }

    showModalTab(id) {
        const btn = document.querySelector(`#taskModal .tab-btn[data-tab="${id}"]`);
        if (btn) btn.click();
    }

    addComment(taskId) {
        const newCom = this.collectNewComment();
        if (!newCom) return;
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.comments = task.comments || [];
        task.comments.push(...newCom);
        task.activity = task.activity || [];
        task.activity.push({ action: 'Added comment', timestamp: new Date().toISOString() });
        document.getElementById('taskComment').value = '';
        localStorage.removeItem(`commentDraft_${taskId}`);
        this.saveTaskToFirestore(task);
        this.renderComments(task);
        this.renderActivity(task);
        this.updateCommentsCount(task);
        this.updateUI();
    }

    addAttachments(taskId, files) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        task.attachments = task.attachments || [];
        Array.from(files).forEach(f => {
            const url = URL.createObjectURL(f);
            task.attachments.push({ name: f.name, url, size: f.size });
            task.activity = task.activity || [];
            task.activity.push({ action: `Attached ${f.name}`, timestamp: new Date().toISOString() });
        });
        this.saveTaskToFirestore(task);
        this.renderAttachments(task);
        this.renderActivity(task);
        this.updateUI();
    }

    renderAttachments(task) {
        const list = document.getElementById('attachmentsList');
        if (!list) return;
        list.innerHTML = (task.attachments || []).map(a =>
            `<div class="attachment-item"><a href="${escapeHtmlUtil(a.url)}" target="_blank">${escapeHtmlUtil(a.name)}</a></div>`
        ).join('');
        const count = document.querySelector('button.tab-btn[data-tab="attachmentsTab"] span');
        if (count) count.textContent = task.attachments ? `(${task.attachments.length})` : '';
    }

    renderActivity(task) {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        feed.innerHTML = (task.activity || []).slice().reverse().map(a =>
            `<div class="activity-item">${escapeHtmlUtil(a.action)} - ${formatDateUtil(new Date(a.timestamp))}</div>`
        ).join('');
    }

    updateCommentsCount(task) {
        const label = document.getElementById('commentsCount');
        if (label) label.textContent = task.comments ? `(${task.comments.length})` : '';
    }
}

export default MumatecTaskManager;

