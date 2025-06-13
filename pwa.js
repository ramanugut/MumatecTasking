if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

let deferredPrompt;

function showInstallButton() {
  let btn = document.getElementById('installButton');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'installButton';
    btn.className = 'action-btn secondary';
    btn.textContent = 'Install';
    btn.style.display = 'none';
    document.body.appendChild(btn);
  }
  btn.style.display = 'block';
  btn.addEventListener('click', async () => {
    btn.style.display = 'none';
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }, { once: true });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installButton');
  if (btn) btn.style.display = 'none';
  deferredPrompt = null;
});
