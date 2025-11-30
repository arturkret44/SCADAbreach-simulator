
/* blue-data.js
 * Pure logic/data for Blue Team. No styles, no layout.
 * Exposes window.BlueData with:
 *  - start(), stop(), setRate(epm)
 *  - getLogs(opts), getAlerts(opts), getStats(), getPlants()
 *  - on(evt,fn), off(evt,fn)
 *  - acknowledgeAlert(id), resolveAlert(id), assignAlert(id, who)
 *  - setSiteFilter(plantId|null)
 */
(function () {
  const BlueData = {};
  const MAX_LOGS = 5000;
  const MAX_ALERTS = 500;
  let timer = null;
  let epm = 90;            // events per minute
  let siteFilter = null;

  // --- Pub/Sub ---
  const listeners = new Map();
  function emit(evt, payload){ (listeners.get(evt)||[]).forEach(fn => { try{ fn(payload); }catch(e){ console.error(e);} }); }
  BlueData.on = function(evt, fn){ if(!listeners.has(evt)) listeners.set(evt,new Set()); listeners.get(evt).add(fn); };
  BlueData.off = function(evt, fn){ if(listeners.has(evt)) listeners.get(evt).delete(fn); };

// --- Plants are loaded from data/plants.json to stay in sync with the game ---
let plants = [];   // will be filled async

function slug(s){ return String(s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

/**
 * Load plants.json used by other modules (Power/Terminal) so IDs are consistent.
 * ID rule kept same as terminal.js: p.id || (p.country + '-' + slug(p.name))
 */
function loadPlants(){
  fetch('data/plants.json')
    .then(r => r.json())
    .then(list => {
      if(!Array.isArray(list)) return;
      plants = list.map(p => ({
        id: p.id || (p.country + '-' + slug(p.name || '')),
        name: p.name || '',
        country: p.country || '',
        capacity_gw: p.capacity_gw,
        types: p.types || [],
        description: p.description || p.desc || ''
      }));
      emit('update', { plants:true });
    })
    .catch(err => console.warn('BlueData: failed to load plants.json', err));
}


  const components = ["SCADA","PLC","IDS","HVAC","Inverter","Gateway","HMI","DB"];
  const eventTypes = [
    "auth.success","auth.failure","config.change","sensor.out_of_range","network.anomaly",
    "firmware.update","malware.hash_detected","user.elevation","process.start","process.stop",
    "connection.dropped","backup.completed","backup.failed","audit.log","policy.violation"
  ];
  const sevWeights = [
    { sev:"info", w:65 }, { sev:"low", w:20 }, { sev:"medium", w:10 }, { sev:"high", w:4 }, { sev:"critical", w:1 }
  ];

  const state = {
    logs: [], alerts: [], plants,
    stats: {
      countsBySeverity: { info:0, low:0, medium:0, high:0, critical:0 },
      countsByType: {},
      timeline: [] // {min,count}
    }
  };

  // --- Utils ---
  function randChoice(a){ return a[(Math.random()*a.length)|0]; }
  function randInt(min,max){ return (Math.random()*(max-min+1) + min) | 0; }
  function weightedChoice(items){
    const total = items.reduce((s,x)=>s+x.w,0); let r = Math.random()*total;
    for(const it of items){ r-=it.w; if(r<=0) return it; } return items[0];
  }
  function ip(){ return [randInt(1,223),randInt(0,255),randInt(0,255),randInt(1,254)].join('.'); }
  // Wewnętrzne IP (sieć korporacyjna / OT)
  function internalIpForPlant(plant){
    // Spróbuj ustalić "podsiec" na podstawie kraju / id plantu, żeby było spójnie
    const base = (plant && plant.country) || (plant && plant.id) || '';
    let oct2 = 10, oct3 = 10;
    if (base) {
      // prosta pseudo-hash: litery → liczby
      let h = 0;
      for (let i=0; i<base.length; i++) h = (h + base.charCodeAt(i)) & 0xff;
      oct2 = 10 + (h % 200);       // 10–209
      oct3 = 10 + ((h>>4) % 200);  // 10–209
    }
    return `10.${oct2}.${oct3}.${randInt(2,254)}`;
  }

  // Zewnętrzne IP (Internet / atakujący)
  function externalIp(){
    const blocks = ["203.0.113", "198.51.100", "192.0.2"]; // RFC 5737 doc ranges
    const base = randChoice(blocks);
    return `${base}.${randInt(2,254)}`;
  }

  // Helper: wybierz realne IP w zależności od kontekstu logu
  function selectSourceIp(plant, evt){
    // Jeśli ręcznie podano source_ip w evt → użyj
    if (evt && evt.source_ip) return evt.source_ip;

    const et = evt && evt.event_type || '';
    // kilka przykładów:
    if (et.startsWith('auth.') || et.includes('bruteforce')) {
      // brute-force, loginy → częściej z zewnątrz
      return externalIp();
    }
    if (et.startsWith('ransom.') || et.startsWith('exfil.') || et.includes('malware')) {
      // ransomware / exfil może lecieć na zewnątrz
      return externalIp();
    }
    if (et.includes('sensor') || et.includes('telemetry') || et.includes('scada')) {
      // telemetria / PLC / SCADA → wewnętrzna sieć OT
      return internalIpForPlant(plant);
    }
    // domyślnie: wewnętrzna korpo/OT
    return internalIpForPlant(plant);
  }
  
function msg(et, comp, sev){
    switch(et){
      case "auth.failure": return `Failed login on ${comp} from ${ip()} (${randChoice(["invalid password","unknown user","expired"])})`;
      case "sensor.out_of_range": return `Sensor out of range on ${comp}: value=${(Math.random()*200-50).toFixed(2)}`;
      case "malware.hash_detected": return `YARA match: hash=${Math.random().toString(16).slice(2,10)} severity=${sev}`;
      case "config.change": return `Config changed on ${comp} by ${randChoice(["operator","svc","engineer"])}`;
      case "network.anomaly": return `Traffic spike on ${comp}; pps=${randInt(2000,20000)}`;
      case "backup.failed": return `Backup failed on ${comp}: I/O error code=${randInt(100,999)}`;
      default: return `${et} on ${comp}`;
    }
  }
  function bumpTimeline(ts){
    const m = Math.floor(ts/60000);
    const t = state.stats.timeline;
    if(!t.length || t[t.length-1].min!==m){ t.push({min:m,count:1}); if(t.length>120) t.splice(0,t.length-120); }
    else t[t.length-1].count++;
  }

  // --- Event generation ---
  function spawnLog(){
    const plant = siteFilter ? (plants.find(p=>p.id===siteFilter)||randChoice(plants)) : randChoice(plants);
    const sev = weightedChoice(sevWeights).sev;
    const et = randChoice(eventTypes);
    const comp = randChoice(components);
    const log = {
      id: (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+"-"+Math.random().toString(36).slice(2)),
      ts: Date.now(),
      plant_id: plant.id, plant_name: plant.name,
      component: comp, event_type: et, severity: sev,
      source_ip: selectSourceIp(plant, { event_type: et }),  // zamiast ip()

      user: Math.random()<0.2 ? randChoice(["operator","scada","svc","engineer","tech"]) : null,
      process: Math.random()<0.3 ? randChoice(["siemens.exe","opc-da","modbusd","collector","fwupd","cm2agent"]) : null,
      message: msg(et, comp, sev),
      correlation_id: Math.random()<0.25 ? ("corr-"+randInt(1000,9999)) : null
    };
    state.logs.push(log); if(state.logs.length>MAX_LOGS) state.logs.splice(0,state.logs.length-MAX_LOGS);
    state.stats.countsBySeverity[sev]++; state.stats.countsByType[et]=(state.stats.countsByType[et]||0)+1; bumpTimeline(log.ts);
    emit('log', log);
    rules(log);
  }
  // --- Manual log injection (for game events) ---
  function addLog(partial){
    partial = partial || {};

    const plantsList = plants && plants.length ? plants : state.plants || [];
    let plant = null;

    // 1) jeśli podano plant_id -> spróbuj dopasować
    if (partial.plant_id) {
      plant = plantsList.find(p => p.id === partial.plant_id) || null;
    }

    // 2) jeśli nie znaleziono, użyj aktywnego filtra lub losowego
    if (!plant) {
      if (siteFilter) {
        plant = plantsList.find(p => p.id === siteFilter) || null;
      }
      if (!plant && plantsList.length) {
        plant = randChoice(plantsList);
      }
    }

    const sev = partial.severity   || 'info';
    const et  = partial.event_type || 'custom.event';
    const comp = partial.component || 'SOC';

    const log = {
      id: (typeof crypto!=='undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Date.now() + "-" + Math.random().toString(36).slice(2)),
      ts: partial.ts || Date.now(),

      plant_id:   plant ? plant.id   : (partial.plant_id   || 'global'),
      plant_name: plant ? plant.name : (partial.plant_name || partial.plant_id || 'Global'),

      component: comp,
      event_type: et,
      severity: sev,

      // ⬇️ TU kluczowa zmiana: używamy selectSourceIp
      source_ip: selectSourceIp(plant, partial),

      user:    (typeof partial.user    === 'undefined') ? null : partial.user,
      process: (typeof partial.process === 'undefined') ? null : partial.process,

      message: partial.message || msg(et, comp, sev),
      correlation_id: partial.correlation_id || null
    };

    state.logs.push(log);
    if (state.logs.length > MAX_LOGS) {
      state.logs.splice(0, state.logs.length - MAX_LOGS);
    }

    state.stats.countsBySeverity[sev] =
      (state.stats.countsBySeverity[sev] || 0) + 1;
    state.stats.countsByType[et] =
      (state.stats.countsByType[et] || 0) + 1;

    bumpTimeline(log.ts);
    emit('log', log);
    rules(log);

    return log;
  }


  // --- Simple detection rules -> alerts ---
  function rules(log){
    // R1: 5 auth failures from same /24 in 60s -> HIGH
    if(log.event_type==="auth.failure"){
      const cutoff = log.ts-60000;
      const subnet = log.source_ip.split('.').slice(0,3).join('.');
      const recent = state.logs.filter(l => l.ts>=cutoff && l.plant_id===log.plant_id && l.event_type==="auth.failure" && l.source_ip.startsWith(subnet+"."));
      if(recent.length>=5){ createAlert({ plant_id:log.plant_id, severity:"high", title:"Multiple auth failures", summary:`≥5 failures in 60s from ${subnet}.0/24 at ${log.plant_name}`, type:"bruteforce", evidence_ids: recent.slice(-5).map(l=>l.id) }); }
    }
    // R2: malware -> CRITICAL (dedupe while unresolved)
    if(log.event_type==="malware.hash_detected"){
      const dup = state.alerts.find(a=>a.type==="malware" && a.plant_id===log.plant_id && a.status!=="resolved");
      if(!dup){ createAlert({ plant_id:log.plant_id, severity:"critical", title:"Malware signature detected", summary:`YARA match at ${log.plant_name} (${log.component})`, type:"malware", evidence_ids:[log.id] }); }
    }
    // R3: 3 sensor out-of-range in 30s -> MEDIUM
    if(log.event_type==="sensor.out_of_range"){
      const cutoff = log.ts-30000;
      const recent = state.logs.filter(l => l.ts>=cutoff && l.plant_id===log.plant_id && l.event_type==="sensor.out_of_range");
      if(recent.length>=3){ createAlert({ plant_id:log.plant_id, severity:"medium", title:"Sensor anomalies burst", summary:`≥3 out-of-range in 30s at ${log.plant_name}`, type:"sensor-anomaly", evidence_ids: recent.slice(-3).map(l=>l.id) }); }
    }
  }

  function createAlert(p){
    const plant = plants.find(x=>x.id===p.plant_id);
    const alert = {
      id: (typeof crypto!=='undefined' && crypto.randomUUID) ? crypto.randomUUID() : ("al-"+Date.now().toString(36)+Math.random().toString(36).slice(2)),
      created_at: Date.now(), updated_at: Date.now(),
      status:"new", assigned_to:null,
      plant_id: p.plant_id, plant_name: plant ? plant.name : p.plant_id,
      severity: p.severity||"medium", title: p.title||"Alert", summary: p.summary||"",
      type: p.type||"generic", evidence_ids: p.evidence_ids||[]
    };
    state.alerts.push(alert); if(state.alerts.length>MAX_ALERTS) state.alerts.splice(0,state.alerts.length-MAX_ALERTS);
    emit('alert', alert); emit('update', {alerts:true}); return alert;
  }
BlueData.createAlert = createAlert;
  BlueData.addLog = addLog;

  // --- Alert lifecycle API ---
  BlueData.acknowledgeAlert = function(id){ const a = state.alerts.find(x=>x.id===id); if(a && a.status!=="resolved"){ a.status = (a.status==="new"?"acknowledged":a.status); a.updated_at=Date.now(); emit('update',{alerts:true}); } };
  BlueData.resolveAlert     = function(id){ const a = state.alerts.find(x=>x.id===id); if(a){ a.status="resolved"; a.updated_at=Date.now(); emit('update',{alerts:true}); } };
  BlueData.assignAlert      = function(id,who){ const a = state.alerts.find(x=>x.id===id); if(a){ a.assigned_to = who||"operator"; if(a.status==="new") a.status="investigating"; a.updated_at=Date.now(); emit('update',{alerts:true}); } };

  BlueData.setSiteFilter = function(plantIdOrNull){ siteFilter = plantIdOrNull||null; emit('update',{filter:true}); };

  // --- Queries ---
  BlueData.getLogs = function({plant_id=null, severity=null, limit=500, since_ms=null}={}){
    let arr = state.logs;
    if(plant_id) arr = arr.filter(l=>l.plant_id===plant_id);
    if(severity) arr = arr.filter(l=>l.severity===severity);
    if(since_ms){ const cut = Date.now()-since_ms; arr = arr.filter(l=>l.ts>=cut); }
    return arr.slice(-limit);
  };
  BlueData.getAlerts = function({plant_id=null, status=null, limit=200}={}){
    let arr = state.alerts;
    if(plant_id) arr = arr.filter(a=>a.plant_id===plant_id);
    if(status)   arr = arr.filter(a=>a.status===status);
    return arr.slice().sort((a,b)=>b.updated_at-a.updated_at).slice(0,limit);
  };
  BlueData.getStats = function(){ return JSON.parse(JSON.stringify(state.stats)); };
  BlueData.getPlants = function(){ return plants.slice(); };

  // --- Start/Stop ---
  BlueData.start = function(){
    if(timer) return;
    function tick(){
      const interval = Math.max(120, 60000/Math.max(1,epm));
      const burst = Math.random()<0.12 ? 2 : 1;
      for(let i=0;i<burst;i++) spawnLog();
      emit('tick',{now:Date.now()});
      timer = setTimeout(tick, interval);
    }
    tick();
  };
  BlueData.stop = function(){ if(timer){ clearTimeout(timer); timer=null; } };
  BlueData.setRate = function(n){ epm = Math.max(1, n|0); if(timer){ BlueData.stop(); BlueData.start(); } };

  window.BlueData = BlueData;
  loadPlants();
})();
