'use strict';
// URL pubblico del backend. Nessuna chiave segreta deve essere scritta qui.
window.CourtPilotAPI = (() => {
  const base = 'https://courtpilot-backend.onrender.com';
  let key = sessionStorage.getItem('courtpilot-access') || '';
  let unlock;
  const ready = key ? Promise.resolve() : new Promise(resolve => { unlock = resolve; });
  const panel = document.createElement('dialog');
  panel.className = 'access-dialog';
  panel.innerHTML = `<form><p class="eyebrow">COURTPILOT</p><h2>Accedi al tuo circolo.</h2>
    <p>Inserisci la chiave di accesso CourtPilot configurata su Render.</p>
    <label>Chiave di accesso<input type="password" required autocomplete="off" spellcheck="false"></label>
    <button type="submit" class="notification-primary">Accedi</button>
    <p class="access-status" role="status"></p></form>`;
  document.body.append(panel);
  panel.addEventListener('cancel', event => event.preventDefault());
  const form = panel.querySelector('form');
  const input = form.querySelector('input');
  const status = form.querySelector('.access-status');
  form.onsubmit = async event => {
    event.preventDefault();
    const candidate = input.value.trim();
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Connessione in corso. Il primo avvio di Render può richiedere un minuto…';
    try {
      const response = await fetch(base + '/api/rules', {
        headers: { 'X-CourtPilot-Access': candidate }, signal: AbortSignal.timeout(90000), cache: 'no-store'
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Chiave non valida.' : 'Backend non disponibile. Riprova.');
      key = candidate;
      sessionStorage.setItem('courtpilot-access', key);
      input.value = '';
      panel.close();
      if (unlock) { unlock(); unlock = null; }
      else location.reload();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'Avvio del server ancora in corso. Riprova.' : error.message;
    } finally { button.disabled = false; }
  };
  if (!key) panel.showModal();
  return {
    async fetch(path, options = {}) {
      await ready;
      const headers = new Headers(options.headers);
      headers.set('X-CourtPilot-Access', key);
      const response = await fetch(base + path, { ...options, headers });
      if (response.status === 401) {
        sessionStorage.removeItem('courtpilot-access');
        key = '';
        if (!panel.open) panel.showModal();
        throw new Error('Accedi nuovamente a CourtPilot.');
      }
      return response;
    }
  };
})();
