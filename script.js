// Mumatec Task Manager - Professional Application
import { db } from './firebase.js';
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
        
        this.init();
    }

    async init() {
        await this.loadTasks();
        await this.loadTaskTypes();
        await this.loadUsers();
        this.loadTheme();
        this.loadSidebarState();
        this.setupEventListeners();
        this.setupSidebarToggle();
        this.setupDragAndDrop();
        this.setupAutoScroll();
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
        list.innerHTML = this.customTypes.map(t => `<option value="${this.escapeHtml(t)}"></option>`).join('');
    }

    populateAssigneeDatalist() {
        const list = document.getElementById('assigneeSuggestions');
        if (!list) return;
        list.innerHTML = this.users.map(u => `<option value="${this.escapeHtml(u.displayName || u.email)}" data-uid="${u.id}"></option>`).join('');
    }

    createSampleTasks() {
        const sampleTasks = [
            {
                id: this.generateId(),
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
                id: this.generateId(),
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
                id: this.generateId(),
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

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Task Operations
    async addTask(taskData) {
        const task = {
            id: this.generateId(),
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
        document.getElementById('workCount').textContent = categories['Work'] || 0;
        document.getElementById('personalCount').textContent = categories['Personal'] || 0;
        document.getElementById('devCount').textContent = categories['Development'] || 0;
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
    }

    createTaskCard(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'task-card';
        taskDiv.draggable = true;
        taskDiv.dataset.taskId = task.id;

        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
        const dueText = task.dueDate ? this.formatDate(new Date(task.dueDate)) : '';
        
        const tagsHtml = task.tags && task.tags.length > 0
            ? `<div class="task-tags">${task.tags.map(tag => `<span class="task-tag">${this.escapeHtml(tag)}</span>`).join('')}</div>`
            : '';

        const assignee = this.userMap[task.assignedTo];
        const avatar = assignee && assignee.photoURL ? `<img src="${assignee.photoURL}" class="task-avatar" alt="${this.escapeHtml(assignee.displayName || '')}">` : '';

        taskDiv.innerHTML = `
            <div class="task-priority priority-${task.priority}"></div>
            <div class="task-header">
                <span class="material-icons drag-handle" aria-hidden="true">drag_handle</span>
                <div class="task-title">${this.escapeHtml(task.title)}</div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="todoApp.openEditTaskModal('${task.id}')" title="Edit"><span class="material-icons">edit</span></button>
                    <button class="task-action-btn" onclick="todoApp.confirmDeleteTask('${task.id}')" title="Delete"><span class="material-icons">delete</span></button>
                </div>
            </div>
            ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
            ${tagsHtml}
            <div class="task-meta">
                <span class="task-category">${this.escapeHtml(task.category || 'Work')}</span>
                <span class="task-type">${this.escapeHtml(task.type || 'General')}</span>
                ${task.dueDate ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${dueText}</span>` : ''}
                ${avatar}
            </div>
        `;

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
            document.getElementById('commentsContainer').insertAdjacentHTML('afterbegin', task.attachments.map(a => `<div class="comment-item">Attachment: ${this.escapeHtml(a.name || '')}</div>`).join(''));
        }
        document.getElementById('commentsContainer').innerHTML = (task.comments || []).map(c => `<div class="comment-item"><div class="comment-meta">${this.escapeHtml(c.author)} - ${this.formatDate(new Date(c.timestamp))}</div><div>${this.escapeHtml(c.text)}</div></div>`).join('');
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
    }


    closeQuickCapture() {
        document.getElementById('quickCaptureModal').classList.remove('active');
        document.getElementById('quickTaskInput').value = '';
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

    saveQuickTask() {
        const title = document.getElementById('quickTaskInput').value.trim();
        if (!title) return;

        this.addTask({ title, status: 'todo', category: 'Work', type: 'General' });
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

    formatDate(date) {
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(fn, delay = 300) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
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
        document.getElementById('searchInput').addEventListener('input', this.debounce((e) => {
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

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-card')) {
                this.draggedTask = e.target.dataset.taskId;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
                this.draggedTask = null;
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const columnContent = e.target.closest('.column-content');
            if (columnContent && this.draggedTask) {
                const column = columnContent.closest('.kanban-column');
                const newStatus = column.dataset.status;
                this.moveTask(this.draggedTask, newStatus);
            }
        });

        // Visual feedback
        document.querySelectorAll('.column-content').forEach(column => {
            column.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (this.draggedTask) {
                    column.classList.add('drag-over');
                }
            });

            column.addEventListener('dragleave', (e) => {
                e.preventDefault();
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });

            column.addEventListener('drop', () => {
                column.classList.remove('drag-over');
            });
        });
    }

    setupAutoScroll() {
        const threshold = 40;
        let h = 0;
        let v = 0;
        let active = false;

        const step = () => {
            if (!active) return;
            const kanban = document.querySelector('.kanban-container');
            const view = document.querySelector('.view-container.active');
            if (kanban && h !== 0) {
                kanban.scrollLeft += h;
            }
            if (view && v !== 0) {
                view.scrollTop += v;
            }
            requestAnimationFrame(step);
        };

        const update = (e) => {
            if (!this.draggedTask) {
                h = 0;
                v = 0;
                active = false;
                return;
            }

            const x = e.clientX;
            const y = e.clientY;
            const w = window.innerWidth;
            const hWin = window.innerHeight;

            h = 0;
            v = 0;

            if (x < threshold) {
                h = -10;
            } else if (x > w - threshold) {
                h = 10;
            }

            if (y < threshold) {
                v = -10;
            } else if (y > hWin - threshold) {
                v = 10;
            }

            if (!active && (h !== 0 || v !== 0)) {
                active = true;
                requestAnimationFrame(step);
            } else if (active && h === 0 && v === 0) {
                active = false;
            }
        };

        document.addEventListener('dragover', update);
        document.addEventListener('mousemove', update);
        document.addEventListener('dragend', () => {
            active = false;
        });
    }

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
            <div class="notification-title">${this.escapeHtml(title)}</div>
            <div class="notification-body">${this.escapeHtml(message)}</div>
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
                        const values = this.parseCSVLine(line);
                        if (values.length < headers.length) continue;

                        const task = {
                            id: values[0] || this.generateId(),
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

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
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

// Initialize the application after authentication
window.initTodoApp = function () {
    if (!window.todoApp) {
        window.todoApp = new MumatecTaskManager();
        console.log('🚀 Mumatec Task Manager initialized successfully!');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.currentUser) {
        window.initTodoApp();
    }

});

