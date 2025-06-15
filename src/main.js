import MumatecTaskManager from './tasks.js';

window.initTodoApp = function () {
  if (!window.todoApp) {
    window.todoApp = new MumatecTaskManager();
    console.log('🚀 Mumatec Tasking initialized successfully!');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.currentUser) {
    window.initTodoApp();
  }
});
