// simproc.js — High-fidelity process/network/cron simulator for the fake terminal
// Works best with a tiny hook in terminal.js that lets external modules register commands.
// If window.SimTerm.register is available, this file wires: ps, ss/netstat, lsof, crontab, systemctl, kill.

(function(){
  // --- Guards & deps ---
  const FS = (window.SimFS ||= {});
  const Term = window.SimTerm; // optional integration hook (see patch below)

  // Basic helpers ------------------------------------------------------------
  const now = () => Date.now();
  const rand = (a,b) => a + Math.random()*(b-a);
  const choice = (arr) => arr[Math.floor(Math.random()*arr.length)];
  const pad = (s, w) => String(s).padStart(w, ' ');
  const fmtTime = (ms) => {
    const t = Math.floor(ms/1000); const h=Math.floor(t/3600); const m=Math.floor((t%3600)/60); const s=t%60;
    return `${pad(h,2)}:${pad(m,2)}:${pad(s,2)}`;
  };
// --- Guard: gdy true, watchdog blokuje "łatwe zwycięstwo" przez kill exfiler
window.__WD_EXFIL_GUARD_ACTIVE = true;
// Flaga: czy exfiler/systemd-helper są widoczne w konsoli gracza
window.__EXFIL_VISIBLE = window.__EXFIL_VISIBLE || false;

function isExfilHiddenProc(p){
  if (!p) return false;
  if (window.__EXFIL_VISIBLE) return false;
  // ukrywamy tylko te dwa
  return p.cmd === 'exfiler' || p.serviceName === 'systemd-helper';
}


  // FS helpers (append) ------------------------------------------------------
function appendFile(path, line){
  try{
    const node = FS.resolvePath ? FS.resolvePath(path) : null;
    const cur = (node && node.content) ? node.content : '';
    let next = (cur ? cur.replace(/\n?$/,'\n') : '') + line + '\n';

    // LIMIT: trzymaj tylko ostatnie ~64 KB, resztę utnij z początku
    const MAX = 64 * 1024; // możesz dać 32*1024 jeśli chcesz mocniej ciąć
    if (next.length > MAX) {
      next = next.slice(next.length - MAX);
    }

    FS.writeFile && FS.writeFile(path, next);
  } catch(e){ /* ignore */ }
}

  function ensureDir(path){ try{ FS.createDirPath && FS.createDirPath(path); }catch(e){} }

  // Model --------------------------------------------------------------------
  let NEXT_PID = 1200 + Math.floor(Math.random()*500);
  const users = ['root','postgres','www-data','mosquitto','redis','scada','telemetry','historian','nginx','syslog','ntp','daemon'];

  function newPid(){ return NEXT_PID++; }

class SimProcess{
  constructor(spec){
    Object.assign(this, {
      pid: newPid(), user:'root', cmd:'sleep', args:'1', cwd:'/',
      cpuBase: rand(0.2, 2.0), memBase: rand(0.3, 2.5),
      cpu: 0.1, mem: 0.1, startedAt: now(), alive:true,
      listens: [], // [{proto:'tcp', port:22}]
      conns: [],   // [{proto:'tcp', laddr:'10.0.0.1:5432', raddr:'203.0.113.10:42133', state:'ESTAB'}]
      logs: [],    // [{path:'/home/user/.data/.../logs/app.log', everyMs:10000, fmt: fn}]
      timers: [],  // internal intervals
      serviceName: null, // for systemctl mapping
      _logsRunning: false // NEW: flaga, by nie uruchamiać logerów drugi raz
    }, spec);
    SimProc.registry.push(this);
  }
  get etime(){ return now() - this.startedAt; }
  tick(){
    if(!this.alive) { this.cpu = 0; return; }
    // jitter around base
    this.cpu = Math.max(0, this.cpuBase + rand(-0.3, 0.7));
    this.mem = Math.max(0, this.memBase + rand(-0.2, 0.4));
  }
  startLoggers(){
    // NEW: zabezpieczenie przed podwójnym uruchomieniem
    if (this._logsRunning) return;
    this._logsRunning = true;

    this.logs.forEach(l => {
      const intv = setInterval(()=> {
        if(!this.alive) return;
        ensureDir(l.path.replace(/\/[^/]+$/,''));
        const line = typeof l.fmt==='function' ? l.fmt(this) : l.fmt;
        appendFile(l.path, line);
      }, l.everyMs);
      this.timers.push(intv);
    });
  }
  stop(){
    this.alive = false;
    this.conns = [];
    this.cpu = 0;
    this.mem = Math.max(0.05, this.mem * 0.3);

    // NEW: wyczyść wszystkie setInterval tego procesu
    try { (this.timers || []).forEach(t => clearInterval(t)); } catch(e){}
    this.timers = [];
    this._logsRunning = false;
  }
  start(){
    if(this.alive) return;
    this.alive = true;
    this.startedAt = now();
    this.startLoggers();
  }
}


  const SimProc = window.SimProc = {
    registry: [],
    services: new Map(), // name -> SimProcess
    connections: [],     // global ephemeral connections (for ss/netstat rendering)
    cron: [],            // {spec:'*/1 * * * *', everyMs:60000, task:fn, desc}
    up: true,
  };
// --- EXFILER singleton helpers ---------------------------------------------
// Flaga: czy exfiler ogólnie ma istnieć (ustawiana przez spawnRansom)
window.__EXFILER_WANTED = window.__EXFILER_WANTED || false;

// getExfiler: zwraca istniejący exfiler (z mapy usług lub registry) i rejestruje go jako usługę
function getExfiler(){
  // preferuj mapę usług
  let p = SimProc.services.get('exfiler');
  if (p) return p;
  // fallback: znajdź po cmd w registry
  p = (SimProc.registry || []).find(x => x && x.cmd === 'exfiler');
  if (p) {
    // promote do usługi, żeby systemctl/SimProc.services mogło go znaleźć
    p.serviceName = 'exfiler';
    SimProc.services.set('exfiler', p);
  }
  return p || null;
}

  // Network helpers ----------------------------------------------------------
  function makeListen(proc, proto, port){ proc.listens.push({proto, port}); }
  function addConn(proc, proto, lport, rip){
    const laddr = `10.0.${Math.floor(rand(0,255))}.${Math.floor(rand(2,254))}:${lport}`;
    const rport = [443,8443,5432,1883,502,4840,9200,80][Math.floor(Math.random()*8)];
    const raddr = `${rip}:${rport}`;
    const state = 'ESTAB';
    const c = {proto, laddr, raddr, state, pid: proc.pid, cmd: proc.cmd, user: proc.user, ttl: rand(15000, 90000)};
    SimProc.connections.push(c); proc.conns.push(c);
  }

  // Seed services ------------------------------------------------------------
  function seed(){
    // Core system
    const init = new SimProcess({ pid:1, user:'root', cmd:'init', args:'', cpuBase:0.1, memBase:0.2 });
    makeListen(new SimProcess({user:'root', cmd:'sshd', args:'-D', serviceName:'sshd', cpuBase:0.2, memBase:0.4}), 'tcp', 22);
    new SimProcess({user:'root', cmd:'cron', args:'-f', serviceName:'cron', cpuBase:0.1, memBase:0.2});
    new SimProcess({user:'root', cmd:'rsyslogd', args:'-n', serviceName:'rsyslog', cpuBase:0.15});
    new SimProcess({user:'ntp',  cmd:'ntpd', args:'-g -u ntp:ntp', serviceName:'ntp'});

    // Web/UI
    const nginx = new SimProcess({user:'www-data', cmd:'nginx', args:'-g daemon off;', serviceName:'nginx', cpuBase:0.5, memBase:1.1});
    makeListen(nginx, 'tcp', 80); makeListen(nginx,'tcp',443);

    // DBs
    const pg = new SimProcess({user:'postgres', cmd:'postgres', args:'-D /var/lib/postgresql/14', serviceName:'postgres', cpuBase:0.8, memBase:2.4});
    makeListen(pg,'tcp',5432);

    const redis = new SimProcess({user:'redis', cmd:'redis-server', args:'/etc/redis/redis.conf', serviceName:'redis', cpuBase:0.3, memBase:0.9});
    makeListen(redis,'tcp',6379);

    // Messaging / telemetry bus
    const mqtt = new SimProcess({user:'mosquitto', cmd:'mosquitto', args:'-c /etc/mosquitto/mosquitto.conf', serviceName:'mqtt', cpuBase:0.4});
    makeListen(mqtt,'tcp',1883); makeListen(mqtt,'tcp',8883);

    // ICS / Plant-specific
    const modbus = new SimProcess({user:'scada', cmd:'modbusd', args:'-l 0.0.0.0:502', serviceName:'modbusd', cpuBase:0.5});
    makeListen(modbus,'tcp',502);
    const opcua = new SimProcess({user:'scada', cmd:'opcua-server', args:'--port 4840', serviceName:'opcua', cpuBase:0.6});
    makeListen(opcua,'tcp',4840);

    const scadaAgent = new SimProcess({user:'scada', cmd:'scada-agent', args:'--bridge plc://192.168.50.0/24', serviceName:'scada-agent', cpuBase:0.9, memBase:1.2,
      logs:[{path:'/home/user/.data/system/logs/scada-agent.log', everyMs:12000, fmt:(p)=>`${new Date().toISOString()} poll ok; plc_online=${Math.random()>0.02}`}]});

    const telemetry = new SimProcess({user:'telemetry', cmd:'telemetryd', args:'--send mqtt://127.0.0.1:1883', serviceName:'telemetryd', cpuBase:0.7, memBase:0.8,
      logs:[{path:'/home/user/.data/system/logs/telemetry.log', everyMs:8000, fmt:(p)=>`${new Date().toISOString()} T=${(rand(280,360)).toFixed(1)}C P=${(rand(9.5,12.5)).toFixed(2)}MPa`}]});

    const historian = new SimProcess({user:'historian', cmd:'historian', args:'--db postgres://localhost:5432/hist', serviceName:'historian', cpuBase:1.2, memBase:2.0,
      logs:[{path:'/home/user/.data/system/logs/historian.log', everyMs:15000, fmt:(p)=>`${new Date().toISOString()} batch-write rows=${Math.floor(rand(800,1500))}`}]});

    // Log shipper / monitoring
    const shipper = new SimProcess({user:'syslog', cmd:'log-shipper', args:'--to 10.10.0.5:514', serviceName:'log-shipper', cpuBase:0.4});
    makeListen(shipper,'udp',514);

    const watchdog = new SimProcess({user:'root', cmd:'watchdog', args:'--services scada-agent,telemetryd,historian', serviceName:'watchdog', cpuBase:0.2,
      logs:[{path:'/home/user/.data/system/logs/watchdog.log', everyMs:20000, fmt:(p)=>`${new Date().toISOString()} health ok`}]});

// --- watchdog / respawn helper: systemd-helper (respawn exfiler) ---
(function(){
  // zabezpieczenie przed wielokrotnym dodaniem na reload
  if (window.__SYSTEMD_HELPER_ADDED) return;
  window.__SYSTEMD_HELPER_ADDED = true;

  const helper = new SimProcess({
    user: 'root',
    cmd: 'systemd-helper',       // tu jest nazwa watchdog'a
    args: '--monitor exfiler',
    serviceName: 'systemd-helper',
    cpuBase: 0.12,
    memBase: 0.2,
    logs: [
      { path: '/home/user/.data/system/logs/systemd-helper.log', everyMs: 20000,
        fmt: (p) => `${new Date().toISOString()} systemd-helper: heartbeat` }
    ]
  });

  // watcher: co X ms sprawdzaj stan exfiler i wznawiaj jeśli trzeba
  const CHECK_MS = 5000; // co 5s (możesz zmienić)
  const watcher = setInterval(()=> {
    if (!window.__WD_EXFIL_GUARD_ACTIVE || !helper.alive) return;
    try {
      // jeśli gra zakończona/abort -> nie respawnujemy
      if (window.__RANSOM_VICTORY || window.__RANSOM_ABORT) return;

      // Pobierz singleton exfiler (z mapy usług / registry)
      const ex = typeof getExfiler === 'function' ? getExfiler() : (SimProc.registry.find(p => p && p.cmd === 'exfiler') || null);

      // Jeżeli nie chcemy exfiler (spawnRansom jeszcze nie ustawił flagi) -> nic nie rób
      if (!ex && !window.__EXFILER_WANTED) return;

      if (!ex) {
        // Nie ma exfiler -> stwórz dokładnie JEDEN egzemplarz i zarejestruj go jako usługę
        const newEx = new SimProcess({
          user: 'root',
          cmd: 'exfiler',
          args: '--standby',
          cpuBase: 0.18,
          memBase: 0.5,
          serviceName: 'exfiler',
          logs: [{ path: '/home/user/.data/system/logs/exfiler.log', everyMs: 10000,
                   fmt: (p) => `${new Date().toISOString()} exfiler: standby` }]
        });
        SimProc.services.set('exfiler', newEx);
        addConn(newEx, 'tcp', 4444, '198.51.100.' + (10 + (Math.random()*240|0)));
        newEx.startLoggers();
        appendFile('/home/user/.data/system/logs/systemd-helper.log', `${new Date().toISOString()} spawned exfiler pid=${newEx.pid}`);
        // NEW: Blue Team log – exfiler spawned by watchdog
        logBlue({
          plant_id: newEx.siteId || 'poland-vistara',
          severity: 'high',
          event_type: 'process.start',
          component: 'systemd-helper',
          process: 'exfiler',
          message: 'systemd-helper respawned exfiler process after it was missing.',
        });      
  return;
      }

      // Jeśli istnieje, ale jest zatrzymany -> wznów go (nie twórz nowego)
      if (!ex.alive) {
        try {
          ex.start && ex.start();
          ex.startLoggers && ex.startLoggers();
          addConn(ex, 'tcp', 4444, '198.51.100.' + (10 + (Math.random()*240|0)));
          appendFile('/home/user/.data/system/logs/systemd-helper.log', `${new Date().toISOString()} restarted exfiler pid=${ex.pid}`);

          // NEW: Blue Team log – exfiler restarted by watchdog
          logBlue({
            plant_id: ex.siteId || 'poland-vistara',
            severity: 'high',
            event_type: 'process.start',
            component: 'systemd-helper',
            process: 'exfiler',
            message: 'systemd-helper restarted exfiler process (auto-recovery).',
          });
        } catch(e){ /* ignore */ }
      }

    } catch(e){ console.error('systemd-helper watcher err', e); }
  }, CHECK_MS);

  // zapisz timer, żeby można było go czyścić później
  helper.timers.push(watcher);

  // zarejestruj service mapę, tak jak inne
  if (helper.serviceName) SimProc.services.set(helper.serviceName, helper);
})();


    // Scale up workers (for high-fidelity)
    const extras = [];
    for(let i=0;i<8;i++) extras.push(new SimProcess({user:'www-data', cmd:'nginx: worker process', args:'', cpuBase:rand(0.2,0.9), memBase:rand(0.2,0.6)}));
    for(let i=0;i<6;i++) extras.push(new SimProcess({user:'postgres', cmd:'postgres: worker', args:'writer', cpuBase:rand(0.3,0.9), memBase:rand(0.4,0.9)}));
    for(let i=0;i<6;i++) extras.push(new SimProcess({user:'mosquitto', cmd:'mqtt-worker', args:'', cpuBase:rand(0.2,0.7)}));
    for(let i=0;i<12;i++) extras.push(new SimProcess({user:'scada', cmd:'scada-poll', args:`PLC 192.168.50.${10+i}`, cpuBase:rand(0.2,0.8)}));
    for(let i=0;i<10;i++) extras.push(new SimProcess({user:'telemetry', cmd:'telemetry-sender', args:`stream-${i}`, cpuBase:rand(0.2,0.8)}));

    // Map service names for systemctl
    SimProc.registry.forEach(p => { if(p.serviceName) SimProc.services.set(p.serviceName, p); });

    // Start loggers
    SimProc.registry.forEach(p => p.startLoggers());

    // Seed some persistent connections
    addConn(historian,'tcp',5432,'203.0.113.5'); // replication
    addConn(telemetry,'tcp',1883,'198.51.100.12');
    addConn(scadaAgent,'tcp',502,'192.0.2.44');

    // Add more random conns over time
    setInterval(()=>{
      const alive = SimProc.registry.filter(p=>p.alive);
      const proc = choice(alive);
      if(!proc) return;
      const proto = Math.random()<0.8 ? 'tcp' : 'udp';
      const lport = (proc.listens[0]?.port)||Math.floor(rand(40000, 65000));
      const rip = `${choice(["203.0.113","198.51.100","192.0.2"])}.${Math.floor(rand(2,254))}`;
      addConn(proc, proto, lport, rip);
    }, 3000);
  }

  // Cron seed ----------------------------------------------------------------
  function seedCron(){
    const C = (everyMs, desc, task) => SimProc.cron.push({everyMs, desc, task, last:0});

    C(60_000, 'telemetry upload tick', ()=> appendFile('/home/user/.data/system/logs/telemetry.log', `${new Date().toISOString()} upload ok`));
    C(300_000, 'health check', ()=> appendFile('/home/user/.data/system/logs/watchdog.log', `${new Date().toISOString()} services healthy`));
    C(900_000, 'sync with central', ()=> appendFile('/home/user/.data/system/logs/shipper.log', `${new Date().toISOString()} synced 2.1MB`));
    C(86_400_000, 'backup db', ()=> appendFile('/home/user/.data/system/logs/backup.log', `${new Date().toISOString()} backup completed in ${Math.floor(rand(42,87))}s`));
    C(86_400_000, 'logrotate', ()=> appendFile('/home/user/.data/system/logs/logrotate.log', `${new Date().toISOString()} rotated logs`));
    for(let i=0;i<8;i++){
      C(120_000 + i*7_000, `sensor rollup ${i}`, ()=> appendFile(`/home/user/.data/system/logs/sensor-${i}.log`, `${new Date().toISOString()} rollup ok`));
    }
  }

  // Engine loop --------------------------------------------------------------
  function engineTick(){
    const t = now();
    // processes
    SimProc.registry.forEach(p => p.tick());
    // connections TTL
    SimProc.connections = SimProc.connections.filter(c => (c.ttl -= 1000) > 0);
    // cron
    SimProc.cron.forEach(j => { if(t - j.last >= j.everyMs){ j.last = t; try{ j.task(); }catch(e){} } });
  }
  setInterval(engineTick, 1000);

  // Renderers ----------------------------------------------------------------
  function renderPs(){
    const header = '  PID USER       %CPU %MEM     TIME CMD';
    const lines = SimProc.registry
.filter(p => p.alive && !isExfilHiddenProc(p))
      .slice()
      .sort((a,b)=> b.cpu - a.cpu)
      .map(p => `${pad(p.pid,5)} ${String(p.user).padEnd(10,' ')} ${pad(p.cpu.toFixed(1),4)} ${pad(p.mem.toFixed(1),4)} ${pad(fmtTime(p.etime),9)} ${p.cmd} ${p.args}`);
    return [header, ...lines].join('\n');
  }

  function renderSS(){
    const header = 'Netid State   Local Address        Peer Address         PID/Program name';
const listen = SimProc.registry.flatMap(p => p.listens.map(l => ({
  netid: l.proto, state:'LISTEN', laddr:`0.0.0.0:${l.port}`, raddr:'*:*', pid:p.pid, name:p.cmd
})));
const flows = SimProc.connections.map(c => ({
  netid:c.proto, state:c.state, laddr:c.laddr, raddr:c.raddr, pid:c.pid, name:c.cmd
}));

const rows = [...listen, ...flows]
  .filter(r => {
    if (window.__EXFIL_VISIBLE) return true;
    return r.name !== 'exfiler' && r.name !== 'systemd-helper';
  })
  .slice(0,500)
  .map(r => `${r.netid.padEnd(5)} ${r.state.padEnd(7)} ${String(r.laddr).padEnd(20)} ${String(r.raddr).padEnd(20)} ${r.pid}/${r.name}`);

    return [header, ...rows].join('\n');
  }

  function renderCrontab(){
    const header = '# m h  dom mon dow   command';
    const rows = SimProc.cron.map(j => `*/${Math.max(1, Math.floor(j.everyMs/60000))} * * * *   # ${j.desc}`);
    return [header, ...rows].join('\n');
  }

  function renderLsof(){
    const header = 'COMMAND    PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME';
const rows = SimProc.registry
  .filter(p => p.alive && !isExfilHiddenProc(p))
  .flatMap(p => {
    const base = [];
    // pokaż wpis procesu tylko, jeśli użytkownik może "widzieć" binarkę (tu: /bin/<cmd>)
    const binNode = (window.SimFS && window.SimFS.resolvePath) ? window.SimFS.resolvePath('/bin/' + p.cmd) : null;
    const canSeeProc = (typeof canAccessNode === 'function')
      ? canAccessNode(binNode || {owner:'root', mode:'0755'}, 'r')
      : true;

    if (!canSeeProc && !(window.SimTerm && window.SimTerm.isRoot && window.SimTerm.isRoot())) return base;

    base.push(`${String(p.cmd).padEnd(9)} ${pad(p.pid,5)} ${String(p.user).padEnd(5)} txt   REG    8,1        0  123 /usr/bin/${p.cmd}`);

    // logi tylko jeśli dostępne do odczytu
    p.logs.forEach(l => {
      const lpNode = (window.SimFS && window.SimFS.resolvePath) ? window.SimFS.resolvePath(l.path) : null;
      if (typeof canAccessNode === 'function' && lpNode && !canAccessNode(lpNode, 'r') && !(window.SimTerm && window.SimTerm.isRoot && window.SimTerm.isRoot())) return;
      base.push(`${String(p.cmd).padEnd(9)} ${pad(p.pid,5)} ${String(p.user).padEnd(5)} 1w    REG    8,1        -    - ${l.path}`);
    });

    p.listens.forEach(li => base.push(`${String(p.cmd).padEnd(9)} ${pad(p.pid,5)} ${String(p.user).padEnd(5)} 3u  IPv4    0t0      TCP *:${li.port} (LISTEN)`));
    return base;
  });
    return [header, ...rows.slice(0,400)].join('\n');
  }
// ---- BlueData alert helper (fallback, gdy createAlert nie istnieje) ----
function pushBlueAlert(a){
  const BD = window.BlueData;
  if(!BD) return;

  if (typeof BD.createAlert === 'function') { BD.createAlert(a); return; }

  // fallback: normalizuj i wstaw na początek listy
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
  if (typeof BD.emit === 'function') {
    BD.emit('alert', alert);
    BD.emit('update');
  }
}
// ---- BlueData log helper (event logs for Blue Team) ----
function logBlue(evt){
  try{
    const BD = window.BlueData;
    if (!BD || typeof BD.addLog !== 'function') return;
    BD.addLog(evt);
  }catch(e){
    /* ignore */
  }
}

// --- Map hook: emituj status kraju na mapę ---
function emitPlantStatus(country, status){
  try{
    window.App = window.App || {};
    App.bus = App.bus || new EventTarget();
    App.bus.dispatchEvent(new CustomEvent('plant:status', {
      detail: { country, status }
    }));
  }catch(e){}
}

// --- Victory / recovery helper: wywołaj gdy exfiler zostanie zabity ---
function handleRansomVictory(){
  try{
    if (window.__RANSOM_VICTORY) return; // idempotent
    window.__RANSOM_VICTORY = true;
    window.__RANSOM_ABORT = true; // blokuje przyszłe spawny w spawnRansom
    //  zatrzymaj cykl przeciążeń na mapie
    try {
      if (window.PlantState && typeof window.PlantState.stopOverloadCycle === 'function') {
        window.PlantState.stopOverloadCycle();
      }
    } catch(e){}
    // 0) schowaj banner/timer (jeżeli definicja z ransom.js jest dostępna)
    try { if (typeof window.hideRansomBannerAndTimer === 'function') window.hideRansomBannerAndTimer(); } catch(e){}

    // 1) Zatrzymaj aktywne ransom/exfil
    if (Array.isArray(SimProc.registry)){
      SimProc.registry.forEach(p => {
        try {
          if (!p) return;
          if (p.cmd === 'ransom-worker' || p.cmd === 'exfiler') {
            p.stop && p.stop();
            appendFile('/home/user/.data/system/logs/watchdog.log', `${new Date().toISOString()} ${p.cmd} stopped by operator (victory)`);
          }
        } catch(e){}
      });
    }

    // 2) Przywróć dane i mapę dla wszystkich plantów
    try{
      const plants = (window.BlueData && typeof window.BlueData.getPlants === 'function') ? (window.BlueData.getPlants() || []) : [];
      plants.forEach(pl => {
        const pid = pl.id;
        const base = `/home/user/.data/${pid}`;
        try { FS.writeFile && FS.writeFile(`${base}/README.restored`, `restored at ${new Date().toISOString()}`); } catch(e){}
        try { FS.unlink && FS.unlink(`${base}/.deleted`); } catch(e){}
        try { FS.unlink && FS.unlink(`${base}/ransom.note`); } catch(e){}
        try { emitPlantStatus(pl.country || pl.country_name || (pl.name ? pl.name.split(' – ')[0] : 'Global') || 'Global', 'normal'); } catch(e){}
      });
    }catch(e){}

    // 3) Usuń globalny ransom.note (jeśli jest)
    try { FS.unlink && FS.unlink('/home/user/.data/system/ransom.note'); } catch(e){}

    // 4) Alert + News
    try{
      if (window.BlueData && typeof window.BlueData.createAlert === 'function'){
        window.BlueData.createAlert({
          plant_id: 'global',
          severity: 'low',
          title: '[RECOVERY] Exfiltration stopped',
          summary: 'Operator terminated exfiltration process — control regained.',
          type: 'operator'
        });
      } else {
        pushBlueAlert({ plant_id:'global', severity:'low', title:'[RECOVERY] Exfiltration stopped', summary:'Operator terminated exfiltration process — control regained.', type:'operator' });
      }
    }catch(e){}

    try{
      if (window.App && typeof window.App.addNews === 'function'){
window.App.addNews({
  title: 'Hero operator prevents nationwide blackout',
  lead: 'A single grid operator halted Kernelian’s attack, stopping a cascading blackout just minutes before failure.',
  category: 'Cyber',
  severity: 'low',
  ts: Date.now(),
  byline: 'Reuters • Global Energy Desk'
});

      }
    }catch(e){}
    // 5) Info do terminala + log
    try { termPrint('*** MISSION COMPLETE — The lights stay on because of you. ***'); } catch(e){}
    appendFile('/home/user/.data/system/logs/exfiler.log', `${new Date().toISOString()} exfiler: terminated by operator (victory)`);

    // 5) Info do terminala + log
    try { termPrint('*** MISSION COMPLETE — The lights stay on because of you. ***'); } catch(e){}
    appendFile('/home/user/.data/system/logs/exfiler.log', `${new Date().toISOString()} exfiler: terminated by operator (victory)`);

    // 6) Pokaż okno zwycięstwa na wierzchu
    try {
      if (typeof window.showMissionComplete === 'function') {
        window.showMissionComplete('You halted exfiltration and restored control across the grid.');
      }
    } catch(e){}


  }catch(err){
    console.error('handleRansomVictory error', err);
  }
}


  // Command handlers ---------------------------------------------------------
// ---- Ransomware helper (dodaj do simproc.js) ----
/**
 * spawnRansom(plantId, opts)
 * - plantId: opcjonalny identyfikator plantu (string)
 * - opts: {delayMs:number, dev:boolean}
 */
function spawnRansom(plantId, opts){
 if (window.__RANSOM_ABORT) return;
  opts = opts || {};
  const delay = typeof opts.delayMs === 'number' ? opts.delayMs : (opts.dev ? 10_000 : 30_000); // dev: 10s, prod: 30s
  // Ustaw flagę globalną żeby nie spawnować wielokrotnie
window.__RANSOM_ACTIVE = window.__RANSOM_ACTIVE || new Set();
const key = plantId || 'global';
if (window.__RANSOM_ACTIVE.has(key)) return;
window.__RANSOM_ACTIVE.add(key);

  // Po delay -> utwórz ransom note w SimFS i dodaj procesy "ransom-worker" + wpisy logów
  setTimeout(()=> {
// 1) ransom note
try {
const note = `*** RANSOM NOTE ***
Your systems have been encrypted.
Target: ${plantId || 'Unknown'}
If you want your precious controls back,
drop 350 BTC
You have 60 minutes to obtain and submit the key. Two failed attempts escalate.
`;
  if (window.SimFS && typeof window.SimFS.writeFile === 'function') {
    window.SimFS.writeFile('/home/user/.data/system/ransom.note', note);
  }
} catch (e) {
  // ignore
}

    // 2) create simulated process in SimProc.registry
    const rw = new SimProcess({
      user: 'www-data',
      cmd: 'ransom-worker',
  args:`--encrypt --site ${plantId||'site'}`,
  siteId: plantId || null,
      cpuBase: 0.6,
      memBase: 1.0,
      logs: [
        { path: '/home/user/.data/system/logs/ransom-worker.log', everyMs: 6000,
          fmt: (p)=>`${new Date().toISOString()} ransom-worker: started encrypting ${plantId||'site'}`} ,
        { path: '/home/user/.data/system/logs/ransom-worker.log', everyMs: 9000,
          fmt: (p)=>`${new Date().toISOString()} ransom-worker: file encrypted: /data/${(Math.random()*100|0)}.dat`}
      ]
    });

appendFile('/home/user/.data/system/logs/ransom-worker.log', 'ransom_key_1/3_VklTVC0=');

    // sygnalizuj watchdogowi, że od teraz exfil ma istnieć (watchdog może go wznawiać)
    window.__EXFILER_WANTED = true;

    // add / reuse a light exfil process (inactive until decrypt)
    let ex = (typeof getExfiler === 'function') ? getExfiler() : (SimProc.registry.find(p => p && p.cmd === 'exfiler') || null);
    if (ex) {
      // re-use existing singleton
      ex.args = '--standby';
      ex.siteId = plantId || null;
      ex.start && ex.start();
      ex.startLoggers && ex.startLoggers();
    } else {
      ex = new SimProcess({
        user: 'root',
        cmd: 'exfiler',
        args: '--standby',
        siteId: plantId || null,
        cpuBase: 0.2,
        memBase: 0.5,
        serviceName: 'exfiler',
        logs: [{ path: '/home/user/.data/system/logs/exfiler.log', everyMs: 10000,
          fmt: (p)=>`${new Date().toISOString()} exfiler: idle` }]
      });
      // zarejestruj w mapie usług - ułatwia odnajdywanie przez watchdog i systemctl
      SimProc.services.set('exfiler', ex);
      ex.startLoggers();
    }
    // nadal startuj logery ransom-worker
    rw.startLoggers();
    // NEW: Blue Team log – start of encryption
    logBlue({
      plant_id: plantId || 'poland-vistara',
      severity: 'critical',
      event_type: 'ransom.encryption_started',
      component: 'SCADA',
      process: 'ransom-worker',
      message: `Ransomware worker started encrypting ${plantId || 'site'}`,
    });


// ---- zaszyfruj pliki w katalogu planta (visual effect) ----
try{ if (typeof encryptPlantFiles === 'function') encryptPlantFiles(plantId); }catch(e){}

    // add some connections to simulate outbound C2/transfer
    addConn(rw,'tcp',4444, '198.51.100.' + (10 + (Math.random()*240|0)));

    // Emit event to BlueData if available to create an alert
pushBlueAlert({
  plant_id: 'poland-vistara',
  severity: 'critical',
  title: '[RANSOM] Encryption detected',
  summary: 'Ransomware activity detected: encryption in progress',
  type: 'malware'
});
    // Show a simple console message
    console.warn('SIM: ransom spawned for', plantId);
  }, delay);
}

// Hook detection: update existing cmd_systemctl / cmd_kill handlers below to call spawnRansom()
// Example: inside cmd_systemctl, when action==='stop' and name is scada-agent -> spawnRansom('vistara', {dev:true})

// ---- end ransom helper ----

  function termPrint(s){ (Term && Term.print) ? Term.print(s) : console.log(s); }

  function cmd_ps(){ termPrint(renderPs()); }
  function cmd_ss(args){ termPrint(renderSS()); }
  function cmd_netstat(args){ termPrint(renderSS()); }
  function cmd_crontab(args){ if(args[0]==='-l'||!args.length) termPrint(renderCrontab()); else termPrint('crontab: only -l supported in sim'); }
  function cmd_lsof(args){ termPrint(renderLsof()); }
  function cmd_kill(args){
    const pid = parseInt(args[0],10); const p = SimProc.registry.find(x=>x.pid===pid);
    if(!p) return termPrint(`kill: ${args[0]}: No such process`);    
// POLICY: exfiler i systemd-helper można zabić tylko jako root
(function(){
  const isRoot = !!(window.SimTerm && typeof window.SimTerm.isRoot === 'function' && window.SimTerm.isRoot());
  const isProtected =
    (p && p.cmd === 'exfiler') ||
    (p && p.serviceName === 'systemd-helper');

  if (isProtected && !isRoot) {
    termPrint(`kill: (${p.cmd}) Operation not permitted — need root`);
    return; // przerwij bez p.stop()
  }
    // NEW: jeśli zabijamy systemd-helper jako root – wyłącz guard tak jak przy systemctl stop
    if (p && p.serviceName === 'systemd-helper') {
      window.__WD_EXFIL_GUARD_ACTIVE = false;
      appendFile('/home/user/.data/system/logs/systemd-helper.log',
        `${new Date().toISOString()} guard disabled (killed via signal)`);

      // log dla Blue Teamu
      logBlue({
        plant_id: 'poland-vistara',
        severity: 'high',
        event_type: 'config.change',
        component: 'systemd',
        process: 'systemd-helper',
        message: 'Watchdog for exfiler disabled via kill on systemd-helper.',
      });

      termPrint('[sysinfo] Supervisory process neutralized.');
    }
})();

p.stop(); 

// --- Warunek: zwycięstwo dopiero, gdy watchdog (systemd-helper) jest WYŁĄCZONY
try {
  if (p && p.cmd === 'exfiler') {
    appendFile('/home/user/.data/system/logs/exfiler.log',
      `${new Date().toISOString()} exfiler: killed by operator`);

    // NEW: Blue Team log – kill exfiler
    logBlue({
      plant_id: p.siteId || 'poland-vistara',
      severity: 'high',
      event_type: 'process.stop',
      component: 'Exfil',
      process: 'exfiler',
      message: 'Operator sent kill signal to exfiler process.',
    });


    if (window.__WD_EXFIL_GUARD_ACTIVE) {
      termPrint('[syswarn] Process guardianship conflict detected.');
      // UWAGA: nie wywołujemy handleRansomVictory() przy włączonym guardzie
    } else {
      termPrint('[service] exfiler.service: Main process killed');
      termPrint('[service] exfiler.service: Exfiltration pipeline terminated');
      termPrint('[service] recovery.target: Starting integrity check…');
      try { handleRansomVictory(); } catch(e) { console.error('victory call failed', e); }
    }
  }
} catch(e){ console.error(e); }

// --- reveal final key part only if the killed process was the ransom-worker ---
try {
  if (p && p.cmd === 'ransom-worker') {
    const msg = "Nice job — here is the 2nd part of the key: -KEY-7731-";
    // use termPrint wrapper or SimTerm.print fallback
    if (typeof termPrint === 'function') {
      termPrint(msg);
    } else if (window.SimTerm && typeof window.SimTerm.print === 'function') {
      window.SimTerm.print(msg);
    } else if (console && typeof console.log === 'function') {
      console.log(msg);
    }
    // persist to ransom log so player can find it later

    // NEW: Blue Team log – ransom worker killed
    logBlue({
      plant_id: p.siteId || 'poland-vistara',
      severity: 'high',
      event_type: 'ransom.worker_killed',
      component: 'SCADA',
      process: 'ransom-worker',
      message: 'Ransomware worker process terminated by operator.',
    });

    appendFile('/home/user/.data/system/logs/ransom-worker.log', msg);
  }
} catch (e) { /* ignore errors */ }
if (p.cmd === 'scada-agent') {

  // NEW: Blue Team log – local scada-agent killed
  logBlue({
    plant_id: 'poland-vistara',
    severity: 'medium',
    event_type: 'process.stop',
    component: 'SCADA',
    process: 'scada-agent',
    message: 'Local SCADA agent process killed on host; Poland marked as warn.',
  });
  // od razu zaznacz Polskę na żółto (ostrzeżenie)
  emitPlantStatus('Poland', 'warn');
  // po 10s symuluj infekcję
  spawnRansom('poland-vistara', { dev: true, delayMs: 10_000 });
}

appendFile('/home/user/.data/system/logs/watchdog.log', `${new Date().toISOString()} ${p.cmd} stopped by operator`);
    termPrint('');
  }
// === Vistara mail scheduler control ===
window.__VISTARA_MAIL_HANDLES = window.__VISTARA_MAIL_HANDLES || [];

function cancelVistaraMails(){
  window.__VISTARA_MAILS_CANCELLED = true;
  try {
    (window.__VISTARA_MAIL_HANDLES || []).forEach(h => clearTimeout(h));
  } catch(e){}
  window.__VISTARA_MAIL_HANDLES = [];
}
window.cancelVistaraMails = cancelVistaraMails; // udostępnij globalnie

// === Helper: schedule Vistara crisis emails (5, 30, 55, 57 min) ===
function scheduleVistaraMails(){
  if (window.__VISTARA_MAILS_SCHEDULED) return; // avoid duplicates on re-entry
  window.__VISTARA_MAILS_SCHEDULED = true;
  window.__VISTARA_MAILS_CANCELLED = false;
  window.__VISTARA_MAIL_HANDLES = window.__VISTARA_MAIL_HANDLES || [];

  // tiny util with retry if Mail UI not ready yet
  function sendMailWithRetry(msg){
    function trySend(){
      try{
        if (window.MailApp && typeof window.MailApp.addMail === 'function'){
          window.MailApp.addMail(msg);
          return; // sent OK
        }
      }catch(e){}
      setTimeout(trySend, 5000); // retry in 5s
    }
    trySend();
  }

  // helper do rejestrowania timeoutów
  function scheduleMail(delayMs, msgBuilder){
    const h = setTimeout(() => {
      if (window.__VISTARA_MAILS_CANCELLED) return;
      sendMailWithRetry(msgBuilder());
    }, delayMs);
    window.__VISTARA_MAIL_HANDLES.push(h);
  }

  // 5 min — dramatyczny apel
  scheduleMail(5 * 60 * 1000, () => ({
    id: 'mail-vistara-status-1' + Date.now(),
    box: 'inbox',
    from: 'Vistara Station Ops <ops@vistara.pl>',
    subject: 'Weird behaviour in control systems at Vistara',
    snippet: 'Panels keep flickering and units drop offline for a moment, then come back…',
    time: new Date().toLocaleTimeString(),
    unread: true,
    starred: true,
    body:
`From: Vistara Station Operations <ops@vistara.pl>
To: SOC Operations

Hi,

Are you seeing anything unusual on your side?

Our control panels have started behaving strangely in the last few minutes.
HMIs are flickering, some readouts briefly go to zero and then recover,
and a few generator units have dropped offline for a second and then
came back up without any operator action.

Local engineers are asking if this is:
- some kind of remote test,
- a calibration job,
- or something we should be worried about.

Right now everything is still technically running, but if this continues
for much longer, operators will start losing trust in the readings.

Please confirm if this is a known issue or if we should prepare
for a controlled shutdown scenario.

— Vistara Station Operations
(poland-vistara)`
  }));

  // 30 min — „Jak ci idzie?”
  scheduleMail(30 * 60 * 1000, () => ({
    id: 'mail-vistara-status-2' + Date.now(),
    box: 'inbox',
    from: 'Vistara Station Ops <ops@vistara.pl>',
    subject: '[Urgent] Rolling outages around Vistara – systems unstable',
    snippet: 'Multiple towns are reporting short blackouts while our systems keep cycling…',
    time: new Date().toLocaleTimeString(),
    unread: true,
    starred: true,
    body:
`From: Vistara Station Operations <ops@vistara.pl>
To: SOC Operations

We need an urgent update.

The “weird behaviour” we reported earlier is getting worse.
We are now seeing:

- short, repeated loss of output from several units,
- protection systems triggering without clear cause,
- automatic restart cycles that nobody here initiated.

Regional dispatch is calling every few minutes.
Multiple towns around the Vistara corridor are reporting
brief blackouts and voltage dips. People are getting stuck
in elevators, some hospitals are already switching to diesel.

Our local staff still don’t understand the root cause.
From their perspective, the system is “glitching” and then
recovering on its own, like something is playing with the controls.

We urgently need to know:
- is this a confirmed cyber incident?
- do you want us to prepare for a wider manual shutdown?
- how far this could realistically spread?

If this keeps going, public pressure and media attention will explode.

— Vistara Station Operations
(poland-vistara)`
  }));

  // 55 min — „Zapłacimy okup”
  scheduleMail(55 * 60 * 1000, () => ({
    id: 'mail-vistara-status-3' + Date.now(),
    box: 'inbox',
    from: 'Vistara Station Ops <ops@vistara.pl>',
    subject: '[CRITICAL] Vistara losing control – widespread blackouts',
    snippet: 'Units are dropping one by one, large parts of the country are going dark…',
    time: new Date().toLocaleTimeString(),
    unread: true,
    starred: true,
    body:
`From: Vistara Station Operations <ops@vistara.pl>
To: SOC Operations

This is no longer a “weird glitch”.

We are actively losing control over the plant.

Units are tripping offline one by one, sometimes coming back up,
sometimes staying down. Operator commands are being ignored or
executed with a delay. Some screens freeze while others show
values that make no physical sense.

Dispatch is reporting:
- major cities experiencing multi-minute blackouts,
- traffic lights down across several regions,
- hospitals burning through their backup fuel faster than expected,
- social media full of videos of dark city blocks and angry crowds.

Government contacts are demanding a clear explanation.
Right now, we have none we can honestly give them.

We need immediate guidance:
- Do we treat this as a full-scale cyberattack on the grid?
- Are there any safe recovery procedures from your side?
- Should we prepare for the possibility that we cannot
  regain control without talking to the attackers?

If you have *anything* useful — indicators, commands, a way to stop
whatever is inside our systems — we need it now.

We are running out of time here.

— Vistara Station Operations
(poland-vistara)`
  }));

  // 57 min — „Dostaliśmy klucz” + komenda do użycia
  scheduleMail(57 * 60 * 1000, () => ({
    id: 'mail-vistara-key-' + Date.now(),
    box: 'inbox',
    from: 'SOC Emergency Desk <soc@grid-sec.gov>',
    subject: '[URGENT] Decryption key recovered — use immediately',
    snippet: 'We got it. Use the key NOW before they escalate…',
    time: new Date().toLocaleTimeString(),
    unread: true,
    starred: true,
    body:
`From: SOC Emergency Desk <soc@grid-sec.gov>
To: All Operators on the Vistara incident

We don’t have time for a long briefing.

We managed to intercept one of the command fragments the attackers
left behind in their tooling. It looks like they slipped up in
their fallback routine — we extracted a working decryption key.

This is the ONLY usable key we’ve found so far:

    VIST-KEY-7731-ALPHA

Use it *immediately* with:
    ransom-decrypt VIST-KEY-7731-ALPHA

We can’t guarantee how long the window stays open. Their malware
is mutating and we’re already seeing signs that they’re preparing
a full lockout across multiple sites.

If this works on your end, you might be the only operator who can
still break their chain of escalation.

Move fast.
We’re still fighting to keep comms alive.

— SOC Emergency Desk
"Stay online. Stay sharp."`
  }));
}

  function cmd_systemctl(args){
const action = args[0]||'status';
const name = (args[1]||'').replace(/\.service$/,'');
const svc = SimProc.services.get(name);

// jeśli exfiler/systemd-helper są "niewidoczne", udawaj, że ich nie ma
if (!svc || isExfilHiddenProc(svc)) {
  return termPrint(`Unit ${name}.service could not be found.`);
}

    if(action==='status'){
      const active = svc.alive? 'active (running)':'inactive (dead)';
      termPrint(`${name}.service - ${svc.cmd}\n   Loaded: loaded (/etc/systemd/system/${name}.service; enabled)\n   Active: ${active} since ${new Date(svc.startedAt).toISOString()}\n  Process: ${svc.pid} (${svc.cmd})\n Main PID: ${svc.pid} (${svc.cmd})\n      CPU: ${svc.cpu.toFixed(1)}%   MEM: ${svc.mem.toFixed(1)}%`);

} else if(action==='stop'){
  // POLICY: exfiler & systemd-helper można zatrzymać tylko jako root
  const isRoot = !!(window.SimTerm && typeof window.SimTerm.isRoot === 'function' && window.SimTerm.isRoot());
  if ((svc.serviceName === 'exfiler' || svc.serviceName === 'systemd-helper') && !isRoot) {
    termPrint(`Authorization failed: need root to stop ${svc.serviceName}.`);
    return;
  }

  svc.stop();

  // jeśli zatrzymano nasz watchdog — wyłącz guard
  if (svc.serviceName === 'systemd-helper') {
    window.__WD_EXFIL_GUARD_ACTIVE = false;
    appendFile('/home/user/.data/system/logs/systemd-helper.log',
      `${new Date().toISOString()} guard disabled`);
    // NEW: Blue Team log – watchdog disabled
    logBlue({
      plant_id: 'poland-vistara',
      severity: 'high',
      event_type: 'config.change',
      component: 'systemd',
      process: 'systemd-helper',
      message: 'Watchdog for exfiler disabled via systemctl stop systemd-helper.',
    });

    termPrint('[hint] Watchdog disabled — możesz teraz zabić exfiler, żeby wygrać.');
  }


  // jeśli zatrzymano scada-agent — sprawdzamy dodatkowe warunki (plant argument)
  if (svc && svc.serviceName === 'scada-agent') {
    const plantArg = args[2] || ''; // spodziewamy się: systemctl stop scada-agent <plant-id>

    // tylko jeśli gracz wcześniej odczytał phishingowy mail -> pozwól eskalować symulację
    if (plantArg === 'australia-australisnova' && window.__PHISH_MAIL_READ) {

      // NEW: Blue Team log – suspicious remote SCADA stop
      logBlue({
        plant_id: 'australia-australisnova',
        severity: 'high',
        event_type: 'process.stop',
        component: 'SCADA',
        process: 'scada-agent',
        message: 'Operator executed "systemctl stop scada-agent australia-australisnova" phishing email.',
      });

      // NEW: Blue Team log – early signal towards Poland
      logBlue({
        plant_id: 'poland-vistara',
        severity: 'medium',
        event_type: 'network.anomaly',
        component: 'Gateway',
        message: 'New control path towards poland-vistara after remote SCADA stop in Australia.',
      });

      // wyłącz czerwone oznaczenie Australii (przywróć normalny stan)
      try { emitPlantStatus('Australia', 'normal'); } catch(e){}

      // ustaw żółte ostrzeżenie dla Poland / poland-vistara
      try { emitPlantStatus('Poland', 'warn'); } catch(e){}

      // wywołaj spawnRansom dla pola poland-vistara (to uruchomi procesy ransom + wiadomość)
      if (window.spawnRansom && typeof window.spawnRansom === 'function') {
        // dev: szybki delay
        window.spawnRansom('poland-vistara', { dev: true, delayMs: 100 });
scheduleVistaraMails();
// symulacja utraty przywilejów: przełącz gracza na www-data (brak normalnego home)
try { if (window.SimTerm && typeof window.SimTerm.switchToUser === 'function') window.SimTerm.switchToUser('www-data', null); } catch(e){/*ignore*/ }

      } else {
        // fallback: użyj wcześniej zdefiniowanego helpera pushBlueAlert (jeśli jest)
        try { pushBlueAlert({ plant_id: 'poland-vistara', severity: 'critical', title:'[RANSOM] Encryption detected', summary:'Triggered by operator action' }); } catch(e){}
scheduleVistaraMails();
      }
    } else {
      // normalne zatrzymanie scada-agent (np. operator)
      try { emitPlantStatus('Poland', 'warn'); } catch(e){} // tylko jako standard: ustaw warn w Polsce
    }
  }

  termPrint('');


} else if(action==='start'){
  svc.start();
  if (svc.serviceName === 'systemd-helper') {
    window.__WD_EXFIL_GUARD_ACTIVE = true;
    appendFile('/home/user/.data/system/logs/systemd-helper.log',
      `${new Date().toISOString()} guard enabled`);
    termPrint('[info] Watchdog enabled — exfiler będzie auto-wznawiany.');
  }
  termPrint('');

    } else if(action==='restart'){
      svc.stop(); setTimeout(()=>svc.start(), 500); termPrint('');
    } else {
      termPrint('Usage: systemctl [status|start|stop|restart] <service>');
    }
  }

  // Register to terminal (if hook present) ----------------------------------
  if(Term && typeof Term.register==='function'){
    Term.register('ps', cmd_ps);
    Term.register('ss', cmd_ss);
    Term.register('netstat', cmd_netstat);
    Term.register('crontab', cmd_crontab);
    Term.register('lsof', cmd_lsof);
    Term.register('kill', cmd_kill);
    Term.register('systemctl', cmd_systemctl);
    // Provide a quick info command
    Term.register('simproc', ()=> termPrint(`simproc: ${SimProc.registry.filter(p=>p.alive).length} procs, ${SimProc.connections.length} conns, ${SimProc.cron.length} cron jobs`));
  }

  // FS bootstrap dirs
  ensureDir('/home/user/.data/system/logs');

  // Ensure any pre-existing exfiler is registered as a service (sanity)
  (function ensureExfilerServiceOnce(){
    try{
      const ex = (SimProc.registry || []).find(p => p && p.cmd === 'exfiler');
      if (ex) { ex.serviceName = 'exfiler'; SimProc.services.set('exfiler', ex); }
    }catch(e){}
  })();


  // Start
  seed();
  seedCron();
window.spawnRansom = spawnRansom;

})();
