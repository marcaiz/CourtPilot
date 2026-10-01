'use strict';
// Il sottotitolo del Planning si modifica in index.html, elemento #subtitle.
const PLANNING_SUBTITLE = document.querySelector('#subtitle').textContent;
// MODIFICA QUI I TESTI DEL TITOLO PLANNING.
const PLANNING_TITLE_TEXT = {
    normal: 'Tutto sotto controllo',
    pending: 'VELOCE MERDA, DIO TI GUARDA '
};
let pendingReminderCount = 0;
function updatePlanningTitle(count = pendingReminderCount) {
    pendingReminderCount = count;
    const title = document.querySelector('#page-title');
    const planningVisible = !document.querySelector('#planning-view').hidden;
    title.classList.toggle('planning-alert', planningVisible && count > 0);
    if (!planningVisible) return;
    const dot = document.createElement('span');
    dot.textContent = '.';
    title.replaceChildren(document.createTextNode(count > 0 ? PLANNING_TITLE_TEXT.pending : PLANNING_TITLE_TEXT.normal), dot);
}
window.updatePlanningTitle = updatePlanningTitle;
let RULES = { lights: { before: 5, after: 5 }, heating: { enabled: false, before: 0, after: 0 }, notifications: { before: 10, after: 5 }, heatingNotifications: { before: 10, after: 5 } };
let CONFIG = RULES.lights;
let rows=[];
let sport='all';
const dateInput=document.querySelector('#date');
dateInput.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const clock=d=>d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function windows(data, timing = CONFIG){const groups=new Map();for(const r of data){if(r.canceled)continue;const name=r.court.trim();if(!groups.has(name))groups.set(name,[]);groups.get(name).push({court:name,start:new Date(new Date(r.start).getTime()-timing.before*60000),end:new Date(new Date(r.end).getTime()+timing.after*60000)});}const out=[];for(const list of groups.values()){list.sort((a,b)=>a.start-b.start);let prev=null;for(const slot of list){if(prev&&slot.start<=prev.end){prev.end=new Date(Math.max(prev.end,slot.end));}else{prev={...slot};out.push(prev);}}}return out;}
let slots=windows(rows);
function setView(view){for(const v of ['planning','bookings','rules','notifications'])document.querySelector('#'+v+'-view').hidden=v!==view;document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelector('#breadcrumb').textContent={planning:'Planning',bookings:'Prenotazioni',rules:'Regole',notifications:'Notifiche'}[view];document.querySelector('#page-title').innerHTML={planning:'Tutto sotto controllo<span>.</span>',bookings:'Ogni partita, al suo posto<span>.</span>',rules:'Ogni campo, i suoi tempi<span>.</span>',notifications:'Ti avvisiamo noi<span>.</span>'}[view];document.querySelector('#subtitle').textContent={planning:PLANNING_SUBTITLE,bookings:'Le prenotazioni sincronizzate da Playtomic.',rules:'Imposta quando accendere e spegnere luci e riscaldamento.',notifications:'Promemoria luci, storico e attivita completate.'}[view];history.replaceState(null,'','#'+view);updatePlanningTitle();}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));

