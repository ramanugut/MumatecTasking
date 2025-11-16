(function(){

  function updateThemeIcon(){
    const btn = document.getElementById('themeToggle');
    if(btn){
      const docIsDark = document.documentElement.classList.contains('dark-mode');
      const bodyIsDark = document.body?.classList?.contains('dark-mode');
      const isDark = docIsDark || bodyIsDark;
      btn.innerHTML = `<span class="material-icons">${isDark ? 'light_mode' : 'dark_mode'}</span>`;
    }
  }

  function applySavedDesignSystem(){
    const design = localStorage.getItem('designSystem') || 'apple';
    document.documentElement.classList.remove('apple-theme','material-theme','samsung-theme');
    document.documentElement.classList.add(`${design}-theme`);
    const select = document.getElementById('designSelect');
    if(select){
      select.value = design;
    }
  }

  let pendingThemeApplication = false;

  window.applySavedTheme = function(){
    const shouldUseDark = localStorage.getItem('mumatecTheme') === 'dark';
    document.documentElement.classList.toggle('dark-mode', shouldUseDark);

    const applyToBodyAndIcon = function(){
      const body = document.body;
      if(!body){
        return;
      }
      body.classList.toggle('dark-mode', shouldUseDark);
      updateThemeIcon();
    };

    if(document.body){
      applyToBodyAndIcon();
    } else if(!pendingThemeApplication){
      pendingThemeApplication = true;
      document.addEventListener('DOMContentLoaded', function handleThemeReady(){
        pendingThemeApplication = false;
        applyToBodyAndIcon();
      }, { once: true });
    }
  };

  window.applySavedDesignSystem = applySavedDesignSystem;

  window.toggleThemePreference = function(){
    document.documentElement.classList.toggle('dark-mode');
    const body = document.body;
    let isDark;

    if(body){
      isDark = body.classList.toggle('dark-mode');
    } else {
      isDark = document.documentElement.classList.contains('dark-mode');
      document.addEventListener('DOMContentLoaded', function syncBodyTheme(){
        const readyBody = document.body;
        if(readyBody){
          readyBody.classList.toggle('dark-mode', isDark);
          updateThemeIcon();
        }
      }, { once: true });
    }

    localStorage.setItem('mumatecTheme', isDark ? 'dark' : 'light');
    updateThemeIcon();
  };

  window.changeDesignSystem = function(design){
    localStorage.setItem('designSystem', design);
    applySavedDesignSystem();
  };

})();
