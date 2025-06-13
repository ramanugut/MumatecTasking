// src/ui.js - Enhanced UI functionality for Mumatec Task Manager

/**
 * Sets up drag and drop functionality for task cards
 * @param {Object} manager - The task manager instance
 */
export function setupDragAndDrop(manager) {
  let draggedElement = null;
  let placeholder = null;

  // Create placeholder element for visual feedback
  const createPlaceholder = () => {
    const placeholder = document.createElement('div');
    placeholder.className = 'task-card-placeholder';
    placeholder.innerHTML = '<div class="placeholder-content">Drop task here</div>';
    return placeholder;
  };

  // Drag start handler
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.task-card');
    if (!card || !card.draggable) return;

    draggedElement = card;
    manager.draggedTask = card.dataset.taskId;
    
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.taskId);
    
    // Create and store placeholder
    placeholder = createPlaceholder();
    
    // Add visual feedback to all valid drop zones
    document.querySelectorAll('.column-content, .row-content').forEach(zone => {
      zone.classList.add('drop-zone-available');
    });
  });

  // Drag end handler
  document.addEventListener('dragend', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;

    // Clean up dragging state
    card.classList.remove('dragging');
    draggedElement = null;
    manager.draggedTask = null;

    // Remove placeholder if it exists
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
    }
    placeholder = null;

    // Remove visual feedback from all drop zones
    document.querySelectorAll('.column-content, .row-content, .drag-over').forEach(zone => {
      zone.classList.remove('drop-zone-available', 'drag-over', 'drag-over-top', 'drag-over-bottom');
    });
  });

  // Drag over handler with improved positioning
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!manager.draggedTask) return;

    e.dataTransfer.dropEffect = 'move';
    
    const columnContent = e.target.closest('.column-content, .row-content');
    if (!columnContent) return;

    // Handle insertion position for better UX
    const afterElement = getDragAfterElement(columnContent, e.clientY);
    const draggingCard = document.querySelector('.task-card.dragging');
    
    if (placeholder) {
      if (afterElement == null) {
        columnContent.appendChild(placeholder);
      } else {
        columnContent.insertBefore(placeholder, afterElement);
      }
    }
  });

  // Drop handler
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!manager.draggedTask) return;

    const columnContent = e.target.closest('.column-content, .row-content');
    if (!columnContent) return;

    const column = columnContent.closest('.kanban-column, .row-container');
    if (!column) return;

    const newStatus = column.dataset.status;
    const oldStatus = draggedElement?.closest('.kanban-column, .row-container')?.dataset.status;

    // Only move if status actually changed or if reordering within same column
    if (newStatus !== oldStatus || placeholder) {
      // Get insertion position for reordering
      const afterElement = getDragAfterElement(columnContent, e.clientY);
      let insertIndex = null;
      
      if (afterElement) {
        const allTasks = Array.from(columnContent.querySelectorAll('.task-card:not(.dragging)'));
        insertIndex = allTasks.indexOf(afterElement);
      }

      manager.moveTask(manager.draggedTask, newStatus, insertIndex);
    }
  });

  // Enhanced drag enter/leave handlers
  document.addEventListener('dragenter', (e) => {
    if (!manager.draggedTask) return;
    
    const columnContent = e.target.closest('.column-content, .row-content');
    if (columnContent) {
      e.preventDefault();
      columnContent.classList.add('drag-over');
    }
  });

  document.addEventListener('dragleave', (e) => {
    if (!manager.draggedTask) return;
    
    const columnContent = e.target.closest('.column-content, .row-content');
    if (columnContent && !columnContent.contains(e.relatedTarget)) {
      columnContent.classList.remove('drag-over');
    }
  });

  // Helper function to determine insertion position
  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

/**
 * Sets up auto-scroll functionality during drag operations
 * @param {Object} manager - The task manager instance
 */
