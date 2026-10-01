'use strict';
(() => {
  const list = document.querySelector('#notification-list');
  const upcoming = document.querySelector('#notification-upcoming');
  const status = document.querySelector('#notification-status');
  const shift = document.querySelector('#shift-toggle');
  const pushButton = document.querySelector('#enable-push');
  let deviceId = localStorage.getItem('courtpilot-device');
  let current = null;
  let filter = 'pending';
  const format = value => new Date(value).toLocaleString('it-IT', {
    timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  async function api(path = '', body) {
    const response = await CourtPilotAPI.fetch('/api/notifications' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-CourtPilot-Device': deviceId || '' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!response.ok) throw new Error(response.status === 404
      ? 'Riavvia CourtPilot dal collegamento CMD per attivare il servizio notifiche.'
      : 'Servizio notifiche non disponibile. Riprova.');
    return response.json();
  }
  async function registerDevice() {
    if (!deviceId) {
      deviceId = (await api('/device', {})).id;
      localStorage.setItem('courtpilot-device', deviceId);
    }
  }
  function row(item, scheduled = false) {
    const article = document.createElement('article');
    article.className = 'reminder-row' + (item.doneAt ? ' completed' : '');
    const symbol = document.createElement('span');
    symbol.className = 'reminder-symbol';
    symbol.textContent = item.system === 'heating' ? '♨' : item.kind === 'on' ? '☼' : '☾';
    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${item.court} · ${item.kind === 'on' ? (item.system === 'heating' ? 'Accensione riscaldamento' : 'Accensione luci') : (item.system === 'heating' ? 'Spegnimento riscaldamento' : 'Spegnimento luci')}`;
    const description = document.createElement('p');
    description.textContent = `Avviso ${format(item.dueAt)} · ${item.kind === 'on' ? 'Accendi' : 'Spegni'} alle ${format(item.actionAt).slice(-5)}`;
    const detail = document.createElement('small');
    detail.textContent = item.withdrawn ? 'Superato da una modifica del planning' :
      item.doneAt ? `Fatto il ${format(item.doneAt)}` : scheduled ? 'Programmato' :
      item.pushSent ? 'Inviato al servizio push' : 'Salvato nello storico';
    content.append(title, description, detail);
    article.append(symbol, content);
    if (!scheduled && !item.withdrawn) {
      const label = document.createElement('label');
      label.className = 'done-control';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(item.doneAt);
      checkbox.setAttribute('aria-label', `Fatto: ${title.textContent}, ${format(item.dueAt)}`);
      checkbox.onchange = async () => {
        checkbox.disabled = true;
        try { await registerDevice(); await api('/done', { id: item.id, done: checkbox.checked }); await refresh(); }
        catch (error) { checkbox.checked = !checkbox.checked; status.textContent = error.message; }
        finally { checkbox.disabled = false; }
      };
      label.append(checkbox, document.createTextNode('Fatto'));
      article.append(label);
    }
    return article;
  }
  function render() {
    if (!current) return;
    window.updatePlanningTitle(current.items.filter(item => !item.doneAt && !item.withdrawn).length);
    const timing = current.notificationRules || { before: 10, after: 5 };
    document.querySelector('#notification-timing').textContent = `Avviso accensione ${timing.before} min prima dell’inizio · avviso spegnimento ${timing.after} min prima della fine. Il turno termina automaticamente dopo 8 ore.`;
    const heatTiming = current.heatingNotificationRules || { before: 10, after: 5 };
    document.querySelector('#notification-timing').textContent += current.heatingEnabled ? ` Riscaldamento: ${heatTiming.before} min prima di inizio e ${heatTiming.after} min prima della fine.` : ' Promemoria riscaldamento disattivati.';
    const items = current.items.filter(item => filter === 'all' || (filter === 'done' ? item.doneAt : !item.doneAt && !item.withdrawn));
    list.replaceChildren(...items.map(item => row(item)));
    if (!items.length) list.textContent = filter === 'done' ? 'Nessun promemoria completato.' : 'Nessun promemoria in questa sezione.';
    upcoming.replaceChildren(...current.upcoming.slice(0, 12).map(item => row(item, true)));
    if (!current.upcoming.length) upcoming.textContent = 'Nessun promemoria programmato disponibile.';
    const active = current.shiftUntil > Date.now();
    shift.textContent = active ? 'Fine turno' : 'Inizio turno';
    document.querySelector('#shift-status').textContent = active ? `Turno attivo fino al ${format(current.shiftUntil)}` : 'Fuori turno · nessuna push';
    status.textContent = current.stale ? 'Prenotazioni non aggiornate: invio push sospeso.' : 'Promemoria aggiornati dal planning. Le spunte sono salvate sul server.';
  }
  async function refresh() {
    try { current = await api(); render(); }
    catch (error) { status.textContent = error.message; }
  }
  shift.onclick = async () => {
    shift.disabled = true;
    try { await registerDevice(); await api('/shift', { active: !(current?.shiftUntil > Date.now()) }); await refresh(); }
    catch (error) { status.textContent = error.message; }
    finally { shift.disabled = false; }
  };
  pushButton.onclick = async () => {
    pushButton.disabled = true;
    try {
      if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Usa HTTPS e un browser compatibile. Su iPhone apri CourtPilot dalla schermata Home.');
      }
      // La richiesta del permesso parte direttamente da un clic dell'utente.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permesso notifiche non concesso.');
      await registerDevice();
      current = await api();
      if (!current.publicKey) throw new Error('Servizio push da configurare.');
      const registration = await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;
      const encoded = current.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await api('/subscribe', { subscription: subscription.toJSON() });
      pushButton.textContent = 'Push abilitate';
      status.textContent = 'Dispositivo collegato. Avvia il turno per ricevere gli avvisi.';
    } catch (error) { status.textContent = error.message; }
    finally { pushButton.disabled = false; }
  };
  document.querySelectorAll('[data-reminder-filter]').forEach(button => {
    button.onclick = () => {
      filter = button.dataset.reminderFilter;
      document.querySelectorAll('[data-reminder-filter]').forEach(other => other.classList.toggle('selected', other === button));
      render();
    };
  });
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
})();




