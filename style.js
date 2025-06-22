(function(){

  function updateThemeIcon(){
    const btn = document.getElementById('themeToggle');
    if(btn){
      const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
      btn.innerHTML = `<span class="material-icons">${isDark ? 'light_mode' : 'dark_mode'}</span>`;
    }
  }

  window.applySavedTheme = function(){
    if(localStorage.getItem('mumatecTheme') === 'dark'){
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    }
    updateThemeIcon();
  };

  window.toggleThemePreference = function(){
    document.documentElement.classList.toggle('dark-mode');
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('mumatecTheme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  };
})();
