
import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';


onAuthStateChanged(auth, (user) => {
  window.currentUser = user;
  if (user) {


    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});


window.logout = () => signOut(auth);
