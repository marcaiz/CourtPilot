'use strict';
const sourceStatus = document.querySelector('#csv-status');
let nextRefreshAt = null;
let countdownAnchor = null;
let timerFlashTimeout = null;
let syncMessage = 'Connessione al server…';
function updateCountdown() {
  const timer = document.querySelector('#csv-timer');
  const bar = document.querySelector('#csv-progress-bar');
  // Usa l'orologio del server e il tempo monotono: il fuso e l'ora del telefono
  // non possono spostare il conto alla rovescia rispetto al PC.
  const seconds = countdownAnchor ? Math.max(0,
    (countdownAnchor.remainingMs - (performance.now() - countdownAnchor.receivedAt)) / 1000) : null;
  // Manteniamo lo span usato dal design per l'unita di misura.
  if (timer) {
    const value = seconds === null ? '—' : String(Math.ceil(seconds / 60));
    const unit = document.createElement('span');
    unit.textContent = seconds === null ? '' : ' min';
    timer.replaceChildren(document.createTextNode(value), unit);
    // Riusa il lampeggio originale, ad ogni secondo del conto alla rovescia.
    clearTimeout(timerFlashTimeout);
    if (seconds !== null && seconds > 0) {
      timer.classList.add('flash');
      timerFlashTimeout = setTimeout(() => timer.classList.remove('flash'), 200);
    } else {
      timer.classList.remove('flash');
    }
  }
  if (bar) bar.style.width = seconds === null ? '0%' : `${Math.min(100, seconds / 1800 * 100)}%`;
  const caption = document.querySelector('.summary.update p');
  if (caption) caption.textContent = seconds === 0 ? 'In attesa del prossimo tentativo…' : syncMessage;
}
async function loadPlanning() {
  try {
    const response = await CourtPilotAPI.fetch('/api/bookings', { cache: 'no-store', timeoutMs: 90000 });
    const result = await response.json();
    nextRefreshAt = Date.parse(result.nextRunAt) || null;
    const serverNow = Date.parse(result.serverNow);
    countdownAnchor = nextRefreshAt && Number.isFinite(serverNow)
      ? { remainingMs: nextRefreshAt - serverNow, receivedAt: performance.now() } : null;
    syncMessage = result.syncing ? 'Sincronizzazione in corso…' :
      result.error ? 'Prossimo tentativo automatico · collegamento da verificare' :
      'Aggiornamento automatico ogni 30 minuti';
    updateCountdown();
    if (!response.ok) throw new Error(result.error || 'Prima sincronizzazione in corso.');
    if (result.source !== 'playtomic-json' || !Array.isArray(result.bookings)) throw new Error('Risposta server non valida.');
    const clean = result.bookings.map(booking => {
      if (typeof booking.court !== 'string' || typeof booking.canceled !== 'boolean' ||
          !Number.isFinite(Date.parse(booking.start)) || !Number.isFinite(Date.parse(booking.end)) ||
          Date.parse(booking.end) <= Date.parse(booking.start)) throw new Error('Prenotazione non valida.');
      return booking;
    });
    rows = clean;
    slots = windows(rows);
    document.querySelector('#detail').close();
    render();
    renderBookings();
    const updated = new Date(result.sourceUpdatedAt).toLocaleString('it-IT');
    sourceStatus.textContent = result.stale ? `${result.error} Ultimi dati validi: ${updated}.` : `Playtomic JSON aggiornato il ${updated}. Sincronizzazione ogni 30 minuti.`;
    document.querySelector('.preview-label').textContent = result.stale ? 'Dati non aggiornati' : 'Playtomic · JSON';
    document.querySelector('#bookings-view .board-toolbar p').textContent = 'Prenotazioni Playtomic · nessun dato personale dei giocatori';
    document.querySelector('footer span:last-child').textContent = `Ultimo aggiornamento: ${updated}`;
  } catch (error) {
    if (error instanceof TypeError || error.name === 'TimeoutError' || error.name === 'SyntaxError') {
      nextRefreshAt = null;
      countdownAnchor = null;
      syncMessage = 'Backend non raggiungibile o in riavvio. Nuovo tentativo automatico.';
    }
    updateCountdown();
    sourceStatus.textContent = `${error.message} Nessun nuovo dato applicato.`;
    document.querySelector('.preview-label').textContent = 'Playtomic · non sincronizzato';
  }
}
CourtPilotRefresh.start(loadPlanning);
setInterval(updateCountdown, 1000);


