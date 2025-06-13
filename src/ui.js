export function setupDragAndDrop(manager) {
  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('task-card')) {
      manager.draggedTask = e.target.dataset.taskId;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('task-card')) {
      e.target.classList.remove('dragging');
      manager.draggedTask = null;
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const columnContent = e.target.closest('.column-content, .row-content');
    if (columnContent && manager.draggedTask) {
      const column = columnContent.closest('.kanban-column, .row-container');
      const newStatus = column.dataset.status;
      manager.moveTask(manager.draggedTask, newStatus);
    }
  });

  document.querySelectorAll('.column-content, .row-content').forEach(column => {
    column.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (manager.draggedTask) {
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

export function setupAutoScroll(manager) {
  const threshold = 40;
  let h = 0;
  let v = 0;
  let active = false;
  let rowTarget = null;

  const step = () => {
    if (!active) return;
    const view = document.querySelector('.view-container.active');
    const kanban = document.querySelector('.kanban-container');
    const horizontal = manager.viewMode === 'kanban' ? kanban : rowTarget;
    if (horizontal && h !== 0) {
      horizontal.scrollLeft += h;
    }
    if (view && v !== 0) {
      view.scrollTop += v;
    }
    requestAnimationFrame(step);
  };

  const update = (e) => {
    if (!manager.draggedTask) {
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

    if (manager.viewMode === 'list') {
      rowTarget = document.elementFromPoint(x, y)?.closest('.row-content');
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
