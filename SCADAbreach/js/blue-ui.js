/* blue-ui.js
 * Minimal DOM binding + plant filter. Korzysta z istniejących kontenerów/ID i Twojego style.css.
 */

let lastLogsRender = 0;


(function(){
  if(!window.BlueData){ console.error('BlueUI requires BlueData'); return; }
  const BlueData = window.BlueData;
  const BlueUI = {}; window.BlueUI = BlueUI;

  // Kontenery oczekiwane w index.html:
  // - #bt-log-table tbody
  // - #bt-alert-cards
  // - #bt-chart-severity (canvas)
  // - #bt-chart-timeline (canvas)
  // - #bt-top-sources (div)
  let el = {
    logsTbody: null, alertsWrap: null,
    sevCanvas: null, timeCanvas: null, topSources: null,
    logsBox: null, plantFilter: null
  };

  // Stan filtra
  let currentPlant = localStorage.getItem('bt.currentPlant') || '';
  let currentIP = '';
let currentSeverity = '';



  BlueUI.init = function(){
    el.logsTbody  = document.querySelector('#bt-log-table tbody');
    el.alertsWrap = document.getElementById('bt-alert-cards');
    el.sevCanvas  = document.getElementById('bt-chart-severity');
    el.timeCanvas = document.getElementById('bt-chart-timeline');
    el.topSources = document.getElementById('bt-top-sources');
    el.logsBox    = document.querySelector('.bt-logs') || document.getElementById('bt-logs');


    // Toolbar z wyborem plantu (dodawany nad tabelą logów)
    try { insertPlantFilter(); } catch(e){ console.warn('Plant filter UI not inserted:', e); }

    // Pierwsze malowanie
    applyPlantFilter(currentPlant); // ustawia BlueData + render

    // Subskrypcje
    BlueData.on('log', renderLogs);
    BlueData.on('alert', renderAlerts);
    BlueData.on('update', ()=>{ renderAlerts(); renderDashboard(); });
    BlueData.on('tick', renderDashboard);
    // gdy doładują się plants z JSON, odśwież dropdown
BlueData.on('update', (p)=> {
  if (p && p.plants && el.plantFilter) {
    const cur = currentPlant;
    el.plantFilter.innerHTML = '<option value="">All plants</option>';
    BlueData.getPlants().forEach(pl => {
      const o = document.createElement('option');
      o.value = pl.id; 
      o.textContent = `${pl.id} — ${pl.name}`;
      el.plantFilter.appendChild(o);
    });
    el.plantFilter.value = cur || '';
  }
});

  };

function insertPlantFilter(){
  if (!el.logsBox) return;

  // toolbar nad oknem logów (poza scroll)
  const bar = document.createElement('div');
  bar.id = 'bt-toolbar';
  bar.style.display = 'flex';
  bar.style.gap = '10px';
  bar.style.alignItems = 'center';
  bar.style.margin = '0 0 8px 0';

  const h = document.createElement('div');
  h.textContent = 'Event Logs';
  h.style.fontWeight = '700';
  h.style.marginRight = '8px';

  const label = document.createElement('label');
  label.textContent = 'Plant:';
  label.style.opacity = '0.85';

  const sel = document.createElement('select');
  sel.id = 'bt-plant-filter';
  sel.style.padding = '6px 8px';
  sel.style.background = 'transparent';
  sel.style.border = '1px solid var(--border)';
  sel.style.borderRadius = '8px';
  sel.style.color = 'var(--text)';

  const optAll = document.createElement('option');
  optAll.value = ''; optAll.textContent = 'All plants';
  sel.appendChild(optAll);
  BlueData.getPlants().forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = `${p.id} — ${p.name}`;
    sel.appendChild(o);
  });
  sel.value = currentPlant;
  sel.addEventListener('change', () => {
    currentPlant = sel.value || '';
    localStorage.setItem('bt.currentPlant', currentPlant);
    applyPlantFilter(currentPlant);
  });

const pause = document.createElement('button');
pause.textContent = 'Pause';
pause.disabled = true;   // bo logi są zatrzymane na starcie

const resume = document.createElement('button');
resume.textContent = 'Resume';
resume.disabled = false; // tylko Resume dostępne na początku

  pause.addEventListener('click', () => {
    BlueData.stop();
    pause.disabled = true; resume.disabled = false;
  });
  resume.addEventListener('click', () => {
    BlueData.start();
    pause.disabled = false; resume.disabled = true;
  });

  bar.appendChild(h);
  bar.appendChild(label);
  bar.appendChild(sel);
  bar.appendChild(pause);
  bar.appendChild(resume);

  // wstaw bar jako PIERWSZE dziecko panelu .bt-logs
  el.logsBox.insertBefore(bar, el.logsBox.firstChild);

  el.plantFilter = sel;

  // Druga linia toolbaru (filtry wyszukiwania)
  const filtersRow = document.createElement('div');
  filtersRow.style.display = 'flex';
  filtersRow.style.gap = '10px';
  filtersRow.style.alignItems = 'center';
  filtersRow.style.margin = '6px 0 10px 0';

  // Input do filtrowania po IP
  const ipInput = document.createElement('input');
  ipInput.type = 'text';
  ipInput.placeholder = 'Search IP...';
  ipInput.style.padding = '6px 8px';
  ipInput.style.border = '1px solid var(--border)';
  ipInput.style.borderRadius = '8px';
  ipInput.style.background = 'transparent';
  ipInput.style.color = 'var(--text)';
  ipInput.addEventListener('input', () => {
    currentIP = ipInput.value.trim();
    renderLogs();
  });

  // Select do filtrowania po severity
  const sevSel = document.createElement('select');
  sevSel.id = 'bt-severity-filter';
  sevSel.style.padding = '6px 8px';
  sevSel.style.background = 'transparent';
  sevSel.style.border = '1px solid var(--border)';
  sevSel.style.borderRadius = '8px';
  sevSel.style.color = 'var(--text)';
  ['','info','low','medium','high','critical'].forEach(v=>{
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v ? v[0].toUpperCase()+v.slice(1) : 'All severities';
    sevSel.appendChild(o);
  });
  sevSel.addEventListener('change', ()=>{
    currentSeverity = sevSel.value;
    renderLogs();
  });

  filtersRow.appendChild(ipInput);
  filtersRow.appendChild(sevSel);

  // wstaw drugą linię pod pierwszą
  el.logsBox.insertBefore(filtersRow, bar.nextSibling);
}

  function applyPlantFilter(plantId){
    BlueData.setSiteFilter(plantId || null); // ogranicza generowanie zdarzeń
renderLogs();
    renderAlerts();
    renderDashboard();
  }

  // --- Render: Logs table (z filtrem plant_id) ---
  function renderLogs(){
    if(!el.logsTbody) return;
const now = Date.now();
if (now - lastLogsRender < 250) return; // max ~4x/s
lastLogsRender = now;
    
let logs = BlueData.getLogs({limit: 500, plant_id: currentPlant || null});

// filtruj po IP
if (currentIP) {
  const ipLower = currentIP.toLowerCase();
  logs = logs.filter(l => l.source_ip.toLowerCase().includes(ipLower));
}

// filtruj po severity
if (currentSeverity) {
  logs = logs.filter(l => l.severity === currentSeverity);
}

const rows = logs.slice(-200).map(l => {

      const sevText = l.severity.toUpperCase();
      const sevClass = sevClassFor(l.severity);
      return `<tr>
        <td>${escapeHtml(new Date(l.ts).toLocaleTimeString())}</td>
        <td>${escapeHtml(l.source_ip)}</td>
        <td>${escapeHtml(l.event_type)} — ${escapeHtml(l.message)}</td>
        <td><span class="sev ${sevClass}">${sevText}</span></td>
      </tr>`;
    }).join('');
    el.logsTbody.innerHTML = rows;
    const container = el.logsTbody.closest('.bt-logs');
    if(container) container.scrollTop = container.scrollHeight;
  }

