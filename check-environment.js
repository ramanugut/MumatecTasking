(function(){
  if (location.protocol === 'file:') {
    document.open();
    document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Static Server Required</title><link rel="stylesheet" href="styles.css"></head><body><div style="padding:2rem;font-family:sans-serif;"><h2>Static Server Required</h2><p>Please run a local static server as described in README.md. Opening this file directly will not work.</p></div></body></html>`);
    document.close();
  }
})();