document.querySelectorAll('[data-sport]').forEach(b=>b.onclick=()=>{sport=b.dataset.sport;document.querySelectorAll('[data-sport]').forEach(x=>x.classList.toggle('selected',x===b));render();});
dateInput.onchange=render;
function showDetail(slot){document.querySelector('#detail-title').textContent=slot.court;document.querySelector('#detail-content').innerHTML=`<p>${slot.start.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'})}</p><div class="detail-times"><div><span>ACCENDI</span><strong>${clock(slot.start)}</strong></div><div><span>SPEGNI${slot.end.toDateString()!==slot.start.toDateString()?' · giorno dopo':''}</span><strong>${clock(slot.end)}</strong></div></div><p>Include ${CONFIG.before} minuti prima e ${CONFIG.after} minuti dopo. Le partite consecutive condividono una sola fascia luce.</p>`;document.querySelector('#detail').showModal();}
document.querySelector('#close-detail').onclick=()=>document.querySelector('#detail').close();
document.querySelector('#detail').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
// Ogni segmento usa la stessa scala temporale delle fasce luce.
function appendTimelineSegment(track, start, end, position, className, label) {
    const width = position(end) - position(start);
    if (width <= 0) return;
    const segment = document.createElement('span');
    segment.className = className;
    segment.style.left = position(start) + '%';
    segment.style.width = width + '%';
    segment.title = `${label}: ${clock(start)} - ${clock(end)}`;
    segment.setAttribute('role', 'img');
    segment.setAttribute('aria-label', segment.title);
    track.append(segment);
}
function render() {
    if (!dateInput.value) return;
    slots = windows(rows);
    const heating = RULES.heating.enabled ? windows(rows, RULES.heating) : [];
    const start = new Date(dateInput.value + 'T00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const overlaps = slot => slot.start < end && slot.end > start;
    const valid = rows.filter(row => !row.canceled && new Date(row.start) < end && new Date(row.end) > start);
    const daySlots = slots.filter(overlaps);
    const dayHeating = heating.filter(overlaps);
    const hours = ranges => ranges.reduce((sum, slot) => sum + (Math.min(end, slot.end) - Math.max(start, slot.start)) / 3600000, 0);
    const total = ranges => hours(ranges).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '<small> h</small>';
    document.querySelector('#booking-count').textContent = valid.length;
    document.querySelector('#canceled-count').textContent = rows.filter(row => row.canceled && new Date(row.start) < end && new Date(row.end) > start).length;
    document.querySelector('#light-hours').innerHTML = total(daySlots);
    document.querySelector('#warmup-total').innerHTML = RULES.heating.enabled ? total(dayHeating) : '—';
    document.querySelector('.warmup-total p').textContent = RULES.heating.enabled ? 'Totale delle fasce, su tutti i campi' : 'Disattivato nelle Regole';

    const lightNumbers = document.querySelectorAll('.summary.dark:not(.warmup) .rule-pair strong');
    const heatNumbers = document.querySelectorAll('.summary.dark.warmup .rule-pair strong');
    [CONFIG.before, CONFIG.after].forEach((value, index) => lightNumbers[index].innerHTML = `${index ? '+' : '−'}${value}<span> min</span>`);
    [RULES.heating.before, RULES.heating.after].forEach((value, index) => heatNumbers[index].innerHTML = `${RULES.heating.enabled ? (index ? '+' : '−') + value : '—'}<span> min</span>`);
    document.querySelector('.summary.warmup .summary-foot').textContent = RULES.heating.enabled ? 'Le fasce consecutive restano unite.' : 'Attivalo dalla pagina Regole.';
    document.querySelector('.board-footer span:not(#heating-rule-summary)').textContent = `☼ Accendi ${CONFIG.before} min prima · Spegni ${CONFIG.after} min dopo`;
    document.querySelector('#heating-rule-summary').textContent = RULES.heating.enabled
        ? `♨ Accendi ${RULES.heating.before} min prima · Spegni ${RULES.heating.after} min dopo`
        : '♨ Riscaldamento disattivato';
    document.querySelector('.board-heading p').textContent = 'Verde: luci · rosso: anticipo luci · grigio-verde: riscaldamento · azzurro: partite.';
    const legend = document.querySelector('.legend');
    legend.innerHTML = `<i style="background:#c8f3c2"></i>Luci accese <i style="background:#6a7b70"></i>Riscaldamento${RULES.heating.enabled ? '' : ' (disattivato)'} <i style="background:#ff6b6b"></i>Warmup luci · ${CONFIG.before} min <i style="background:#8ec7ff"></i>Partita`;

    const courts = [...new Set([...valid.map(row => row.court.trim()), ...daySlots.map(slot => slot.court), ...dayHeating.map(slot => slot.court)])]
        .filter(court => sport === 'all' || court.startsWith(sport)).sort();
    // Giorno completo: anticipi lunghi e fasce che attraversano mezzanotte non spariscono.
    const position = date => Math.max(0, Math.min(100, (date - start) / (end - start) * 100));
    const timeline = document.querySelector('#timeline');
    timeline.innerHTML = '<div class="time-head"><span>CAMPO</span><div class="time-axis"></div></div>';
    const axis = timeline.querySelector('.time-axis');
    axis.style.cssText = 'position:relative;height:16px;margin-inline:10px;';
    axis.innerHTML = Array.from({ length: 9 }, (_, index) => `<span style="position:absolute;left:${index * 12.5}%;transform:translateX(-50%)">${String(index * 3).padStart(2, '0')}:00</span>`).join('');
    for (const court of courts) {
        const row = document.createElement('div');
        row.className = 'court-row';
        row.innerHTML = `<div class="court-name">${escapeHtml(court)}<small>${valid.filter(game => game.court.trim() === court).length} prenotazioni</small></div><div class="track"></div>`;
        const track = row.querySelector('.track');
        for (const slot of daySlots.filter(slot => slot.court === court)) {
            const button = document.createElement('button');
            button.className = 'light-bar';
            button.style.left = position(slot.start) + '%';
            button.style.width = (position(slot.end) - position(slot.start)) + '%';
            button.title = `${court}: accendi ${clock(slot.start)}, spegni ${clock(slot.end)}`;
            button.setAttribute('aria-label', button.title);
            button.onclick = () => showDetail(slot);
            track.append(button);
            appendTimelineSegment(track, slot.start, new Date(+slot.start + CONFIG.before * 60000), position, 'warmup-block', 'Warmup luci');
        }
        // Una corsia interna sottile rende visibili anche anticipi diversi dalle luci.
        for (const slot of dayHeating.filter(slot => slot.court === court)) {
            appendTimelineSegment(track, slot.start, slot.end, position, 'heating-block', 'Riscaldamento');
        }
        for (const game of valid.filter(game => game.court.trim() === court)) {
            appendTimelineSegment(track, new Date(game.start), new Date(game.end), position, 'match-block', 'Partita');
        }
        timeline.append(row);
    }
    if (!courts.length) timeline.insertAdjacentHTML('beforeend', '<p class="empty">Nessuna prenotazione per questo giorno.</p>');
}

function renderBookings(){document.querySelector('#bookings').innerHTML=[...rows].sort((a,b)=>a.start.localeCompare(b.start)||a.court.localeCompare(b.court)).map(r=>`<tr class="${r.canceled?'canceled':''}"><td>${escapeHtml(r.court)}</td><td>${clock(new Date(r.start))}</td><td>${clock(new Date(r.end))}${r.end.slice(0,10)!==r.start.slice(0,10)?' (+1 g)':''}</td><td><span class="badge">${r.canceled?'Cancellata':'Valida'}</span></td></tr>`).join('');}renderBookings();render();const initial=location.hash.slice(1);if(['planning','bookings','rules','notifications'].includes(initial))setView(initial);








// Modifiche in anteprima immediate; il salvataggio sul server e esplicito.
(() => {
    const form = document.querySelector('#rules-form');
    const status = document.querySelector('#rules-status');
    let saved = structuredClone(RULES);
    let dirty = false;
    function fill() {
        for (const group of ['lights', 'heating', 'notifications', 'heatingNotifications']) {
            for (const key of ['before', 'after']) document.querySelector(`#${group}-${key}`).value = RULES[group][key];
        }
        document.querySelector('#heating-enabled').checked = RULES.heating.enabled;
    }
    function read() {
        const next = { heatingNotifications: {}, notifications: {}, lights: {}, heating: { enabled: document.querySelector('#heating-enabled').checked } };
        for (const group of ['lights', 'heating', 'notifications', 'heatingNotifications']) {
            for (const key of ['before', 'after']) {
                const input = document.querySelector(`#${group}-${key}`);
                const value = input.valueAsNumber;
                if (!Number.isInteger(value) || value < 0 || value > 240) return null;
                next[group][key] = value;
            }
        }
        return next;
    }
    function apply(value) { RULES = structuredClone({ ...value, heatingNotifications: value.heatingNotifications || { before: 10, after: 5 }, notifications: value.notifications || { before: 10, after: 5 } }); CONFIG = RULES.lights; render(); }
    form.addEventListener('input', () => {
        dirty = true;
        const value = read();
        if (!value) { status.textContent = 'Inserisci minuti interi da 0 a 240.'; return; }
        apply(value);
        status.textContent = 'Anteprima aggiornata. Salva per applicare le regole.';
    });
    form.onsubmit = async event => {
        event.preventDefault();
        const value = read();
        if (!value) return;
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            const response = await CourtPilotAPI.fetch('/api/rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
            if (!response.ok) throw new Error('Salvataggio non riuscito. Riavvia il CMD per caricare il nuovo servizio Regole.');
            saved = await response.json();
            apply(saved); dirty = false;
            status.textContent = 'Regole salvate. Planning e orari operativi aggiornati.';
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
    };
    document.querySelector('#rules-cancel').onclick = () => { dirty = false; apply(saved); fill(); status.textContent = 'Modifiche annullate.'; };
    async function load() {
        if (dirty) return;
        try {
            const response = await CourtPilotAPI.fetch('/api/rules', { cache: 'no-store' });
            if (!response.ok) throw new Error('Anteprima disponibile. Riavvia il CMD per abilitare il salvataggio delle regole.');
            const value = await response.json();
            if (dirty) return;
            saved = value; apply(value); fill(); status.textContent = 'Regole sincronizzate con il server.';
        } catch (error) { status.textContent = error.message; }
    }
    fill(); load();
    setInterval(load, 30000);
})();