function renderAlerts(){
  if(!el.alertsWrap) return;

  // 1) Spróbuj normalnie przez API
  let alerts = [];
  try {
    alerts = BlueData.getAlerts
      ? BlueData.getAlerts({ limit: 50, plant_id: currentPlant || null })
      : (window.BlueData.alerts || []);
  } catch(e) {
    alerts = (window.BlueData.alerts || []);
  }

  // 2) Fallback: jeżeli było pusto, a surowo coś jest – filtruj lokalnie
  if (!alerts.length && Array.isArray(window.BlueData?.alerts) && window.BlueData.alerts.length){
    alerts = window.BlueData.alerts
      .filter(a => !currentPlant || a.plant_id === currentPlant)
      .slice(0, 50)
      .sort((a,b)=> b.updated_at - a.updated_at);
  }

  // 3) Wytnij stare demo-YARA, ale NIE dotykaj naszych [RANSOM]...
  alerts = alerts.filter(a => {
    const t = (a.title||'').toLowerCase();
    const s = (a.summary||'').toLowerCase();
    if (t === 'malware signature detected') return false;
    if (s.startsWith('yara match')) return false;
    return true;
  });

  // 4) Render / placeholder
  if (!alerts.length){
    el.alertsWrap.innerHTML =
      `<div class="alert-card empty"><h3>No active alerts</h3><p>This plant has no active alerts.</p></div>`;
    return;
  }

  el.alertsWrap.innerHTML = alerts.map(a => {
    const sevText = (a.severity||'').toUpperCase();
    const sevClass = sevClassFor(a.severity||'info');
    const status = a.status ? a.status[0].toUpperCase()+a.status.slice(1) : 'New';
return `<div class="alert-card" data-id="${a.id}" data-plant="${a.plant_id}">
  <div class="sev ${sevClass}">${sevText}</div>
  <h3>${escapeHtml(a.title||'Alert')}</h3>
  <p>${escapeHtml(a.summary||'')}</p>
  <p>Plant: <button class="as-plant-link" title="Filter by plant">${escapeHtml(a.plant_name||a.plant_id)}</button>
     • Status: <strong>${escapeHtml(status)}</strong>${a.assigned_to?` • Assigned: <strong>${escapeHtml(a.assigned_to)}</strong>`:''}</p>
</div>`;

  }).join('');

  // Delegacja klików tak jak było
  el.alertsWrap.onclick = (e)=>{
    const card = e.target.closest('.alert-card');
    if (!card) return;

    if (e.target.classList.contains('as-plant-link')) {
      const pid = card.getAttribute('data-plant');
      if (!pid) return;

      // 1) nadal możesz przefiltrować logi po tym plant_id (opcjonalne)
      currentPlant = pid;
      localStorage.setItem('bt.currentPlant', currentPlant);
      if (el.plantFilter) el.plantFilter.value = pid;
      applyPlantFilter(currentPlant);

      // 2) przełącz główną zakładkę na "Power Plant"
      const tabPower = document.getElementById('tab-power');
      if (tabPower) {
        tabPower.click();
      }

      // 3) poproś PowerUI o fokus na tej elektrowni
      if (window.PowerUI && typeof window.PowerUI.focusPlant === 'function') {
        window.PowerUI.focusPlant(pid);
      }
    }
  };

}

  // --- Dashboard (agregaty liczone globalnie, ale pokazujemy z aktywnego widoku) ---
  function renderDashboard(){
    // policz rozkład severity tylko z aktualnie wyświetlanych logów
    const logs = BlueData.getLogs({limit: 1000, plant_id: currentPlant || null});
    const counts = {info:0,low:0,medium:0,high:0,critical:0};
    logs.forEach(l => counts[l.severity] = (counts[l.severity]||0)+1);
    drawSeverityChart(counts);

    // timeline (zostaw jak jest – opcjonalny)
    const stats = BlueData.getStats();
    drawTimeline(stats.timeline);

    drawTopSources();
  }

  function drawSeverityChart(counts){
    if(!el.sevCanvas) return;
    const c = el.sevCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    const keys = ['info','low','medium','high','critical'];
    const max = Math.max(1, ...keys.map(k=>counts[k]||0));
    const w = c.width, h = c.height;
    const barW = Math.floor(w / (keys.length*1.5));
    const gap = Math.floor(barW/2);
    let x = gap;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    keys.forEach(k => {
      const val = counts[k]||0;
      const bh = Math.floor((val/max) * (h-30));
      ctx.fillRect(x, h-20-bh, barW, bh);
      ctx.fillText(k, x, h-16);
      x += barW + gap;
    });
  }

  function drawTimeline(timeline){
    if(!el.timeCanvas || !timeline || !timeline.length) return;
    const c = el.timeCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    const w = c.width, h = c.height;
    const max = Math.max(1, ...timeline.map(x=>x.count));
    const step = Math.max(1, Math.floor(w / Math.max(2,timeline.length)));
    ctx.beginPath();
    timeline.forEach((pt,i) => {
      const x = i*step;
      const y = h - Math.floor((pt.count/max) * (h-10)) - 5;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  function drawTopSources(){
    if(!el.topSources) return;
    const last = BlueData.getLogs({limit: 500, plant_id: currentPlant || null});
    const counts = new Map();
    for(const l of last){ counts.set(l.source_ip, (counts.get(l.source_ip)||0)+1); }
    const top = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
    el.topSources.innerHTML = '<h3>Top sources</h3>' + top.map(([ip,c])=>`<div>${escapeHtml(ip)} — ${c}</div>`).join('');
  }

  // helpers
  function sevClassFor(sev){
    if(sev==='critical' || sev==='high') return 'sev-high';
    if(sev==='medium') return 'sev-med';
    return 'sev-low';
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

BlueUI.start = function(){
  BlueUI.init();
  BlueData.setRate(30); 
  BlueData.stop();
};
BlueUI.focusPlant = function(plantId){
  if (!plantId) return;
  currentPlant = plantId;
  localStorage.setItem('bt.currentPlant', currentPlant);

  // ustaw dropdown jeśli już istnieje
  if (el.plantFilter) {
    el.plantFilter.value = currentPlant;
  }

  // od razu prze-filtruj dane
  applyPlantFilter(currentPlant);
};

 try { renderAlerts(); renderDashboard(); } catch(e){}
})();
