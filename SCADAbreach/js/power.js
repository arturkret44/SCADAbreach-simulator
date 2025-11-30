// js/power.js — plants + telemetry + integracja z PlantState
(function(){
  const listEl = document.getElementById('pp-list');
  const searchEl = document.getElementById('pp-search');
  const detailsEl = document.getElementById('pp-details');

  const powerEl = document.getElementById('pp-power');
  const freqEl = document.getElementById('pp-freq');
  const voltageEl = document.getElementById('pp-voltage');
  const tempEl = document.getElementById('pp-temp');
  const statusEl = document.getElementById('pp-status');
  const alarmEl = document.getElementById('pp-alarm');
const telemetryHelpEl = document.getElementById('pp-telemetry-help');

  const shutdownBtn = document.getElementById('pp-shutdown');
  const fuelChk = document.getElementById('pp-fuel');
  const coolingChk = document.getElementById('pp-cooling');

  let plants = [];
  let currentPlant = null;

  // --- Public sentiment (per-plant) ---
  const moodById = new Map();  // plantId -> 0–100
  let lastMoodUpdateTs = Date.now();

  // elementy UI dla nastroju (ustawiane w showPlant)
  let moodValueEl = null;
  let moodDescEl = null;
  let moodBarInnerEl = null;

  function getPlantId(plant){
    return plant && (plant.id || plant.__plantId) || null;
  }

  function getMoodFor(plant){
    const id = getPlantId(plant);
    if (!id) return 100;
    if (!moodById.has(id)){
      // startowo: "zadowoleni" 90–100%
      moodById.set(id, 90 + Math.random()*10);
    }
    return moodById.get(id);
  }

  function setMoodFor(plant, v){
    const id = getPlantId(plant);
    if (!id) return;
    v = Math.max(0, Math.min(100, v));
    moodById.set(id, v);
  }
  function describeMood(v){
    if (v >= 85) return 'Calm – public trusts the grid.';
    if (v >= 65) return 'Concerned – following the news closely.';
    if (v >= 40) return 'Anxious – protests and pressure on operators.';
    if (v > 0)   return 'Severe unrest – rolling blackouts and panic.';
    return 'Blackouts and chaos – no public trust left.';
  }

  function moodColor(v){
    if (v >= 80) return '#45c46b';  // zielony
    if (v >= 60) return '#f3c565';  // żółtawy
    if (v >= 30) return '#f08a4b';  // pomarańcz
    return '#f36565';               // czerwony
  }

  function updateMoodUI(){
    if (!currentPlant) return;
    const v = getMoodFor(currentPlant);
    if (moodValueEl) moodValueEl.textContent = `${Math.round(v)}%`;
    if (moodDescEl)  moodDescEl.textContent  = describeMood(v);
    if (moodBarInnerEl){
      moodBarInnerEl.style.width = `${Math.round(v)}%`;
      moodBarInnerEl.style.backgroundColor = moodColor(v);
    }
  }


  // guard: if listEl/detailsEl missing, bail early (helps when HTML not yet present)
  if(!listEl || !detailsEl){
    console.warn('power.js: missing required DOM nodes (pp-list or pp-details)');
    return;
  }

  // --- helper: odczyt stanu globalnego dla planta ---
  function getPlantStatus(plant){
    if (!plant || !window.PlantState || typeof window.PlantState.getStatusForPlant !== 'function'){
      return 'normal';
    }
    return window.PlantState.getStatusForPlant(plant) || 'normal';
  }

  // --- Render plant list ---
  function renderList(filter=''){
    // remove is-active from any existing items
    listEl.querySelectorAll('li').forEach(x => x.classList.remove('is-active'));

    // clear
    listEl.innerHTML = '';

    const needle = (filter||'').toLowerCase();

    plants
      .filter(p => (p.country+' '+p.name).toLowerCase().includes(needle))
      .forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.country} – ${p.name}`;
        li.tabIndex = 0;
        // ułatwia późniejsze zaznaczenie z Blue Team
        li.dataset.plantId = p.id || p.__plantId || '';

        // click selects plant and marks active
        li.addEventListener('click', ()=> {
          // remove active from all then set this
          listEl.querySelectorAll('li').forEach(x => x.classList.remove('is-active'));
          li.classList.add('is-active');
          showPlant(p);
        });

        // keyboard: Enter selects
        li.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
        });

        listEl.appendChild(li);
      });
  }

  function showPlant(plant){
    if(!plant) return;
    currentPlant = plant;

    detailsEl.innerHTML = `
      <h2>${escapeHtml(plant.country)} – ${escapeHtml(plant.name)}</h2>
      <p>${escapeHtml(plant.description || plant.desc || '')}</p>
      <div class="pp-meta">
        <span class="badge">Capacity: ${plant.capacity_gw ? plant.capacity_gw + ' GW' : '—'}</span>
        <span class="badge">${(plant.types||[]).join(' • ')}</span>
      </div>

      <div class="pp-mood">
        <div class="pp-mood-label">Public sentiment</div>
        <div class="pp-mood-bar">
          <div class="pp-mood-bar-inner"></div>
        </div>
        <div class="pp-mood-text">
          <span class="pp-mood-value">--%</span>
          <span class="pp-mood-desc"></span>
        </div>
      </div>
    `;

    // zapamiętaj referencje do elementów nastroju
    moodValueEl = detailsEl.querySelector('.pp-mood-value');
    moodDescEl  = detailsEl.querySelector('.pp-mood-desc');
    moodBarInnerEl = detailsEl.querySelector('.pp-mood-bar-inner');

    // odśwież UI nastroju dla aktualnej elektrowni
    updateMoodUI();

    // za każdym razem seedujemy liczby pod tę elektrownię
    seedTelemetryFrom(plant);

    // i dostosowujemy sterowanie do stanu (normal/warn/critical/overload)
    updateControlsForPlant(plant);
    updateIndicators(); // żeby status/kolor od razu się zgadzał
  }

  function escapeHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  searchEl?.addEventListener('input', e => {
    renderList(e.target.value);
  });

  // --- Load plants.json ---
  fetch('data/plants.json')
    .then(r => {
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(json => {
      plants = Array.isArray(json) ? json : [];

      // poinformuj PlantState o wszystkich elektrowniach
      if (window.PlantState && typeof window.PlantState.registerPlants === 'function') {
        window.PlantState.registerPlants(plants);
      }

      renderList();

      // select first visible after render
      const firstLi = listEl.querySelector('li');
      if(firstLi){
        firstLi.classList.add('is-active');
        const firstPlant = plants[0];
        if(firstPlant) showPlant(firstPlant);
      }
    })
    .catch(err => {
      console.error('Could not load plants.json', err);
      detailsEl.innerHTML = `<p style="color:#f36565">Error loading plants list.</p>`;
    });

  // --- Telemetry (shared for now, seeded per plant) ---
  let power = 1200;
  let freq = 50.0;
  let voltage = 400;
  let temp = 320;
  let status = 'normal';

  function seedTelemetryFrom(plant){
    if(plant && typeof plant.capacity_gw === 'number'){
      // capacity_gw is GW -> convert to MW baseline
      power = Math.max(50, plant.capacity_gw * 1000 * (0.5 + Math.random()*0.4));
      freq = 49.95 + (Math.random()-0.5)*0.1;
      voltage = 380 + Math.round(Math.random()*40);
      temp = 280 + Math.random()*60;
      status = 'normal';
    }
  }

  // --- Sterowanie UI w zależności od stanu planta ---
  function updateControlsForPlant(plant){
    // jeśli nie ma PlantState – zachowaj się jak dotychczas (nic nie blokujemy specjalnie)
    const st = (window.PlantState && typeof window.PlantState.getStatusForPlant === 'function')
      ? window.PlantState.getStatusForPlant(plant)
      : 'normal';

    const lockedByAttack = (st === 'warn' || st === 'critical');  // przejęta przez ransomware
    const isOverload     = (st === 'overload');                    // nasz pomarańczowy challenge

    // --- EMERGENCY SHUTDOWN ---
    // aktywny tylko przy overload; przy ataku lub normal → disabled
    if (shutdownBtn){
      const shouldBeDisabled = lockedByAttack || !isOverload;
      shutdownBtn.disabled = shouldBeDisabled;

      shutdownBtn.classList.toggle('is-locked', lockedByAttack);
      shutdownBtn.classList.toggle('is-overload-ready', isOverload && !lockedByAttack);
    }

    // przełączniki paliwa/chłodzenia:
    if (fuelChk)    fuelChk.disabled = lockedByAttack;   // przy ataku blokujemy
    if (coolingChk) coolingChk.disabled = lockedByAttack;

    // --- Tekst alarmu ---
    if (!alarmEl) return;

    if (lockedByAttack){
      alarmEl.textContent = 'Controls locked — plant under attacker control';
      alarmEl.style.color = '#f36565';
    } else if (isOverload){
      alarmEl.textContent = 'Grid warning: overload risk — emergency shutdown available';
      alarmEl.style.color = '#f3c565';  // żółtawy
    } else {
      alarmEl.textContent = 'No alarms';
      alarmEl.style.color = '#9aa3b2';
    }
  }

  function updateIndicators(){
    if (powerEl)   powerEl.textContent   = `${Math.max(0,power).toFixed(0)} MW`;
    if (freqEl)    freqEl.textContent    = `${freq.toFixed(2)} Hz`;
    if (voltageEl) voltageEl.textContent = `${voltage.toFixed(0)} kV`;
    if (tempEl)    tempEl.textContent    = `${temp.toFixed(0)} °C`;

    if (statusEl){
      // Lokalny status z telemetrii…
      let uiStatus = status;
      // …ale nadpisujemy go globalnym stanem planta, jeśli jest
      if (currentPlant){
        const st = getPlantStatus(currentPlant);
        if (st === 'overload')      uiStatus = 'overload';
        else if (st === 'warn')     uiStatus = 'warning';
        else if (st === 'critical') uiStatus = 'critical';
      }

      let label = 'Normal';
      let className = 'status-normal';

      if (uiStatus === 'warning'){
        label = 'Warning';
        className = 'status-warning';
      } else if (uiStatus === 'critical'){
        label = 'Critical';
        className = 'status-critical';
      } else if (uiStatus === 'overload'){
        label = 'Overload';
        className = 'status-warning'; // używamy żółtego / pomarańczowego
      }

      statusEl.textContent = label;
      statusEl.className = className;
    }
  }
  // --- Telemetry legend / operator help ---
  function renderTelemetryHelp(){
    if (!telemetryHelpEl) return;

    telemetryHelpEl.innerHTML = `
      <h4>Grid status legend</h4>

      <div class="legend-item">
        <span class="status-dot" style="background:#4caf50;"></span>
        <strong>Green – Normal</strong><br>
        Plant is healthy and fully operational.
      </div>

      <div class="legend-item">
        <span class="status-dot" style="background:#f3c565;"></span>
        <strong>Orange – Overload</strong><br>
        Grid instability detected — plant is at risk of takeover.<br>
        <em>Action: Use <b>Emergency Shutdown</b> in Power Plant to stabilize it.</em>
      </div>

      <div class="legend-item">
        <span class="status-dot" style="background:#d6d64b;"></span>
        <strong>Yellow – Warning</strong><br>
        Suspicious activity detected, possible compromise.<br>
      </div>

      <div class="legend-item">
        <span class="status-dot" style="background:#f36565;"></span>
        <strong>Red – Critical</strong><br>
        Plant fully compromised – controls locked.<br>
        <em>Action: Focus on protecting other plants and the grid.</em>
      </div>

      <h4 style="margin-top:1.2em;">Operator tips</h4>
      <ul>
        <li>Only <strong>Orange / Overload</strong> plants can still be saved.</li>
        <li><strong>Warning</strong> gives you a short reaction window — move fast.</li>
        <li><strong>Critical</strong> plants are lost for now – expect ransomware spread.</li>
        <li>Keep as many plants <strong>Green</strong> as possible to stabilize the grid.</li>
      </ul>
    `;
  }

  function updateMoodModel(){
    if (!currentPlant) return;

    const now = Date.now();
    const dt = now - lastMoodUpdateTs;
    lastMoodUpdateTs = now;

    let mood = getMoodFor(currentPlant);
    const st = getPlantStatus(currentPlant); // 'normal' | 'warn' | 'critical' | 'overload'

    // ile % na ms
    const perMin = (x) => x / (60 * 1000);

    if (st === 'critical'){
      // 🔴 Critical: -5% na minutę, do 0
      mood -= perMin(5) * dt;
      if (mood < 0) mood = 0;

    } else if (st === 'overload'){
      // 🟠 Overload: opadamy szybko do ~50, potem wachlowanie 40–50
      if (mood > 50){
        mood -= perMin(20) * dt; // szybki spadek
        if (mood < 50) mood = 50;
      } else {
        mood += (Math.random()-0.5) * 1.2; // lekkie wahania
        if (mood < 40) mood = 40;
        if (mood > 50) mood = 50;
      }

    } else if (st === 'warn'){
      // 🟡 Warning: ludzie poddenerwowani, zakres 60–80
      const targetMin = 60, targetMax = 80;
      const mid = (targetMin + targetMax)/2;
      mood += (mid - mood) * perMin(6) * dt; // łagodne wychodzenie w stronę środka
      mood += (Math.random()-0.5) * 0.8;
      if (mood < targetMin) mood = targetMin;
      if (mood > targetMax) mood = targetMax;

    } else {
      // 🟢 Normal: 90–100, bardzo delikatne wahania
      const targetMin = 90, targetMax = 100;
      const mid = (targetMin + targetMax)/2;
      mood += (mid - mood) * perMin(8) * dt; // dolecimy do ~95
      mood += (Math.random()-0.5) * 0.6;
      if (mood < targetMin) mood = targetMin;
      if (mood > targetMax) mood = targetMax;
    }

    setMoodFor(currentPlant, mood);
    updateMoodUI();
  }


  function tick(){
    // Jeśli plant jest przejęty (czerwony, locked) – wszystko 0 i nie symulujemy dalej
    if (
      currentPlant &&
      window.PlantState &&
      typeof PlantState.isLocked === 'function' &&
      PlantState.isLocked(currentPlant)
    ){
      power   = 0;
      freq    = 0;
      voltage = 0;
      temp    = 100;      // może być też 0, jak wolisz wizualnie
      status  = 'critical';

      updateMoodModel();  // nastroje dalej lecą w dół
      updateIndicators();
      return;             // nie wykonuj dalszej fizyki
    }

    // --- normalna fizyka gdy plant nie jest przejęty ---
    power += (Math.random()-0.5) * Math.max(1, power * 0.005);
    freq  += (Math.random()-0.5) * 0.02;
    temp  += (Math.random()-0.5) * 0.5;

    if (fuelChk && !fuelChk.checked)    power -= 5;
    if (coolingChk && !coolingChk.checked) temp += 5;

    // lokalne alarmy z fizyki
    if (alarmEl){
      if (temp > 350) {
        status='critical';
        alarmEl.textContent='Core overheating!';
        alarmEl.style.color='#f36565';
      }
      else if (freq < 49.5 || freq > 50.5) {
        status='warning';
        alarmEl.textContent='Frequency unstable';
        alarmEl.style.color='#f3c565';
      }
      else {
        status='normal';
        // ALE: jeśli globalnie plant jest overload / locked, to nie nadpisujemy tego tutaj
        if (currentPlant){
          const st = getPlantStatus(currentPlant);
          if (st === 'overload'){
            alarmEl.textContent = 'Grid overload detected — perform Emergency Shutdown!';
            alarmEl.style.color = '#f3c565';
          } else if (window.PlantState && PlantState.isLocked && PlantState.isLocked(currentPlant)){
            alarmEl.textContent = 'Controls locked — plant under attacker control';
            alarmEl.style.color = '#f36565';
          } else {
            alarmEl.textContent='No alarms';
            alarmEl.style.color='#9aa3b2';
          }
        } else {
          alarmEl.textContent='No alarms';
          alarmEl.style.color='#9aa3b2';
        }
      }
    } else {
      // still update status variable
      if (temp > 350) { status='critical'; }
      else if (freq < 49.5 || freq > 50.5) { status='warning'; }
      else { status='normal'; }
    }

    // nastroje + liczby
    updateMoodModel();
    updateIndicators();
  }

  setInterval(tick, 2000);
  updateIndicators();
  renderTelemetryHelp();

  shutdownBtn?.addEventListener('click', ()=>{
    if (!currentPlant) return;

    // jeśli plant jest przejęty (warn/critical) — nie pozwalamy
    if (window.PlantState && typeof window.PlantState.isLocked === 'function'){
      if (PlantState.isLocked(currentPlant)){
        if (alarmEl){
          alarmEl.textContent = 'Cannot shutdown — plant under attacker control.';
          alarmEl.style.color = '#f36565';
        }
        return;
      }
    }

    // Emergency shutdown – zerujemy parametry
    power = 0; freq = 0; voltage = 0; temp = 100;
    status = 'critical';
    if(alarmEl){
      alarmEl.textContent='Emergency shutdown activated!';
      alarmEl.style.color='#f36565';
    }
    updateIndicators();

    // Po udanym shutdown: zgłoś do PlantState, że plant wrócił do "normal"
    if (window.PlantState && typeof window.PlantState.setPlantNormal === 'function'){
      PlantState.setPlantNormal(currentPlant);
    }

    // i odśwież sterowanie (zniknie flash, przywróci się normalny stan)
    updateControlsForPlant(currentPlant);
    updateIndicators();
  });

  // === Public helper: focus plant from other modules (Blue Team alerts, etc.) ===
  window.PowerUI = window.PowerUI || {};

  // plantId = np. "poland-vistara", "egypt-nilyth", itp.
  window.PowerUI.focusPlant = function(plantId){
    if (!plantId || !plants || !plants.length) return;

    // spróbuj znaleźć po id albo po __plantId (ustawionym w PlantState.registerPlants)
    const pl = plants.find(p => p.id === plantId || p.__plantId === plantId);
    if (!pl) return;

    // upewnij się, że lista jest wyrenderowana (zachowujemy aktualny filtr z searcha)
    renderList(searchEl ? (searchEl.value || '') : '');

    // zaznacz właściwy <li> na liście
    const li = Array.from(listEl.querySelectorAll('li')).find(
      el => el.dataset && (el.dataset.plantId === plantId)
    ) || Array.from(listEl.querySelectorAll('li')).find(el => {
      // fallback: dopasowanie po tekście, gdyby data-attribute nie istniał
      return el.textContent.includes(pl.name);
    });

    if (li){
      listEl.querySelectorAll('li').forEach(x => x.classList.remove('is-active'));
      li.classList.add('is-active');
    }

    // pokaż szczegóły tej elektrowni
    showPlant(pl);
  };


})();
