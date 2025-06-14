// Mumatec Task Manager - Professional Application
import { db, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { generateId, escapeHtml as escapeHtmlUtil, parseCSVLine as parseCSVLineUtil, formatDate as formatDateUtil, debounce as debounceUtil } from './utils.js';
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
        this.activeTimers = {};
        this.categoryOrder = ['Work', 'Personal', 'Development'];
        this.categoryIcons = { Work: 'work', Personal: 'home', Development: 'code' };
        
        this.init();
    }

    async init() {
        await this.loadTasks();
        await this.loadTaskTypes();
        await this.loadUsers();
        this.loadTheme();
        this.loadSidebarState();
        this.loadStatusOrder();
        this.loadCategoryOrder();
        this.setupEventListeners();
        this.setupSidebarToggle();
        setupDragAndDrop(this);
        setupAutoScroll(this);
        this.setupKeyboardShortcuts();
        this.requestNotificationPermission();
        this.startReminderSystem();
        this.updateUI();
        this.setupAutoSave();
        
        // Set today's date
        document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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
                    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
            this.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            this.userMap = {};
            this.users.forEach(u => { this.userMap[u.id] = u; });
        } catch (e) {
            console.warn('Failed to load users', e);
            this.users = [];
            this.userMap = {};
        }
        this.populateAssigneeDatalist();
    }

    populateTypeDatalist() {
        const list = document.getElementById('typeSuggestions');
        if (!list) return;
        list.innerHTML = this.customTypes.map(t => `<option value="${escapeHtmlUtil(t)}"></option>`).join('');
    }

    populateAssigneeDatalist() {
        const list = document.getElementById('assigneeSuggestions');
        if (!list) return;
        list.innerHTML = this.users.map(u => `<option value="${escapeHtmlUtil(u.displayName || u.email)}" data-uid="${u.id}"></option>`).join('');
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
                assignedTo: null,
                dependencies: [],
                estimate: 2,
                timeSpent: 0,
                attachments: [],
                comments: [],
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
                assignedTo: null,
                dependencies: [],
                estimate: 1,
                timeSpent: 0,
                attachments: [],
                comments: [],
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
                assignedTo: null,
                dependencies: [],
                estimate: 0.5,
                timeSpent: 0.5,
                attachments: [],
                comments: [],
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        this.tasks = sampleTasks;
        sampleTasks.forEach(task => this.saveTaskToFirestore(task));
    }


    // Task Operations
    async addTask(taskData) {
        const task = {
            id: generateId(),
            title: taskData.title.trim(),
            description: taskData.description?.trim() || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            dueDate: taskData.dueDate || null,
            category: taskData.category?.trim() || 'Work',
            type: taskData.type || 'General',
            assignedTo: taskData.assignedTo || null,
            dependencies: this.parseTags(taskData.dependencies),
            estimate: parseFloat(taskData.estimate) || 0,
            timeSpent: parseFloat(taskData.timeSpent) || 0,
            attachments: taskData.attachments || [],
            comments: taskData.comments || [],
            tags: this.parseTags(taskData.tags),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reminderSent: false
        };

        this.tasks.push(task);
        this.saveTaskToFirestore(task);
        this.updateUI();
        this.showNotification('Success', 'Task created successfully', 'success');
        return task;
    }

    async updateTask(taskId, taskData) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return false;

        this.tasks[taskIndex] = {
            ...this.tasks[taskIndex],
            title: taskData.title.trim(),
            description: taskData.description?.trim() || '',
            priority: taskData.priority || 'medium',
            status: taskData.status || 'todo',
            dueDate: taskData.dueDate || null,
            category: taskData.category?.trim() || 'Work',
            type: taskData.type || 'General',
            assignedTo: taskData.assignedTo || this.tasks[taskIndex].assignedTo || null,
            dependencies: this.parseTags(taskData.dependencies),
            estimate: parseFloat(taskData.estimate) || this.tasks[taskIndex].estimate || 0,
            timeSpent: parseFloat(taskData.timeSpent) || this.tasks[taskIndex].timeSpent || 0,
            attachments: taskData.attachments && taskData.attachments.length ? [...(this.tasks[taskIndex].attachments || []), ...taskData.attachments] : (this.tasks[taskIndex].attachments || []),
            comments: taskData.comments ? [...(this.tasks[taskIndex].comments || []), ...taskData.comments] : (this.tasks[taskIndex].comments || []),
            tags: this.parseTags(taskData.tags),
            updatedAt: new Date().toISOString()
        };

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
        
        this.saveTaskToFirestore(task);
        this.updateUI();
        return true;
    }

    parseTags(tagsString) {
        if (!tagsString) return [];
        return tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // UI Management
    updateUI() {
        const stats = this.getTaskStats();
        this.updateStats(stats);
        this.updateNavigationCounts(stats);
        this.updateProductivityRing(stats);
        this.updateWeeklyTime();
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

    updateProductivityRing(stats) {
        const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        
        const ring = document.getElementById('progressRing');
        const circumference = 2 * Math.PI * 25; // radius = 25
        const offset = circumference - (percentage / 100) * circumference;
        
        ring.style.strokeDashoffset = offset;
        document.getElementById('productivityPercent').textContent = `${percentage}%`;
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
            dashboard: 'Dashboard',
            today: 'Today\'s Tasks',
            upcoming: 'Upcoming Tasks',
            completed: 'Completed Tasks'
        };
        
        document.getElementById('pageTitle').textContent = titles[this.currentView] || 'Dashboard';

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

        // Render tasks
        filteredTasks.forEach(task => {
            const taskElement = this.createTaskCard(task);
            const targetBoard = document.getElementById(`${task.status}Board`);
            if (targetBoard) {
                targetBoard.appendChild(taskElement);
            }
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

        const assignee = this.userMap[task.assignedTo];
        const avatar = assignee && assignee.photoURL ? `<img src="${assignee.photoURL}" class="task-avatar" alt="${escapeHtmlUtil(assignee.displayName || '')}">` : '';

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
            ${task.description ? `<div class="task-description">${escapeHtmlUtil(task.description)}</div>` : ''}
            ${tagsHtml}
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

        if (this.activeTimers[task.id]) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-flex';
            indicator.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'none';
            indicator.style.display = 'none';
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

    // Modal Management
    openAddTaskModal(status = 'todo') {
        this.currentEditingTask = null;
        document.getElementById('modalTitle').textContent = 'Add New Task';
        this.clearTaskForm();
        document.getElementById('taskStatus').value = status;
        document.getElementById('commentsContainer').innerHTML = '';
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
        
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskDueDate').value = task.dueDate || '';
        document.getElementById('taskCategory').value = task.category || '';
        document.getElementById('taskType').value = task.type || '';
        const assignee = this.userMap[task.assignedTo];
        document.getElementById('taskAssignee').value = assignee ? (assignee.displayName || assignee.email) : '';
        document.getElementById('taskDependencies').value = (task.dependencies || []).join(', ');
        document.getElementById('taskEstimate').value = task.estimate || 0;
        document.getElementById('taskTimeSpent').value = task.timeSpent || 0;
        document.getElementById('taskAttachments').value = '';
        if (task.attachments && task.attachments.length) {
            document.getElementById('commentsContainer').insertAdjacentHTML('afterbegin', task.attachments.map(a => `<div class="comment-item">Attachment: ${escapeHtmlUtil(a.name || '')}</div>`).join(''));
        }
        document.getElementById('commentsContainer').innerHTML = (task.comments || []).map(c => `<div class="comment-item"><div class="comment-meta">${escapeHtmlUtil(c.author)} - ${formatDateUtil(new Date(c.timestamp))}</div><div>${escapeHtmlUtil(c.text)}</div></div>`).join('');
        document.getElementById('taskComment').value = '';
        document.getElementById('taskTags').value = task.tags?.join(', ') || '';
        
        const modal = document.getElementById('taskModal');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('taskTitle').focus();
    }

    closeModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        this.clearTaskForm();
        this.currentEditingTask = null;
    }

    clearTaskForm() {
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskStatus').value = 'todo';
        document.getElementById('taskDueDate').value = '';
        document.getElementById('taskCategory').value = '';
        document.getElementById('taskType').value = '';
        document.getElementById('taskAssignee').value = '';
        document.getElementById('taskDependencies').value = '';
        document.getElementById('taskEstimate').value = '';
        document.getElementById('taskTimeSpent').value = '';
        document.getElementById('taskAttachments').value = '';
        document.getElementById('taskComment').value = '';
        document.getElementById('commentsContainer').innerHTML = '';
        document.getElementById('taskTags').value = '';
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
        let filtered = [...this.tasks];

        if (this.searchTerm) {
            const search = this.searchTerm.toLowerCase();
            filtered = filtered.filter(task => 
                task.title.toLowerCase().includes(search) ||
                (task.description && task.description.toLowerCase().includes(search)) ||
                (task.category && task.category.toLowerCase().includes(search)) ||
                (task.tags && task.tags.some(tag => tag.toLowerCase().includes(search)))
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

    lookupUserId(display) {
        const userEntry = Object.values(this.userMap).find(u =>
            (u.displayName || u.email) === display);
        return userEntry ? userEntry.id : null;
    }

    collectNewComment() {
        const text = document.getElementById('taskComment').value.trim();
        if (!text) return null;
        const author = window.currentUser?.displayName || 'Me';
        return [{ text, author, timestamp: new Date().toISOString() }];
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
                        this.switchView('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchView('today');
                        break;
                    case '3':
                        e.preventDefault();
                        this.switchView('upcoming');
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
            assignedTo: this.lookupUserId(document.getElementById('taskAssignee').value),
            dependencies: document.getElementById('taskDependencies').value,
            estimate: document.getElementById('taskEstimate').value,
            timeSpent: document.getElementById('taskTimeSpent').value,
            attachments: Array.from(document.getElementById('taskAttachments').files).map(f => ({ name: f.name })),
            comments: this.collectNewComment(),
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

        this.closeModal();
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
        if (!card) return;
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
        try {
            if (task && task.projectId) {
                const fn = httpsCallable(functions, 'logTimeEntry');
                await fn({ projectId: task.projectId, taskId, minutes });
            }
        } catch (e) {
            console.warn('logTimeEntry failed', e);
        }
        this.updateTaskTimerUI(taskId, false);
        this.updateUI();
    }

    // Theme Management
    loadTheme() {
        const saved = localStorage.getItem('mumatecTheme');
        if (saved === 'dark') {
            document.body.classList.add('dark-mode');
        }
        this.updateThemeToggleIcon();
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('mumatecTheme', isDark ? 'dark' : 'light');
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
}

export default MumatecTaskManager;

