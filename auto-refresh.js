'use strict';
// Il backend sincronizza Playtomic; il browser consulta soltanto la cache.
window.CourtPilotRefresh = {
  start(load) {
    let busy = false;
    async function update() {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try { await load(); } finally { busy = false; }
    }
    update();
    setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
  }
};