export function setupAutoScroll(manager) {
  const threshold = 60; // Increased threshold for better UX
  const scrollSpeed = 15; // Increased scroll speed
  let horizontalScroll = 0;
  let verticalScroll = 0;
  let isScrolling = false;
  let currentRowTarget = null;
  let animationId = null;

  const performScroll = () => {
    if (!isScrolling) return;

    const contentArea = document.querySelector('.content-area');
    const kanbanContainer = document.querySelector('.kanban-container');
    
    // Determine which element to scroll horizontally
    const horizontalTarget = manager.viewMode === 'kanban' ? kanbanContainer : currentRowTarget;
    
    // Apply horizontal scroll
    if (horizontalTarget && horizontalScroll !== 0) {
      horizontalTarget.scrollLeft += horizontalScroll;
    }
    
    // Apply vertical scroll
    if (contentArea && verticalScroll !== 0) {
      contentArea.scrollTop += verticalScroll;
    }
    
    // Continue scrolling
    animationId = requestAnimationFrame(performScroll);
  };

  const updateScrollDirection = (e) => {
    if (!manager.draggedTask) {
      horizontalScroll = 0;
      verticalScroll = 0;
      isScrolling = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      return;
    }

    const { clientX: x, clientY: y } = e;
    const { innerWidth: windowWidth, innerHeight: windowHeight } = window;
    
    // Reset scroll values
    horizontalScroll = 0;
    verticalScroll = 0;

    // Calculate horizontal scroll
    if (x < threshold) {
      horizontalScroll = -scrollSpeed * (1 - x / threshold);
    } else if (x > windowWidth - threshold) {
      horizontalScroll = scrollSpeed * (1 - (windowWidth - x) / threshold);
    }

    // Calculate vertical scroll
    if (y < threshold) {
      verticalScroll = -scrollSpeed * (1 - y / threshold);
    } else if (y > windowHeight - threshold) {
      verticalScroll = scrollSpeed * (1 - (windowHeight - y) / threshold);
    }

    // Update row target for list view
    if (manager.viewMode === 'list') {
      const elementUnderMouse = document.elementFromPoint(x, y);
      currentRowTarget = elementUnderMouse?.closest('.row-content');
    }

    // Start or stop scrolling
    const shouldScroll = horizontalScroll !== 0 || verticalScroll !== 0;
    if (shouldScroll && !isScrolling) {
      isScrolling = true;
      animationId = requestAnimationFrame(performScroll);
    } else if (!shouldScroll && isScrolling) {
      isScrolling = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
  };

  // Attach event listeners
  document.addEventListener('dragover', updateScrollDirection);
  document.addEventListener('mousemove', updateScrollDirection);
  
  document.addEventListener('dragend', () => {
    isScrolling = false;
    horizontalScroll = 0;
    verticalScroll = 0;
    currentRowTarget = null;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });
}

/**
 * Sets up keyboard shortcuts for the application
 * @param {Object} manager - The task manager instance
 */
export function setupKeyboardShortcuts(manager) {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input field
    if (e.target.matches('input, textarea, select')) return;

    const { key, ctrlKey, metaKey, shiftKey } = e;
    const isModKey = ctrlKey || metaKey;

    switch (key) {
      case 'n':
        if (isModKey) {
          e.preventDefault();
          manager.openAddTaskModal();
        }
        break;
      
      case 'f':
        if (isModKey) {
          e.preventDefault();
          document.getElementById('searchInput')?.focus();
        }
        break;
      
      case 'q':
        if (isModKey) {
          e.preventDefault();
          manager.openQuickCapture();
        }
        break;
      
      case 'Escape':
        manager.closeModal();
        manager.closeQuickCapture();
        manager.closeInsights();
        break;
      
      case '1':
      case '2':
      case '3':
      case '4':
        if (isModKey) {
          e.preventDefault();
          const views = ['dashboard', 'today', 'upcoming', 'completed'];
          const viewIndex = parseInt(key) - 1;
          if (views[viewIndex]) {
            manager.showView(views[viewIndex]);
          }
        }
        break;
    }
  });
}

/**
 * Sets up responsive behavior for different screen sizes
 */
export function setupResponsive() {
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const mainContent = document.querySelector('.main-content');

  // Toggle sidebar on mobile
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const isExpanded = sidebarToggle.getAttribute('aria-expanded') === 'true';
      
      sidebar?.classList.toggle('collapsed');
      sidebarToggle.setAttribute('aria-expanded', !isExpanded);
      
      // Update main content margin
      if (mainContent) {
        mainContent.classList.toggle('sidebar-collapsed');
      }
    });
  }

  // Handle window resize
  const handleResize = () => {
    const isSmallScreen = window.innerWidth < 768;
    
    if (isSmallScreen && sidebar && !sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed');
      sidebarToggle?.setAttribute('aria-expanded', 'false');
    } else if (!isSmallScreen && sidebar && sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      sidebarToggle?.setAttribute('aria-expanded', 'true');
    }
  };

  window.addEventListener('resize', handleResize);
  handleResize(); // Initial check
}

/**
 * Sets up search functionality
 * @param {Object} manager - The task manager instance
 */
export function setupSearch(manager) {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  let searchTimeout;

  const performSearch = (query) => {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (normalizedQuery === '') {
      // Show all tasks
      manager.currentFilter = null;
      manager.renderCurrentView();
      return;
    }

    // Filter tasks based on search query
    manager.currentFilter = (task) => {
      return task.title.toLowerCase().includes(normalizedQuery) ||
             task.description?.toLowerCase().includes(normalizedQuery) ||
             task.category?.toLowerCase().includes(normalizedQuery) ||
             task.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
             task.assignee?.toLowerCase().includes(normalizedQuery);
    };
    
    manager.renderCurrentView();
  };

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 300); // Debounce search
  });

  // Clear search on escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      performSearch('');
      searchInput.blur();
    }
  });
}

/**
 * Sets up theme toggle functionality
 */
export function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Update toggle icon
  const updateToggleIcon = (theme) => {
    const icon = themeToggle.querySelector('.material-icons');
    if (icon) {
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  };
  
  updateToggleIcon(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateToggleIcon(newTheme);
  });
}

/**
 * Initializes all UI functionality
 * @param {Object} manager - The task manager instance
 */
export function initializeUI(manager) {
  setupDragAndDrop(manager);
  setupAutoScroll(manager);
  setupKeyboardShortcuts(manager);
  setupResponsive();
  setupSearch(manager);
  setupThemeToggle();
  
  console.log('UI functionality initialized');
}
