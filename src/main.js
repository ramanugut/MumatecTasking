import MumatecTaskManager from './tasks.js';
import { auth } from '../firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';

window.initTodoApp = function () {
  if (!window.todoApp) {
    window.todoApp = new MumatecTaskManager();
    console.log('🚀 Mumatec Tasking initialized successfully!');
  }
};

async function initAfterAuth() {
  if (window.shellReady) {
    try {
      await window.shellReady;
    } catch (error) {
      console.error('App shell failed to load', error);
    }
  }

  if (window.currentUser) {
    window.initTodoApp();
  } else {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        window.currentUser = user;
        window.initTodoApp();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initAfterAuth);
