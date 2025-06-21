(function(){

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
