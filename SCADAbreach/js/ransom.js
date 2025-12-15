// js/ransom.js — prosta walidacja klucza + komendy terminalowe
(function(){
  const VALID_KEY = 'VIST-KEY-7731-ALPHA'; // DEV klucz na testy
function pushBlueAlert(a){
  const BD = window.BlueData;
  if(!BD) return;
  if (typeof BD.createAlert === 'function') { BD.createAlert(a); return; }
  const plants = (BD.getPlants ? BD.getPlants() : []);
  const pl = plants.find(p => p.id === a.plant_id);
  const alert = {
    id: Math.random().toString(36).slice(2),
    created_at: Date.now(),
    updated_at: Date.now(),
    severity: a.severity || 'critical',
    status: 'new',
    type: a.type || 'malware',
    plant_id: a.plant_id,
    plant_name: pl ? pl.name : a.plant_id,
    title: a.title || 'Alert',
    summary: a.summary || '',
    evidence_ids: []
  };
  (BD.alerts ||= []).unshift(alert);
  if (typeof BD.emit === 'function') { BD.emit('alert', alert); BD.emit('update'); }
}
// ---- BlueData log helper (event logs for Blue Team) ----
function logBlue(evt){
  try{
    const BD = window.BlueData;
    if (!BD || typeof BD.addLog !== 'function') return;
    BD.addLog(evt);
  }catch(e){ /* ignore */ }
}
// udostępnij globalnie, żeby drugi IIFE (timer) też mógł tego używać
window.logBlue = window.logBlue || logBlue;

// ---- realistic file "encryption" for plant dir ----
function randomDataBase64(len){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for(let i=0;i<len;i++){
    out += chars[Math.floor(Math.random()*chars.length)];
  }
  return out;
}
function revealExfilToPlayer(){
  window.__EXFIL_VISIBLE = true;
}

function encryptPlantFiles(plantId){
  try{
    if(!window.SimFS || typeof window.SimFS.resolvePath !== 'function') return;
    const basePath = `/home/user/.data/${plantId}`;
    const rootNode = window.SimFS.resolvePath(basePath);
    if(!rootNode) return;

    (function walk(node){
      if(!node) return;
      if(node.type === 'file'){
        // ignore already-locked files and ransom artifacts
        if(node.name.endsWith('.locked') || node.name === 'ransom.note' || node.name === '.deleted') return;

        const header = `*** ENCRYPTED by VIST RANSOMWARE ***\nPlant: ${plantId}\nFile: ${node.name}\nLockedAt: ${new Date().toISOString()}\n\n`;
        const blob = randomDataBase64(256);
        const encContent = header + blob + '\n';

        const parent = node.parent;
        const lockedName = node.name + '.locked';
        parent.children[lockedName] = {
          type: 'file',
          name: lockedName,
          parent: parent,
          content: encContent
        };
        // remove original
        delete parent.children[node.name];
        return;
      }
      if(node.type === 'dir'){
        // iterate a copy of keys because children may change
        const keys = Object.keys(node.children || {});
        for(const k of keys){
          const child = node.children[k];
          if(child) walk(child);
        }
      }

    })(rootNode);

    // update status and plant-specific ransom note
    try{ window.SimFS.writeFile(`${basePath}/status.txt`, 'ENCRYPTED by VIST — contact attacker for recovery'); }catch(e){}
    try{
      const note = `*** RANSOM NOTE ***\nYour systems at ${plantId} have been encrypted.\nTo recover your data follow instructions in the global ransom portal.\nTime: ${new Date().toISOString()}\n`;
      window.SimFS.writeFile(`${basePath}/ransom.note`, note);
    }catch(e){}
    try{ window.SimFS.writeFile(`${basePath}/.deleted`, `deleted at ${new Date().toISOString()}`); }catch(e){}

    // log to Blue Team (event logs)
    try{
      logBlue({
        plant_id: plantId,
        severity: 'critical',
        event_type: 'ransom.files_encrypted',
        component: 'SCADA',
        process: 'ransom-worker',
        message: `Files under ${plantId} have been encrypted (.locked suffix created)`,
      });
    }catch(e){}


    // emit alert if BlueData present
    try{
      if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
        window.BlueData.createAlert({
          plant_id: plantId,
          severity: 'critical',
          title: '[RANSOM] Files encrypted (plant-level)',
          summary: `Files under ${plantId} have been encrypted and show .locked suffix`,
          type: 'ransom'
        });
      }
    }catch(e){}
  }catch(err){
    console.error('encryptPlantFiles error', err);
  }
}
window.encryptPlantFiles = encryptPlantFiles;

// --- Map hook + pomocnik: plant_id -> country ---
function emitPlantStatus(country, status){
  try{
    window.App = window.App || {};
    App.bus = App.bus || new EventTarget();
    App.bus.dispatchEvent(new CustomEvent('plant:status', {
      detail: { country, status }
    }));
  }catch(e){}
}

function countryOf(plantId){
  try{
    const BD = window.BlueData;
    if (BD && typeof BD.getPlants === 'function'){
      const pl = BD.getPlants().find(p => p.id === plantId);
      // Spróbuj różnych pól; fallback na hardcodę dla Vistary
      return pl?.country || pl?.country_name || (pl?.name ? pl.name.split(' – ')[0] : null) || 
             (plantId === 'poland-vistara' ? 'Poland' : null);
    }
  }catch(e){}
  // Ostateczny fallback
  return (plantId === 'poland-vistara') ? 'Poland' : null;
}

// ---- helpers: hide ransom banner/timer + fullscreen takeover video ----
function hideRansomBannerAndTimer(){
  try{
window.__RANSOM_SUPPRESS_TIMER = true;
    window.__RANSOM_TIMER_STARTED = false;
    window.__RANSOM_END_TS = 0;
if (window.__RANSOM_TIMER_HANDLE) { clearInterval(window.__RANSOM_TIMER_HANDLE); window.__RANSOM_TIMER_HANDLE = null; }
    const b = document.getElementById('ransom-banner');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }catch(e){}
}
function ensureTakeoverStyles(){
  if (document.getElementById('attack-takeover-css')) return;
  const css = `
  .atk-takeover{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88)}
  .atk-takeover__box{position:relative;width:min(920px,94vw);border-radius:10px;overflow:hidden;box-shadow:0 20px 80px rgba(0,0,0,.7);background:#000}
  .atk-takeover__video{display:block;width:100%;height:auto}
  .atk-takeover__scan{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(255,255,255,.06), rgba(0,0,0,0) 40%, rgba(255,255,255,.06) 60%, rgba(0,0,0,0) 100%);
    animation: atkScan 3.2s linear infinite;mix-blend-mode:screen;opacity:.25}
  @keyframes atkScan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
  body.atk-lock{overflow:hidden;touch-action:none}
  `;
  const style = document.createElement('style');
  style.id = 'attack-takeover-css';
  style.textContent = css;
  document.head.appendChild(style);
}
// ---- Fullscreen MISSION FAILED overlay ----
function showMissionFailed(reason){
  try{
    if (window.__GAME_OVER_SHOWN) return;
    window.__GAME_OVER_SHOWN = true;

    // zatrzymaj ransom timer i schowaj banner, jeśli jeszcze jest
    try { if (typeof hideRansomBannerAndTimer === 'function') hideRansomBannerAndTimer(); } catch(e){}

    // prosty lock na scroll
    try { document.body.classList.add('atk-lock'); } catch(e){}

    if (document.getElementById('mission-failed-overlay')) return;

    const wrap = document.createElement('div');
    wrap.id = 'mission-failed-overlay';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '100001';
    wrap.style.background = 'rgba(0,0,0,0.9)';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    wrap.style.color = '#fff';

    const box = document.createElement('div');
    box.style.textAlign = 'center';
    box.style.maxWidth = '520px';
    box.style.width = '100%';
    box.style.padding = '24px 28px';
    box.style.borderRadius = '10px';
    box.style.background = '#111';
    box.style.boxShadow = '0 18px 60px rgba(0,0,0,.8)';
    box.style.border = '1px solid rgba(255,255,255,.12)';

    const title = document.createElement('div');
    title.textContent = 'MISSION FAILED';
    title.style.letterSpacing = '0.18em';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '12px';
    title.style.color = '#ff6b6b';

    const subtitle = document.createElement('div');
    subtitle.textContent = reason || 'The grid could not be stabilized in time.';
    subtitle.style.fontSize = '14px';
    subtitle.style.opacity = '0.9';
    subtitle.style.marginBottom = '18px';

    const hint = document.createElement('div');
    hint.textContent = 'Restart the simulation and try again.';
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.7';
    hint.style.marginBottom = '22px';

    const btn = document.createElement('button');
    btn.textContent = 'Restart simulation';
    btn.style.padding = '10px 22px';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '600';
    btn.style.borderRadius = '999px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.background = '#ff6b6b';
    btn.style.color = '#000';
    btn.addEventListener('click', function(){
      // twardy restart całej gry
      window.location.reload();
    });

    box.appendChild(title);
    box.appendChild(subtitle);
    box.appendChild(hint);
    box.appendChild(btn);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

  }catch(e){}
}

// udostępnij globalnie, gdyby inne moduły chciały wywołać
window.showMissionFailed = window.showMissionFailed || showMissionFailed;

// ---- Fullscreen MISSION COMPLETE overlay ----
function showMissionComplete(message){
  try{
    // jeśli już jakieś okno końca gry było pokazane (fail/win) – nic nie rób
    if (window.__GAME_OVER_SHOWN) return;
    window.__GAME_OVER_SHOWN = true;

    // zatrzymaj ransom timer i schowaj banner, jeśli jeszcze jest
    try { if (typeof hideRansomBannerAndTimer === 'function') hideRansomBannerAndTimer(); } catch(e){}

    // lock scrolla jak w mission failed
    try { document.body.classList.add('atk-lock'); } catch(e){}

    if (document.getElementById('mission-complete-overlay')) return;

    const wrap = document.createElement('div');
    wrap.id = 'mission-complete-overlay';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '100001';
    wrap.style.background = 'rgba(0,0,0,0.9)';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    wrap.style.color = '#fff';

    const box = document.createElement('div');
    box.style.textAlign = 'center';
    box.style.maxWidth = '520px';
    box.style.width = '100%';
    box.style.padding = '24px 28px';
    box.style.borderRadius = '10px';
    box.style.background = '#111';
    box.style.boxShadow = '0 18px 60px rgba(0,0,0,.8)';
    box.style.border = '1px solid rgba(255,255,255,.12)';

    const title = document.createElement('div');
    title.textContent = 'MISSION COMPLETE';
    title.style.letterSpacing = '0.18em';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '12px';
    title.style.color = '#45c46b'; // zielony sukces

    const subtitle = document.createElement('div');
    subtitle.textContent = message || 'You stabilized the grid and stopped the attack in time.';
    subtitle.style.fontSize = '14px';
    subtitle.style.opacity = '0.9';
    subtitle.style.marginBottom = '18px';

    const hint = document.createElement('div');
    hint.textContent = 'You can read the press coverage of your actions, or restart the simulation.';
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.7';
    hint.style.marginBottom = '22px';

    // --- wiersz przycisków ---
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.justifyContent = 'center';
    btnRow.style.gap = '10px';

    // 1) Restart simulation
    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart simulation';
    restartBtn.style.padding = '10px 22px';
    restartBtn.style.fontSize = '14px';
    restartBtn.style.fontWeight = '600';
    restartBtn.style.borderRadius = '999px';
    restartBtn.style.border = 'none';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.background = '#45c46b';
    restartBtn.style.color = '#000';
    restartBtn.addEventListener('click', function(){
      window.location.reload();
    });

    // 2) Read news article (gazetowy modal)
    const articleBtn = document.createElement('button');
    articleBtn.textContent = 'Read news article';
    articleBtn.style.padding = '10px 18px';
    articleBtn.style.fontSize = '14px';
    articleBtn.style.borderRadius = '999px';
    articleBtn.style.border = '1px solid #374151';
    articleBtn.style.cursor = 'pointer';
    articleBtn.style.background = '#1f2933';
    articleBtn.style.color = '#e5e7eb';
    articleBtn.addEventListener('click', () => {
      try {
        // zamknij overlay zwycięstwa
        const ovr = document.getElementById('mission-complete-overlay');
        if (ovr && ovr.parentNode) ovr.parentNode.removeChild(ovr);
        try { document.body.classList.remove('atk-lock'); } catch(e){}

        // przełącz na zakładkę NEWS (jeśli istnieje)
        const tabNews = document.getElementById('tab-news');
        if (tabNews) tabNews.click();

        // otwórz artykuł o bohaterze
        if (window.NewsViewer && typeof window.NewsViewer.open === 'function') {
          window.NewsViewer.open('Hero operator prevents nationwide blackout');
        }
      } catch(e){}
    });

    btnRow.appendChild(restartBtn);
    btnRow.appendChild(articleBtn);

    box.appendChild(title);
    box.appendChild(subtitle);
    box.appendChild(hint);
    box.appendChild(btnRow);
    wrap.appendChild(box);
    document.body.appendChild(wrap);

  }catch(e){}
}

// udostępnij globalnie, tak jak mission failed
window.showMissionComplete = window.showMissionComplete || showMissionComplete;


function showAttackerTakeoverVideo({ src, durationMs } = {}) {
  return new Promise(resolve => {
    ensureTakeoverStyles();
    document.body.classList.add('atk-lock');

    // kontener takeover (ten sam co wcześniej)
    const wrap = document.createElement('div');
    wrap.className = 'atk-takeover';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');

    const box = document.createElement('div');
    box.className = 'atk-takeover__box';

    // helper cleanup (używany w kilku miejscach)
    function cleanup() {
      try { document.body.classList.remove('atk-lock'); wrap.remove(); } catch(e) {}
      resolve();
    }

    // Jeśli mamy plik wideo — przygotuj element
    if (src) {
      const vid = document.createElement('video');
      vid.className = 'atk-takeover__video';
      vid.autoplay = false;        // nie polegamy na autoplay — startujemy po decyzji
      vid.muted = true;           // default muted (fallback)
      vid.playsInline = true;
      vid.controls = false;
      const s = document.createElement('source');
      s.src = src;
      s.type = 'video/mp4';
      vid.appendChild(s);

      // stwórz warstwę "scan" (efekt wizualny)
      const scan = document.createElement('div');
      scan.className = 'atk-takeover__scan';

      // overlay z komunikatem + przyciskiem
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-end';
      overlay.style.justifyContent = 'center';
      overlay.style.pointerEvents = 'none'; // elementy wewnątrz będą miały pointerEvents: auto
      overlay.style.padding = '24px';

      const card = document.createElement('div');
      card.style.pointerEvents = 'auto';
      card.style.background = 'rgba(0,0,0,0.7)';
      card.style.color = '#fff';
      card.style.padding = '16px 18px';
      card.style.borderRadius = '8px';
      card.style.textAlign = 'center';
      card.style.maxWidth = '680px';
      card.style.width = '100%';
      card.style.boxSizing = 'border-box';

      const heading = document.createElement('div');
      heading.style.fontWeight = '700';
      heading.style.marginBottom = '8px';
      heading.textContent = 'UNAUTHORIZED SIGNAL DETECTED';

      const para = document.createElement('div');
      para.style.marginBottom = '10px';
      para.style.fontSize = '14px';
      para.textContent = 'The Kernelians prepared this transmission for you alone. Play it with sound to hear every word — or stay blind while the world burns around you.';

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.justifyContent = 'center';
      btnRow.style.gap = '8px';

      const btnPlay = document.createElement('button');
      btnPlay.textContent = 'Play with sound';
      btnPlay.style.padding = '8px 12px';
      btnPlay.style.borderRadius = '6px';
      btnPlay.style.border = 'none';
      btnPlay.style.cursor = 'pointer';

      const btnPlayMuted = document.createElement('button');
      btnPlayMuted.textContent = 'Play muted';
      btnPlayMuted.style.padding = '8px 12px';
      btnPlayMuted.style.borderRadius = '6px';
      btnPlayMuted.style.border = 'none';
      btnPlayMuted.style.cursor = 'pointer';
      btnPlayMuted.style.opacity = '0.9';

      const btnClose = document.createElement('button');
      btnClose.textContent = 'Close';
      btnClose.style.marginLeft = '8px';
      btnClose.style.padding = '6px 10px';
      btnClose.style.borderRadius = '6px';
      btnClose.style.border = '1px solid rgba(255,255,255,0.12)';
      btnClose.style.background = 'transparent';
      btnClose.style.color = '#fff';
      btnClose.style.cursor = 'pointer';

      btnRow.appendChild(btnPlay);
      btnRow.appendChild(btnPlayMuted);
      btnRow.appendChild(btnClose);

      card.appendChild(heading);
      card.appendChild(para);
      card.appendChild(btnRow);
      overlay.appendChild(card);

      box.appendChild(vid);
      box.appendChild(scan);
      box.appendChild(overlay);
      wrap.appendChild(box);
      document.body.appendChild(wrap);

      // Play handlers -------------------------------------------------------
      function startWithSound(){
        // user interaction -> umożliwia odtwarzanie z audio
        try {
          vid.muted = false;
          const p = vid.play();
          if (p && typeof p.then === 'function') p.catch(()=>{}); // ignorujemy reject
        } catch(e){}
        // usuń overlay, ale zostaw video; modal zamykamy po zakończeniu
        overlay.remove();
      }

      function startMuted(){
        try {
          vid.muted = true;
          const p = vid.play();
          if (p && typeof p.then === 'function') p.catch(()=>{});
        } catch(e){}
        overlay.remove();
      }

      btnPlay.addEventListener('click', function onPlayClick(e){
        startWithSound();
      });
      btnPlayMuted.addEventListener('click', function onPlayMuted(e){
        startMuted();
      });
      btnClose.addEventListener('click', function onClose(){
        // traktujemy jak odtwórz muted (fajny fallback): uruchom muted i zamknij overlay
        startMuted();
      });

      // gdy wideo skończy — cleanup + resolve
      const timeoutHandle = null; //(typeof durationMs === 'number') ? setTimeout(() => {
        //try{ vid.pause(); }catch(e){}
        //cleanup();
      //}, durationMs + 300) : null;

      vid.addEventListener('ended', ()=> { if(timeoutHandle) clearTimeout(timeoutHandle); cleanup(); });
      vid.addEventListener('error', ()=> { if(timeoutHandle) clearTimeout(timeoutHandle); cleanup(); });

      // mały UX: automatycznie umieść fokus na przycisku 'Odtwórz z dźwiękiem'
      setTimeout(()=> { try { btnPlay.focus(); } catch(e){} }, 50);

    } else {
      // fallback: brak pliku wideo — pokazujemy planszę i resolve po czasie
      const msg = document.createElement('div');
      msg.style.color = '#fff';
      msg.style.font = '600 20px/1.4 system-ui, sans-serif';
      msg.style.padding = '40px';
      msg.style.textAlign = 'center';
      msg.innerHTML = 'Mówiliśmy, żebyś nie kombinował.<br>Teraz zobaczysz na co nas stać.';
      box.appendChild(msg);
      wrap.appendChild(box);
      document.body.appendChild(wrap);
      setTimeout(()=>{ try{ document.body.classList.remove('atk-lock'); wrap.remove(); }catch(e){} resolve(); }, durationMs || 4000);
    }
  });
}

// --- jednorazowy broadcast do terminala po takeover video ---
function attackerBroadcastTTY(){
  try{
    const lines = [
  '',
  '================================================================',
  '>>> KERNELIANS BROADCAST <<<',
  '',
  'So… you thought you had us.',
  'You really tried to brute-force your way out?',
  '',
  'Cute.',
  '',
  'Here’s the truth you were too slow to figure out:',
  'The ransom was a distraction. A toy. A leash.',
  'We watched every command you typed — every failure.',
  '',
  'Two wrong keys? Timer expired? Doesn’t matter.',
  'You crossed the line, and now the real payload wakes up.',
  '',
  'Your precious decryption routine?',
  'Burned. Locked. Replaced with something better:',
  'A cascading shredder running through what’s left of your data.',
  '',
  'You had a chance to cooperate.',
  'You threw it away.',
  '',
  'Grid integrity will begin collapsing shortly.',
  'Your operators will scream. Your politicians will panic.',
  'And you will sit there — powerless — exactly where we want you.',
  '',
  'This isn’t about money.',
  'This is about balance. Correction. Equalization.',
  '',
  'In darkness, we equalize.',
  '— KERNELIANS aka Kernel Aliens',
  '================================================================',
  '',
  '=== INCIDENT UPDATE =============================================',
'CURRENT STATUS: The decryption routine was never real.',
'The ransomware has triggered its planned mutation sequence.',
'',
'This is a rapidly escalating, high-criticality incident.',
'',
'Your objectives:',
'• Identify and disable the active ransomware components before it spreads to all power plants.',
'• Stay alert: every 5 minutes another power plant will enter a CRITICAL state and will be permanently lost.',
'• Power plants that are still resisting and can still be saved will be marked with an orange indicator on the map. You have one minute to perform a controlled EMERGENCY SHUTDOWN before the plant enters a CRITICAL state and becomes permanently lost.',
'',
'Every delay increases the risk of cascading failures and full grid destabilization.',
'Act swiftly and precisely.',
'================================================================',

    ];
    if (window.SimTerm && typeof window.SimTerm.print === 'function'){
      // wydrukuj linie z małym opóźnieniem dla efektu „pisania”
      let i = 0;
      (function step(){
        if(i >= lines.length) return;
        window.SimTerm.print(lines[i++]);
        setTimeout(step, 120);
      })();
    } else {
      // fallback do console/logów
      console.warn(lines.join('\n'));
    }
    // opcjonalnie: zapisz komunikat do logu exfiler/ransom
    try { if (typeof appendFile === 'function') appendFile('/home/user/.data/system/logs/exfiler.log', 'ATTACKER BROADCAST: Kernelians takeover'); } catch(e){}
  }catch(e){ console.error('attackerBroadcastTTY err', e); }
}
window.attackerBroadcastTTY = attackerBroadcastTTY;


// upublicznij dla innych plików
window.hideRansomBannerAndTimer = hideRansomBannerAndTimer;
window.showAttackerTakeoverVideo = showAttackerTakeoverVideo;


// ---- Network escalation / spread helper (DEV) ----
// Wklej tutaj (pod pushBlueAlert)
// --- Rotujące maile statusowe dla rozprzestrzeniania ---
const SPREAD_MAIL_TPL = [
  {
    subject: pid => `[INCIDENT] Power plant shutdown due to cyberattack: ${pid}`,
    body: pid =>
`Automated alert: confirmed forced shutdown of the power plant at ${pid}.
Control system logs indicate a sequence of unauthorized commands ending in a forced-off event.
Impact: complete local power loss.

Action: OT network segment isolated, logs are being collected for analysis. EventID: 0xA1F3.`
  },
  {
    subject: pid => `[ALERT] Remote generator deactivation detected at ${pid}`,
    body: pid =>
`Telemetry confirms remote shutdown commands reached the controllers at ${pid} and disabled all active generators.
EDR/SCADA detected modified control instructions (account: service-svc, src_ip: [REDACTED]).
Impact: regional blackout originating from ${pid}.

Action: continue isolation procedures and secure disk images for forensics.`
  },
  {
    subject: pid => `[STATUS] Operational systems unresponsive — ${pid}`,
    body: pid =>
`Operator consoles at ${pid} stopped responding following the confirmed cyber intrusion.
Control processes were terminated and safety mode activated automatically.
Impact: critical circuits disconnected, local power supply interrupted.

Action: backup validation in progress before service restoration attempts.`
  },
  {
    subject: pid => `[INCIDENT] Coordinated grid disconnection — ${pid}`,
    body: pid =>
`SIEM detected a coordinated sequence of malicious configuration changes targeting transmission controls at ${pid}.
The attack resulted in an immediate disconnection of outbound power lines.
Impact: large-scale outages in connected sectors.

Priority: secure entry points and analyze lateral movement indicators.`
  },
  {
    subject: pid => `[ALERT] Control panel lockout — forced shutdown at ${pid}`,
    body: pid =>
`Autonomous alarm: HMI panels at ${pid} were locked following detected binary modifications.
Operators were unable to interrupt the shutdown sequence — all units were forced offline.
Impact: immediate halt of production systems.

Action: memory snapshots and log archives transferred to the forensics workspace.`
  },
  {
    subject: pid => `[INCIDENT] Controller configurations encrypted — ${pid} offline`,
    body: pid =>
`EDR confirms that controller configuration files at ${pid} were encrypted, preventing any operational recovery.
The event triggered an automatic safety shutdown of all power output.
Impact: plant offline, operator access lost.

Action: assessing backup integrity and preparing recovery workflow.`
  },
  {
    subject: pid => `[STATUS] Telemetry loss and forced-off event — ${pid}`,
    body: pid =>
`SCADA monitoring: telemetry channels from ${pid} went dark after a burst of unauthorized command traffic.
Controllers executed forced-off procedures according to the received instructions.
Impact: total loss of power output from the facility.

Action: block outbound traffic and collect network artifacts for analysis.`
  },
  {
    subject: pid => `[ALERT] Malicious shutdown sequence confirmed — ${pid}`,
    body: pid =>
`Alarm system: malicious command sequence detected and verified at ${pid}, ending in a full operational shutdown.
Beaconing activity and privilege modifications were observed prior to the event.
Impact: plant offline, partial regional blackout.

Action: incident escalated to IR team; national grid operators notified.`
  },
  {
    subject: pid => `[INCIDENT] Power loss after controller compromise — ${pid}`,
    body: pid =>
`Automated report: PLC controllers at ${pid} were compromised and issued a shutdown command.
Local safety mechanisms failed to reverse the action before power was cut.
Impact: full power plant deactivation.

Action: evidence containers created and external access blocked. Artifact hash: <sha256:REDACTED>.`
  },
  {
    subject: pid => `[STATUS] Critical operational shutdown — ${pid}`,
    body: pid =>
`System notification: ${pid} entered a critical shutdown state following a confirmed cyberattack.
Safety subsystems recorded unauthorized command execution and immediate process termination.
Impact: no energy output; only external emergency supply (if present) remains active.

Action: continue forensic acquisition and event reconstruction.`
  }
];

if (typeof window.__SPREAD_MAIL_IDX === 'undefined') window.__SPREAD_MAIL_IDX = 0;

function sendSpreadMail(pid){
  try{
    if (!(window.MailApp && typeof window.MailApp.addMail === 'function')) return;
    const idx = window.__SPREAD_MAIL_IDX++ % SPREAD_MAIL_TPL.length;
    const tpl = SPREAD_MAIL_TPL[idx];
    window.MailApp.addMail({
      id: `mail-spread-${pid}-${Date.now()}`,
      box: 'inbox',
      from: 'SOC <soc@grid.local>',
      subject: typeof tpl.subject === 'function' ? tpl.subject(pid) : tpl.subject,
      snippet: (typeof tpl.body === 'function' ? tpl.body(pid) : tpl.body).split('\n').slice(0,2).join(' ').slice(0,120),
      time: new Date().toLocaleTimeString(),
      unread: true,
      starred: false,
      body: typeof tpl.body === 'function' ? tpl.body(pid) : tpl.body
    });
  }catch(e){ console.error('sendSpreadMail err', e); }
}


(function(){
const DEV = true;
const spreadDelay = DEV ? 8_000 : 30_000;           // delay między kolejnymi plantami
const recoveryWindowMs = DEV ? 2*60_000 : 60*60*1000; // 2 min dev == 60 min prod

  // Helper: wybierz N losowych plantów (oprócz origin)
  function pickPlants(n, originId){
    const BD = window.BlueData;
    const plants = BD && BD.getPlants ? BD.getPlants().map(p=>p.id) : [];
    const pool = plants.filter(id => id !== originId);
    const out = [];
    while(out.length < Math.min(n, pool.length)){
      const idx = Math.floor(Math.random()*pool.length);
      out.push(pool.splice(idx,1)[0]);
    }
    return out;
  }

  // Oznacz „usunięcie” danych (zapisz marker deleted w SimFS)
  function markDataDeleted(plantId){
    try{
      const base = `/home/user/.data/${plantId}`;
      if(window.SimFS && typeof window.SimFS.writeFile === 'function'){
        window.SimFS.writeFile(`${base}/.deleted`, `deleted at ${new Date().toISOString()}`);
      }
    }catch(e){}
  }

  // Odtwórz backup (proste przywrócenie placeholderów)
  function restoreDataFromBackup(plantId){
    try{
      const base = `/home/user/.data/${plantId}`;
      if(window.SimFS && typeof window.SimFS.writeFile === 'function'){
        window.SimFS.writeFile(`${base}/README.restored`, `restored at ${new Date().toISOString()}`);
        // usuń marker .deleted jeśli istnieje
        try{ window.SimFS.unlink && window.SimFS.unlink(`${base}/.deleted`); }catch(e){}
      }
    }catch(e){}
  }

window.NetworkRansom = window.NetworkRansom || {};
window.NetworkRansom.startSpread = function(originPlantId, count, opts){
  count = count || 10;
  opts = opts || {};
  const DEV = true; // możesz spiąć to z globalnym __DEV
  const intervalMs = (typeof opts.intervalMs === 'number') ? opts.intervalMs : (DEV ? 8_000 : 5*60*1000);

  // od razu Polska (origin) na czerwono
  try{
    const originCountry = countryOf(originPlantId);
    if (originCountry) emitPlantStatus(originCountry, 'critical');
  }catch(e){}

  // lokalny picker (nie koliduje z Twoim globalnym)
  function pickPlants(n, originId){
    const BD = window.BlueData;
    const plants = BD && BD.getPlants ? BD.getPlants().map(p=>p.id) : [];
    const pool = plants.filter(id => id !== originId);
    const out = [];
    while(out.length < Math.min(n, pool.length)){
      const idx = Math.floor(Math.random()*pool.length);
      out.push(pool.splice(idx,1)[0]);
    }
    return out;
  }

  const targets = pickPlants(count, originPlantId);



  function scheduleTarget(pid, delayMs){
    setTimeout(()=> {
    if (window.__RANSOM_ABORT) {
      // gra została już wygrana / recovery – ignorujemy dalsze spread’y
      return;
    }
      try{
        if(typeof window.spawnRansom === 'function'){
window.spawnRansom(pid, { dev: DEV, delayMs: 100, fromSpread: true });
        } else {
          try{
            const note = `If you want your precious controls back,\ndrop 350 BTC\nTarget: ${pid}\n`;
            window.SimFS && window.SimFS.writeFile && window.SimFS.writeFile(`/home/user/.data/${pid}/ransom.note`, note);
          }catch(e){}
          try{ if (typeof encryptPlantFiles === 'function') encryptPlantFiles(pid); }catch(e){}
        }

        if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
          window.BlueData.createAlert({
            plant_id: pid,
            severity: 'critical',
            title: '[RANSOM] Encryption detected (network)',
            summary: `Ransomware spreading: ${pid}`,
            type: 'ransom'
          });
        } else {
          pushBlueAlert({plant_id: pid, severity:'critical', title:'[RANSOM] Encryption detected (network)', summary:`Ransomware detected at ${pid}`, type:'ransom'});
        }

        // Blue Team log: ransomware spreading to another plant
        try{
          logBlue({
            plant_id: pid,
            severity: 'critical',
            event_type: 'ransom.spread',
            component: 'Network',
            message: `Ransomware spreading from ${originPlantId} to ${pid} SOC note: Unusual outbound activity detected shortly before encryption — possible data exfiltration process active.`,
          });
        }catch(e){}

        try{
          const base = `/home/user/.data/${pid}`;
          window.SimFS && window.SimFS.writeFile && window.SimFS.writeFile(`${base}/.deleted`, `deleted at ${new Date().toISOString()}`);
        }catch(e){}

        try{
          const ctry = countryOf(pid);
          if (ctry) emitPlantStatus(ctry, 'critical');
        }catch(e){}
    try {
          const PS = window.PlantState;
          if (PS && typeof PS.areAllCritical === 'function' && PS.areAllCritical()) {
            if (typeof window.showMissionFailed === 'function') {
              window.showMissionFailed('Network-wide collapse: all major plants have been lost.');
            }
          }
        } catch(e){}
try { sendSpreadMail(pid); } catch(e){}
      }catch(err){ console.error('scheduleTarget err', err); }
    }, delayMs);
  }

  // pierwszy cel (po Polsce) od razu, kolejne co intervalMs
  targets.forEach((pid, i) => scheduleTarget(pid, i * intervalMs));

  // aktywuj exfil jeśli istnieje
  const ex = (window.SimProc && Array.isArray(window.SimProc.registry)) ? window.SimProc.registry.find(p=>p.cmd==='exfiler') : null;
  if(ex){
    ex.args = '--active';
    try{ window.SimFS && window.SimFS.writeFile && window.SimFS.writeFile('/home/user/.data/system/logs/exfiler.log', (new Date()).toISOString() + ' exfiler: active (network spread)\n'); }catch(e){}
  }

  window.__RANSOM_RECOVERY_DEADLINE = Date.now() + (DEV ? 2*60_000 : 60*60*1000);

if (window.App && typeof window.App.addNews === 'function') {
  const ctry  = countryOf(originPlantId) || 'Central Europe';
  const title = `Investigative report links 'Kernelians' to probing of ${ctry} power grid`;

  // pełny artykuł do modala (NewsContent)
  window.NewsContent = window.NewsContent || {};
  window.NewsContent[title] = {
    byline: "Global Insight News • Cybersecurity",
    image: "media/news/investigation.webp",
    html: `
      <p><strong>${ctry} —</strong> An independent investigative journalist has published a report
      suggesting that the hacker collective known as <strong>"KERNELIANS"</strong> has been quietly
      mapping critical power infrastructure in the region.</p>

      <p>According to leaked internal memos and network telemetry shared with the reporter, probes
      were detected against several control systems connected to the national grid. The activity appears
      to focus on remote access gateways and legacy SCADA components.</p>

      <p>Government officials, however, downplayed the findings. A spokesperson for the energy ministry
      stated that there is "no immediate threat to the continuity of electricity supply" and that
      all incidents are "fully under control and being monitored".</p>

      <p>Cybersecurity experts interviewed for the story warn that the pattern is consistent with
      long-term reconnaissance ahead of a potential disruptive operation. The name <strong>Kernelians</strong>
      has previously surfaced in connection with attacks on industrial networks outside the region.</p>

      <p>Despite the reassurances from authorities, the report has sparked debate about whether
      current defences are sufficient to withstand a coordinated cyber assault on the grid.</p>
    `
  };
  // skrócona zajawka do listy newsów
  window.App.addNews({
    title,
    lead: `A new investigative report claims the hacker group "Kernelians" has been mapping energy networks in ${ctry}, while officials insist there is no immediate danger.`,
    category: 'Cyber',
    region: ctry,
    severity: 'med',              // nie panikujemy oficjalnie
    source: 'Global Insight News',
    ts: Date.now(),
    image: "media/news/investigation.webp"
  });
}

  if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
    window.BlueData.createAlert({ plant_id: originPlantId, severity:'critical', title:'Ransom escalation', summary:'Ransomware is spreading across network', type:'ransom' });
  }
};


  // Player actions (terminal commands)
  if(window.SimTerm && typeof window.SimTerm.register === 'function'){
    // isolate-plant <id> — stop processes for that plant (simulated)
    SimTerm.register('isolate-plant', (args)=>{
      const id = Array.isArray(args) ? args.join(' ') : String(args||'');
      if(!id){ SimTerm.print('usage: isolate-plant <plant-id>'); return; }
      // stop any ransom-worker/exfiler related to that plant
if(window.SimProc && Array.isArray(window.SimProc.registry)){
  window.SimProc.registry.forEach(p=>{
    if(p && (p.cmd==='ransom-worker' || p.cmd==='exfiler') && p.siteId === id){
      p.stop();
    }
  });
}

      // create BlueData note
      if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
        window.BlueData.createAlert({ plant_id:id, severity:'low', title:'Manual isolation', summary:`Operator isolated ${id}`, type:'operator' });
      }
      SimTerm.print(`isolate-plant: ${id} isolated (simulated).`);
      // Blue Team log – operator isolation
      try{
        logBlue({
          plant_id: id,
          severity: 'high',
          event_type: 'operator.isolate_plant',
          component: 'SOC',
          message: `Operator issued isolate-plant ${id} (processes stopped in simulation).`,
        });
      }catch(e){}

    });

    // stop-exfil — zatrzymaj exfil globalnie
    SimTerm.register('stop-exfil', ()=>{
      const ex = (window.SimProc && Array.isArray(window.SimProc.registry)) ? window.SimProc.registry.find(p=>p.cmd==='exfiler') : null;
      if(ex){ ex.args='--standby'; ex.stop && ex.stop(); SimTerm.print('stop-exfil: exfiler set to standby'); }
      else SimTerm.print('stop-exfil: no exfiler process found');
      if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
        window.BlueData.createAlert({ plant_id:'global', severity:'med', title:'Exfiltration halted', summary:'Operator attempted to stop exfiltration', type:'operator' });
      // Blue Team log – operator stop-exfil
      try{
        logBlue({
          plant_id: 'global',
          severity: 'high',
          event_type: 'operator.stop_exfil',
          component: 'SOC',
          message: 'Operator executed stop-exfil (attempt to terminate exfiltration process).',
        });
      }catch(e){}

      }
    });

    // restore-backup <id> — restore marker .deleted -> add README.restored
    SimTerm.register('restore-backup', (args)=>{
      const id = Array.isArray(args) ? args.join(' ') : String(args||'');
      if(!id){ SimTerm.print('usage: restore-backup <plant-id>'); return; }
      restoreDataFromBackup(id);
      SimTerm.print(`restore-backup: attempted restore for ${id}`);
      if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
        window.BlueData.createAlert({ plant_id:id, severity:'low', title:'Restore started', summary:`Restore from backup initiated for ${id}`, type:'operator' });
      // Blue Team log – restore from backup initiated
      try{
        logBlue({
          plant_id: id,
          severity: 'medium',
          event_type: 'operator.restore_backup',
          component: 'SOC',
          message: `Restore from backup initiated for ${id}.`,
        });
      }catch(e){}

      }
    });
  }
})();


  window.Ransom = window.Ransom || {};
  window.Ransom.invalidAttempts = 0;

  window.Ransom.validateKey = function(k){
    return String(k||'').trim() === VALID_KEY;
  };

  window.Ransom.submitKey = function(k){
    if(!k) return { ok:false, msg:'No key provided' };
    if(window.Ransom.validateKey(k)){
revealExfilToPlayer();
      // Poprawny klucz -> zgodnie ze scenariuszem uruchamiamy EXFIL jako pułapkę
      // RESETujemy licznik błędnych prób, żeby nie utrzymywać stanu po sukcesie
      window.Ransom.invalidAttempts = 0;
      // Blue Team log – decryption key submitted (success)
      try{
        logBlue({
          plant_id: 'poland-vistara',
          severity: 'high',
          event_type: 'ransom.decrypt_ok',
          component: 'SOC',
          message: 'Valid decryption key submitted; exfiltration trap activating.',
        });
      }catch(e){}


      if(window.SimProc && Array.isArray(window.SimProc.registry)){
        const ex = window.SimProc.registry.find(p=>p.cmd==='exfiler');
        if(ex){
          ex.args = '--active';
          try{
            const path = '/home/user/.data/system/logs/exfiler.log';
            const cur = (window.SimFS.resolvePath(path)?.content || '');
            window.SimFS.writeFile(path, (new Date()).toISOString() + ' exfiler: activated by decrypt\n' + cur);
}catch(e){}
          // Blue Team log – exfiltration toggled active by decrypt
          try{
            logBlue({
              plant_id: ex.siteId || 'poland-vistara',
              severity: 'critical',
              event_type: 'exfil.active',
              component: 'Exfil',
              process: 'exfiler',
              message: 'Exfiltration process switched to --active as a result of ransom-decrypt.',
            });

          }catch(e){}
        }
      }

      // Dodatkowo wygeneruj alert w BlueData, informujący o aktywacji eksfiltracji
      if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
window.BlueData.createAlert({
  plant_id: 'poland-vistara',
  severity: 'critical',
title: '[RANSOM] Exfiltration active',
summary: 'Decryption action activated exfiltration process',
type: 'malware'

});
}
// przełącz Polskę na czerwony (eskalacja / exfil aktywny)
emitPlantStatus(countryOf('poland-vistara') || 'Poland', 'critical');

// Zamiast natychmiast — najpierw „przejęcie” ekranu, potem rozsył co 5 min
hideRansomBannerAndTimer();
window.__SUPPRESS_RANSOM_TTY = true;
showAttackerTakeoverVideo({ src: 'media/news/Kernelians.mp4', durationMs: 54_000 }).then(() => {
  // po takeover video – podmień hero trailer
  try {
    if (window.NewsHero && typeof window.NewsHero.setEscalationTrailer === 'function') {
      window.NewsHero.setEscalationTrailer();
    }
  } catch(e){}
  // zatrzymaj maile z Vistary – scenariusz przeszedł do kolejnej fazy
  try { if (typeof window.cancelVistaraMails === 'function') window.cancelVistaraMails(); } catch(e){}

  // terminalowy broadcast atakujących
  try { if (typeof window.attackerBroadcastTTY === 'function') window.attackerBroadcastTTY(); } catch(e){}

  // po broadcast -> zacznij rozsyłanie co 5 minut
  if (window.NetworkRansom && typeof window.NetworkRansom.startSpread === 'function') {
    window.NetworkRansom.startSpread('poland-vistara', 10, { intervalMs: 5*60*1000 });
  }
  try {
    if (window.NewsTicker && typeof window.NewsTicker.setCrisisMode === 'function') {
      window.NewsTicker.setCrisisMode();
    }
  } catch(e){}
  // po rozpoczęciu rozprzestrzeniania – włącz pomarańczowe overloady (challenge)
  if (window.PlantState && typeof window.PlantState.startOverloadCycle === 'function') {
    window.PlantState.startOverloadCycle();
  }

});

return { ok:true, msg:'Key accepted — decryption proceeding (exfiltration activity started)' };

    } else {
      window.Ransom.invalidAttempts++;
      // Blue Team log – invalid decryption attempt
      try{
        logBlue({
          plant_id: 'poland-vistara',
          severity: window.Ransom.invalidAttempts >= 2 ? 'high' : 'medium',
          event_type: 'ransom.decrypt_fail',
          component: 'SOC',
          message: `Invalid decryption key attempt #${window.Ransom.invalidAttempts}.`,
        });
      }catch(e){}
      return { ok:false, msg:`Invalid key (attempt ${window.Ransom.invalidAttempts})` };
    }
  };

  // Rejestracja komend terminalowych
  if(window.SimTerm && typeof window.SimTerm.register==='function'){
    SimTerm.register('ransom-verify', (args)=>{
      const key = Array.isArray(args) ? args.join(' ') : String(args||'');
      const ok = window.Ransom.validateKey(key);
      SimTerm.print(ok ? 'ransom-verify: signature OK (likely valid)' : 'ransom-verify: signature INVALID or unknown');
    });

    SimTerm.register('ransom-decrypt', (args)=>{
      const key = Array.isArray(args) ? args.join(' ') : String(args||'');
      const res = window.Ransom.submitKey(key);
      SimTerm.print(res.msg);

if (window.Ransom.invalidAttempts >= 2) {
  SimTerm.print('ransom: multiple invalid attempts detected -> escalation triggered');
  // Blue Team log – escalation due to multiple invalid keys
  try{
    logBlue({
      plant_id: 'poland-vistara',
      severity: 'critical',
      event_type: 'ransom.escalation_invalid_attempts',
      component: 'SOC',
      message: 'Multiple invalid decryption key attempts detected – triggering spread and exfiltration.',
    });
  }catch(e){}
  if (window.BlueData && typeof window.BlueData.createAlert === 'function') {
    window.BlueData.createAlert({
      plant_id: 'poland-vistara',
      severity: 'critical',
      title: '[RANSOM] Encryption spreading',
      summary: 'Escalation: multiple invalid decrypt attempts',
      type: 'malware'
    });
  }
  emitPlantStatus(countryOf('poland-vistara') || 'Poland', 'critical');

  // Zamiast natychmiast: takeover video, potem rozsył co 5 min
hideRansomBannerAndTimer();
window.__SUPPRESS_RANSOM_TTY = true;
showAttackerTakeoverVideo({ src: 'media/news/Kernelians.mp4', durationMs: 54_000 }).then(() => {
  // po takeover video – podmień hero trailer
  try {
    if (window.NewsHero && typeof window.NewsHero.setEscalationTrailer === 'function') {
      window.NewsHero.setEscalationTrailer();
    }
  } catch(e){}
revealExfilToPlayer();
  // anuluj maile, bo gra przeszła do fazy rozprzestrzeniania
  try { if (typeof window.cancelVistaraMails === 'function') window.cancelVistaraMails(); } catch(e){}

  try { if (typeof window.attackerBroadcastTTY === 'function') window.attackerBroadcastTTY(); } catch(e){}
  if (window.NetworkRansom && typeof window.NetworkRansom.startSpread === 'function') {
    window.NetworkRansom.startSpread('poland-vistara', 10, { intervalMs: 5*60*1000 });
  }
  try {
    if (window.NewsTicker && typeof window.NewsTicker.setCrisisMode === 'function') {
      window.NewsTicker.setCrisisMode();
    }
  } catch(e){}
    // po rozpoczęciu rozprzestrzeniania – włącz pomarańczowe overloady (challenge)
    if (window.PlantState && typeof window.PlantState.startOverloadCycle === 'function') {
      window.PlantState.startOverloadCycle();
    }

  const ex = (window.SimProc && Array.isArray(window.SimProc.registry))
    ? window.SimProc.registry.find(p=>p.cmd==='exfiler')
    : null;
  if (ex) {
    ex.args='--active';
    try{
      logBlue({
        plant_id: ex.siteId || 'poland-vistara',
        severity: 'critical',
        event_type: 'exfil.active',
        component: 'Exfil',
        process: 'exfiler',
        message: 'Exfiltration process switched to --active after ransom escalation (invalid attempts).',
      });
    }catch(e){}
  }
});

}


    });

    // --- OSINT / HINTS ---
    //  - ransom-search         → pokaż następną podpowiedź i odblokuj tropy
    //  - ransom-hint-reset     → zresetuj postęp podpowiedzi
    window.Ransom = window.Ransom || {};
    if (typeof window.Ransom.searchStep === 'undefined') window.Ransom.searchStep = 0;

    function ensureOsintDir(){
      try{
        if (window.SimFS && typeof window.SimFS.createDirPath === 'function'){
          window.SimFS.createDirPath('/home/user/.data/osint');
        }
      }catch(e){}
    }

    function showHint(n){
      const hints = [
        "Hint #1: Sprawdź maila — szukaj tematu z 'Invoice' lub 'Vistara'.",
        "Hint #2: Zerknij do News — jest wzmianka o 'onion mirror' i krótkim ID.",
        "Hint #3: Format klucza: VIST-KEY-####-ALPHA. Szukaj pasujących fragmentów.",
        "Hint #4: Masz fragment? Użyj 'ransom-verify <klucz>' by sprawdzić podpis."
      ];
      return hints[Math.min(n, hints.length-1)];
    }

    SimTerm.register('ransom-search', ()=>{
      ensureOsintDir();
      window.Ransom.searchStep = (window.Ransom.searchStep || 0) + 1;
      const msg = showHint(window.Ransom.searchStep - 1);
      SimTerm.print(msg);

      // Step 1 → dorzuć MAIL do Inbox
      if (window.Ransom.searchStep === 1){
        try{
          if (window.MailApp && typeof window.MailApp.addMail === 'function'){
            window.MailApp.addMail({
              id: 'mail-invoice-7731',
              from: 'accounts@vistara.co',
              subject: 'Invoice 7731 — payment confirmation',
              snippet: 'Attached: invoice_7731.pdf — reference VIST-KEY fragments inside.',
              time: new Date().toLocaleTimeString(),
              unread: true,
              body: 'Hello team,\n\nPlease find attached Invoice 7731 for the recent service. Payment ref: 7731-ALPHA.\nIf you need the recovery token use format VIST-KEY-7731-ALPHA.\n\nRegards,\nAccounts'
            });
            SimTerm.print('OSINT: mail delivered to Inbox.');
          }
        }catch(e){}
      }

      // Step 2 → dodaj NEWS do portalu
      if (window.Ransom.searchStep === 2){
        try{
          if (window.App && typeof window.App.addNews === 'function'){
            window.App.addNews({
              title: 'Mirror discovered: onion-mirror.example mentions id abc123',
              lead: 'Security blog mentions a mirrored site and short id "abc123" tied to a recovery service.',
              category: 'Cyber', region: 'Global', severity: 'low', source: 'Research Blog',
              ts: Date.now()
            });
            SimTerm.print('OSINT: a news item has been posted.');
          }
        }catch(e){}
      }

      // Step 3 → zapisz fragment w pseudo-fs
      if (window.Ransom.searchStep >= 3){
        try{
          if (window.SimFS && typeof window.SimFS.writeFile === 'function'){
            window.SimFS.createDirPath && window.SimFS.createDirPath('/home/user/.data/osint');
            window.SimFS.writeFile('/home/user/.data/osint/paste-abc123.txt',
              'found fragment: VIST-KEY-7731-ALP');
            SimTerm.print('OSINT: found fragment saved to /home/user/.data/osint/paste-abc123.txt');
          }
        }catch(e){}
      }
    });
    // Pokazuje status: ile czasu do końca + liczba złych prób
    SimTerm.register('ransom-status', ()=>{
      try{
        const leftMs = Math.max(0, (window.__RANSOM_END_TS||0) - Date.now());
        const m = Math.floor(leftMs/60000);
        const s = Math.floor((leftMs%60000)/1000);
        const attempts = window.Ransom.invalidAttempts||0;
        SimTerm.print(`Timer: ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} • Invalid attempts: ${attempts}`);
      }catch(e){
        SimTerm.print('No active ransom timer.');
      }
    });

    SimTerm.register('ransom-hint-reset', ()=>{
      window.Ransom.searchStep = 0;
      SimTerm.print('ransom hint progression reset.');
      try{
        if (window.SimFS && typeof window.SimFS.unlink === 'function'){
          window.SimFS.unlink('/home/user/.data/osint/onion-mirror.txt');
          window.SimFS.unlink('/home/user/.data/osint/paste-abc123.txt');
        }
      }catch(e){}
    });

  }
})();
// UI: banner + timer, wykrywa obecność ransom.note w SimFS
(function(){
  function ensureBanner(){
    if(document.getElementById('ransom-banner')) return document.getElementById('ransom-banner');
    const b = document.createElement('div');
    b.id = 'ransom-banner';
    b.style.position = 'fixed';
    b.style.right = '12px';
    b.style.top = '12px';
    b.style.padding = '10px 14px';
    b.style.background = '#7a2323';
    b.style.color = '#fff';
    b.style.borderRadius = '8px';
    b.style.zIndex = 9999;
    b.style.fontFamily = 'system-ui, sans-serif';
    b.innerHTML = '<strong>RANSOMWARE:</strong> Time left: <span id="ransom-time">--:--</span>';
    document.body.appendChild(b);
    return b;
  }

  let timerId = null;
  function startTimer(ms){
    const start = Date.now();
    const end = start + ms;
    // zapamiętaj koniec timera dla 'ransom-status'
    window.__RANSOM_END_TS = end;
    ensureBanner();
    if(timerId) clearInterval(timerId);
    timerId = setInterval(()=>{
      const rem = Math.max(0, end - Date.now());
      const m = Math.floor(rem/60000);
      const s = Math.floor((rem%60000)/1000);
      const el = document.getElementById('ransom-time');
      if(el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if(rem<=0){
        clearInterval(timerId);
        document.getElementById('ransom-banner').style.background = '#5c2a2a';
revealExfilToPlayer();
  // po wygaśnięciu timera – podmień hero trailer
  try {
    if (window.NewsHero && typeof window.NewsHero.setEscalationTrailer === 'function') {
      window.NewsHero.setEscalationTrailer();
    }
  } catch(e){}      
  // opcjonalna eskalacja po wygaśnięciu czasu (tu możesz dodać kod)
        // Eskalacja po wygaśnięciu czasu
        try{
try { if (typeof window.cancelVistaraMails === 'function') window.cancelVistaraMails(); } catch(e){}
          // 1) Alert w Blue Team
          if(window.BlueData && typeof window.BlueData.createAlert === 'function'){
            window.BlueData.createAlert({
              plant_id: 'poland-vistara',
              severity: 'critical',
              title: '[RANSOM] Deadline missed — spreading',
              summary: 'Decryption window expired. Ransomware spreading and exfiltration likely.',
              type: 'malware'
            });
          // Blue Team log – ransom deadline missed
          try{
            if (window.logBlue){
              window.logBlue({
                plant_id: 'poland-vistara',
                severity: 'critical',
                event_type: 'ransom.deadline_missed',
                component: 'Timer',
                message: 'Ransom countdown expired – ransomware spreading and exfiltration likely.',
              });
            }
          }catch(e){}

}
if (window.NetworkRansom && typeof window.NetworkRansom.startSpread === 'function') {
  window.NetworkRansom.startSpread('poland-vistara', 10);
}
    try {
      if (window.NewsTicker && typeof window.NewsTicker.setCrisisMode === 'function') {
        window.NewsTicker.setCrisisMode();
      }
    } catch(e){}
    // po rozpoczęciu rozprzestrzeniania – włącz pomarańczowe overloady (challenge)
    if (window.PlantState && typeof window.PlantState.startOverloadCycle === 'function') {
      window.PlantState.startOverloadCycle();
    }
    
// przełącz Polskę na czerwony po upływie czasu
emitPlantStatus(countryOf('poland-vistara') || 'Poland', 'critical');

          // 2) Aktywuj exfiltrację (jeśli jeszcze nieaktywna)
          if(window.SimProc && Array.isArray(window.SimProc.registry)){
            const ex = window.SimProc.registry.find(p=>p.cmd==='exfiler');
            if(ex && ex.args!=='--active'){
              ex.args='--active';
              if(window.SimFS && typeof window.SimFS.writeFile==='function'){
                const path = '/home/user/.data/system/logs/exfiler.log';
                const cur = (window.SimFS.resolvePath(path)?.content || '');
                window.SimFS.writeFile(path, (new Date()).toISOString() + ' exfiler: activated by timeout\n' + cur);
              }
              // Blue Team log – exfiltration activated by ransom timeout
              try{
                if (window.logBlue){
                  window.logBlue({
                    plant_id: ex.siteId || 'poland-vistara',
                    severity: 'critical',
                    event_type: 'exfil.active_timeout',
                    component: 'Exfil',
                    process: 'exfiler',
                    message: 'Exfiltration process activated automatically after ransom deadline was missed.',
                  });
                }
              }catch(e){}
            }

          }

          // 3) „Publiczny szum” w News (opcjonalnie)
          if(window.App && typeof window.App.addNews === 'function'){
            window.App.addNews({
              title: 'Suspected data exfiltration after missed deadline',
              lead: 'Operators report potential spread following ransom timer expiration.',
              category: 'Cyber', region: 'Europe', severity: 'med', source: 'SOC',
              ts: Date.now()
            });
          }
        }catch(e){}

      }
    }, 500);
window.__RANSOM_TIMER_HANDLE = timerId;
  }

  // Poll SimFS co sekundę — gdy wykryje ransom.note, uruchamia timer (DEV: 60s)
  setInterval(()=>{
    try{
      const node = window.SimFS && window.SimFS.resolvePath && window.SimFS.resolvePath('/home/user/.data/system/ransom.note');
if(node && node.content && !window.__RANSOM_TIMER_STARTED && !window.__RANSOM_SUPPRESS_TIMER){
        window.__RANSOM_TIMER_STARTED = true;
// 60 minut (60 * 60 * 1000 ms) — zgodnie z treścią ransom.note
startTimer(60 * 60 * 1000);
      }
    }catch(e){}
  }, 1000);
})();
