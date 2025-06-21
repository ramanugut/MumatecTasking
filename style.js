(function(){
  window.loadPreferredStyle = function(){
    const pref = localStorage.getItem('mumatecStyle');
    const link = document.getElementById('styleLink');
    if(!link) return;
    link.setAttribute('href', pref === 'new' ? 'glossy.css' : 'styles.css');
    updateStyleToggle();
  };

  window.toggleStyleSheet = function(){
    const link = document.getElementById('styleLink');
    if(!link) return;
    const usingNew = link.getAttribute('href') === 'glossy.css';
    link.setAttribute('href', usingNew ? 'styles.css' : 'glossy.css');
    localStorage.setItem('mumatecStyle', usingNew ? 'old' : 'new');
    updateStyleToggle();
  };

  function updateStyleToggle(){
    const btn = document.getElementById('styleToggle');
    if(btn){
      const pref = localStorage.getItem('mumatecStyle') === 'new';
      btn.textContent = pref ? 'Classic Style' : 'Glossy Style';
    }
  }

  function updateThemeIcon(){
    const btn = document.getElementById('themeToggle');
    if(btn){
      btn.innerHTML = `<span class="material-icons">${document.body.classList.contains('dark-mode') ? 'light_mode' : 'dark_mode'}</span>`;
    }
  }

  window.applySavedTheme = function(){
    if(localStorage.getItem('mumatecTheme') === 'dark'){
      document.body.classList.add('dark-mode');
    }
    updateThemeIcon();
  };

  window.toggleThemePreference = function(){
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('mumatecTheme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  };
})();
