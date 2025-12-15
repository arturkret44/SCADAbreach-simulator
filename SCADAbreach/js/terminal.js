// js/terminal.js — modified: builds hidden /home/user/.data with plant dirs from data/plants.json
(function(){
  const body = document.getElementById('terminal-body');
  const input = document.getElementById('terminal-input');

  if(!body || !input){
    return;
  }

  const history = [];
  let histIdx = -1;

  /********** Simple in-memory filesystem **********/
  const root = {
    type: 'dir',
    name: '/',
    parent: null,
    children: {
      'home': { type: 'dir', name: 'home', parent: null, children: {} },
      'etc' : { type: 'dir', name: 'etc', parent: null, children: {} },
      'var' : { type: 'dir', name: 'var', parent: null, children: {} },
      'tmp' : { type: 'dir', name: 'tmp', parent: null, children: {} },
      'README.txt': { type: 'file', name: 'README.txt', parent: null, content: 'Looking for hints?\nSorry, this place is completely dry.\n' }
    }
  };
  // set parents and a default home file
  root.children.home.parent = root;
  root.children.etc.parent = root;
  root.children.var.parent = root;
  root.children.tmp.parent = root;
  root.children['README.txt'].parent = root;
root.children.home.children.admin = { type:'dir', name:'admin', parent: root.children.home, children: {} };
root.children.home.children.admin.children['.bashrc'] = { type:'file', name:'.bashrc', parent: root.children.home.children.admin, content: 'export PATH=/usr/bin:/bin\n' };
let cwd = root.children.home.children.admin; // starting cwd
let username = 'admin';
  const hostname = 'simbox';

// stan: czy mamy „root shell” (symulacja)
let __isRoot = false;
function currentUser(){
  if (__isRoot) return 'root';
  if (window.__currentUserOverride) return window.__currentUserOverride;
  return username; // domyślny (admin)
}
function promptChar(){ return __isRoot ? '#' : '$'; }
// --- Permission helpers: owner + simple mode (owner/others) ---
function pathToNode(p){
  if(!p) return null;
  try { return resolvePath(p); } catch(e){ return null; }
}

// Ustaw metadane (owner, mode) na istniejącym node
function setNodeMeta(path, meta){
  const n = pathToNode(path);
  if(!n) return false;
  n.owner = meta.owner || n.owner || 'root';
  n.mode  = meta.mode  || n.mode  || '0755'; // string like '0755'
  return true;
}

// op: 'r' (read), 'w' (write/create), 'x' (enter dir)
function canAccessNode(node, op){
  // root bypass
  if(__isRoot) return true;
  const caller = currentUser();

  // if node doesn't have metadata -> allow (backward compat)
  if(!node) return false;
  const mode = (node.mode || '0755').toString();
  const owner = node.owner || 'root';

  // owner check
  if(caller === owner) return true;

  // convert mode string -> others bits (last digit)
  let othersDigit = 7;
  try { othersDigit = parseInt(mode.slice(-1), 8); } catch(e){ othersDigit = 7; }

  // map op to bit
  const bit = (op === 'r') ? 4 : (op === 'w') ? 2 : (op === 'x') ? 1 : 0;
  return (othersDigit & bit) === bit;
}

// wrapper for path -> check existence and permission
function canAccess(path, op){
  const node = pathToNode(path);
  if(!node) return false;
  return canAccessNode(node, op);
}

// --- helper: przełącz nie-root user (używane przez zewnętrzne moduły)
window.SimTerm = window.SimTerm || {};
/**
 * switchToUser(name, preferredHome)
 * - name: string, np. 'www-data'
 * - preferredHome: string|null, np. 'admin' -> /home/admin; null = brak home -> ustaw /var/www || /
 */
window.SimTerm.switchToUser = function(name, preferredHome){
  try{
    // zawsze schodzimy z roota i czyścimy override po ewentualnym 'su'
    __isRoot = false;
    window.__currentUserOverride = undefined;

    // ustaw nazwę użytkownika (używana w whoami, prompt, itp.)
    username = String(name || 'player');

    // ustaw nowe cwd: preferowane home jeśli istnieje, inaczej /var/www jeśli jest, inaczej /
    const tryPaths = [];
    if (preferredHome) tryPaths.push('/home/' + preferredHome);
    tryPaths.push('/var/www');
    tryPaths.push('/');

    for(const p of tryPaths){
      const node = resolvePath(p);
      if(node && node.type === 'dir'){
        cwd = node;
        break;
      }
    }

    // odśwież prompt natychmiast (bez echo komendy)
    renderPrompt('');
  }catch(e){
    // ignore
  }
};


// Prosty magazyn haseł (symulacja)
// null => konto zablokowane do su (np. systemowe www-data)
window.__passwd = window.__passwd || {
  admin: 'Adm1n@ctf2025!',   // domyślne hasło do admin w symulacji
  root:  'r8F!zK2#QmV9p$eL'
};
window.__passwd['www-data'] = null; // brak logowania (typowe konto systemowe)


  // --- Path aliasing: keep old /home/user working, but store under /home/admin
  const LEGACY_HOME = '/home/user';
  const REAL_HOME   = '/home/admin';
  function normalizePath(p){
    if (!p) return p;
    // tylko pełne prefiksy /home/user -> /home/admin
    return p.startsWith(LEGACY_HOME) ? (REAL_HOME + p.slice(LEGACY_HOME.length)) : p;
  }


function resolvePath(pathStr){
pathStr = normalizePath(pathStr);
    if(!pathStr) return cwd;
    const parts = pathStr.split('/').filter(Boolean);
    let node = pathStr.startsWith('/') ? root : cwd;
    for(const p of parts){
      if(p === '.') continue;
      if(p === '..'){
        node = node.parent || node;
        continue;
      }
      if(node.type !== 'dir') return null;
      node = node.children[p];
      if(!node) return null;
    }
    return node;
  }

  function ensureParent(pathStr){
pathStr = normalizePath(pathStr);
    // returns {parentNode, name} or null
    const cleaned = pathStr.replace(/\/+$/,'');
    const idx = cleaned.lastIndexOf('/');
    let parentPath = idx === -1 ? '' : cleaned.slice(0, idx+1);
    let name = idx === -1 ? cleaned : cleaned.slice(idx+1);
    let parentNode = parentPath === '' ? cwd : resolvePath(parentPath);
    if(!parentNode || parentNode.type !== 'dir') return null;
    return { parentNode, name };
  }

function createDirPath(path){
  path = normalizePath(path);
  if(!path) return null;
  const parts = path.split('/').filter(Boolean);
  let node = path.startsWith('/') ? root : cwd;
  for(const p of parts){
    if(!node.children[p]){
      const nd = { type:'dir', name: p, parent: node, children: {} };
      // default meta: owner=root, mode=0755
      nd.owner = node.owner || 'root';
      nd.mode = '0755';
      node.children[p] = nd;
    }
    node = node.children[p];
    if(node.type !== 'dir') return null;
  }
  return node;
}

function writeFile(path, content){
  path = normalizePath(path);
  const ep = ensureParent(path);
  if(!ep) return null;
  let node = resolvePath(path);
  if(!node){
    // create file node
    node = { type:'file', name: ep.name, parent: ep.parentNode, content: String(content || '') };
    // inherit owner from parent dir (real linux: created by uid of creator; here approximate)
    node.owner = (ep.parentNode && ep.parentNode.owner) ? ep.parentNode.owner : 'root';
    node.mode = '0644';
    ep.parentNode.children[ep.name] = node;
  } else {
    node.content = String(content || '');
  }
  return node;
}

  // expose minimal API so other modules can add files/dirs if needed
  window.SimFS = window.SimFS || {};
  window.SimFS.createDirPath = createDirPath;
  window.SimFS.writeFile = writeFile;
  window.SimFS.resolvePath = resolvePath;

  // --- Seed minimalny FHS w / (katalogi i parę plików) ---
  function seedFHS(){
    const dirs = [
      'bin','sbin','lib','lib64','usr','usr/bin','usr/sbin','usr/lib',
      'etc','dev','proc','sys','run','mnt','media','opt','srv',
      'var','var/log','var/tmp','home','root','boot','usr/local','usr/local/bin','etc/sudoers.d','var/backups','var/www',
    ];
    dirs.forEach(d => createDirPath('/' + d));

    // Minimalne pliki identyfikujące system
    writeFile('/etc/os-release',
      'NAME="Debian GNU/Linux"\n' +
      'VERSION="12 (bookworm)"\n' +
      'ID=debian\n' +
      'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\n'
    );
    writeFile('/etc/hostname', (typeof hostname !== 'undefined' ? hostname : 'simbox') + '\n');
    writeFile('/etc/issue', 'Debian GNU/Linux 12 \\n \\l\n');

    // Users & groups 
writeFile('/etc/passwd',
  'root:x:0:0:root:/root:/bin/bash\n' +
  'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n' +
  'bin:x:2:2:bin:/bin:/usr/sbin/nologin\n' +
  'sys:x:3:3:sys:/dev:/usr/sbin/nologin\n' +
  'sync:x:4:65534:sync:/bin:/bin/sync\n' +
  'games:x:5:60:games:/usr/games:/usr/sbin/nologin\n' +
  'man:x:6:12:man:/var/cache/man:/usr/sbin/nologin\n' +
  'lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin\n' +
  'mail:x:8:8:mail:/var/mail:/usr/sbin/nologin\n' +
  'news:x:9:9:news:/var/spool/news:/usr/sbin/nologin\n' +
  'uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin\n' +
  'proxy:x:13:13:proxy:/bin:/usr/sbin/nologin\n' +
  'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n' +
  'backup:x:34:34:backup:/var/backups:/usr/sbin/nologin\n' +
  'list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin\n' +
  'irc:x:39:39:ircd:/var/run/ircd:/usr/sbin/nologin\n' +
  'gnats:x:41:41:Gnats Bug-Reporting System:/var/lib/gnats:/usr/sbin/nologin\n' +
  'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n' +
  'systemd-network:x:100:102:systemd Network Management:/run/systemd:/usr/sbin/nologin\n' +
  'systemd-resolve:x:101:103:systemd Resolver:/run/systemd:/usr/sbin/nologin\n' +
  'syslog:x:102:104:syslog:/home/syslog:/usr/sbin/nologin\n' +
  'messagebus:x:103:105:messagebus:/var/run/dbus:/usr/sbin/nologin\n' +
  '_apt:x:104:65534::/nonexistent:/usr/sbin/nologin\n' +
  'mosquitto:x:105:1883:Mosquitto Broker:/var/lib/mosquitto:/usr/sbin/nologin\n' +
  'postgres:x:106:106:PostgreSQL Server:/var/lib/postgresql:/usr/sbin/nologin\n' +
  'historian:x:107:107:Historian Service:/var/lib/historian:/usr/sbin/nologin\n' +
  'telemetry:x:108:108:Telemetry Worker:/var/lib/telemetry:/usr/sbin/nologin\n' +
  'admin:x:1000:1000:Admin:/home/admin:/bin/bash\n'
);

writeFile('/etc/group',
  'root:x:0:\n' +
  'daemon:x:1:\n' +
  'bin:x:2:\n' +
  'sys:x:3:\n' +
  'adm:x:4:admin\n' +
  'tty:x:5:\n' +
  'disk:x:6:\n' +
  'lp:x:7:\n' +
  'mail:x:8:\n' +
  'news:x:9:\n' +
  'uucp:x:10:\n' +
  'proxy:x:13:\n' +
  'www-data:x:33:www-data\n' +
  'backup:x:34:backup\n' +
  'list:x:38:list\n' +
  'irc:x:39:irc\n' +
  'gnats:x:41:gnats\n' +
  'nobody:x:65534:\n' +
  'systemd-network:x:102:\n' +
  'systemd-resolve:x:103:\n' +
  'syslog:x:104:syslog\n' +
  'messagebus:x:105:messagebus\n' +
  '_apt:x:65534:\n' +
  'mosquitto:x:1883:mosquitto\n' +
  'postgres:x:106:postgres\n' +
  'historian:x:107:historian\n' +
  'telemetry:x:108:telemetry\n' +
  'admin:x:1000:admin\n'
);

// --- sudoers misconfig: player może bez hasła uruchomić backup ---
writeFile('/etc/sudoers.d/backup',
  'admin ALL=(root) NOPASSWD: /usr/local/bin/backup\n'
);

// --- atrapa skryptu backupu (wywołuje tar) ---
writeFile('/usr/local/bin/backup',
  '#!/bin/sh\n' +
  '/bin/tar -czf /var/backups/backup.tgz /etc\n'
);


// opcjonalny „dowód” działania backupu
writeFile('/var/backups/README.txt', 'Backups generated by /usr/local/bin/backup (sim)\n');

// --- PRESEED: utwórz drzewka konfigów usług, żeby było co „utwardzać” ---
createDirPath('/etc/nginx');
createDirPath('/etc/nginx/sites-available');
createDirPath('/etc/nginx/sites-enabled');

createDirPath('/etc/mosquitto');
createDirPath('/etc/mosquitto/conf.d');

createDirPath('/etc/historian');

createDirPath('/var/www/html');

// NGINX (bez tajemnic – zwykłe, czytelne dla wszystkich)
writeFile('/etc/nginx/nginx.conf',
  'user www-data;\n' +
  'events { worker_connections 1024; }\n' +
  'http {\n' +
  '  include /etc/nginx/mime.types;\n' +
  '  include /etc/nginx/sites-enabled/*;\n' +
  '}\n'
);
writeFile('/etc/nginx/sites-available/default',
  'server {\n' +
  '  listen 80 default_server;\n' +
  '  root /var/www/html;\n' +
  '  index index.html;\n' +
  '  server_name _;\n' +
  '  access_log /var/log/nginx/access.log;\n' +
  '  error_log  /var/log/nginx/error.log;\n' +
  '}\n'
);
writeFile('/etc/nginx/sites-enabled/default', '# linked to ../sites-available/default\n');

// MOSQUITTO (plik haseł będzie potem 0600)
writeFile('/etc/mosquitto/mosquitto.conf',
  'listener 1883 0.0.0.0\n' +
  'allow_anonymous false\n' +
  'include_dir /etc/mosquitto/conf.d\n' +
  'log_dest file /var/log/mosquitto/mosquitto.log\n'
);
writeFile('/etc/mosquitto/conf.d/worker.conf',
  '# local telemetry worker (dev)\n' +
  'password_file /etc/mosquitto/worker.pass\n'
);
// Placeholder (i tak zaraz ustawimy 0600)
writeFile('/etc/mosquitto/worker.pass', '# will be restricted by hardening\n');

// HISTORIAN (konfig istnieje – treść zaraz zredagujemy)
writeFile('/etc/historian/config.yml',
  'db:\n' +
  '  url: postgres://localhost:5432/hist\n' +
  '  user: admin\n' +
  '  pass: "Adm1n@ctf2025!"\n' +
  'rotation: daily\n'
);

// WEBROOT (pliki istnieją – .env zaraz schowamy na 0600)
writeFile('/var/www/html/index.html', '<h1>Plant Console</h1>\n');
writeFile('/var/www/html/.env',
  'ADMIN_USER=admin\n' +
  'ADMIN_PASS=Adm1n@ctf2025!\n'
);


// --- Harden all credential-containing files except the single allowed leak ---

// 1) Remove / hide creds from webroot and other configs (overwrite with safe placeholder)
if (resolvePath('/var/www/html/.env')) {
  writeFile('/var/www/html/.env', '## Removed for CTF: secrets hidden\n');
  setNodeMeta('/var/www/html/.env', { owner: 'root', mode: '0600' }); // tylko root
}

if (resolvePath('/etc/mosquitto/worker.pass')) {
  writeFile('/etc/mosquitto/worker.pass', '# credentials removed for CTF\n');
  setNodeMeta('/etc/mosquitto/worker.pass', { owner: 'root', mode: '0600' }); // tylko root
}

// historian config — niech będzie prywatne
if (resolvePath('/etc/historian/config.yml')) {
  writeFile('/etc/historian/config.yml',
    'db:\n' +
    '  url: postgres://localhost:5432/hist\n' +
    '  user: <redacted>\n' +
    '  pass: "<redacted>"\n' +
    'rotation: daily\n'
  );
  setNodeMeta('/etc/historian/config.yml', { owner: 'historian', mode: '0600' });
}

// mqtt worker config — prywatne
if (resolvePath('/etc/mqtt-worker.yml')) {
  writeFile('/etc/mqtt-worker.yml',
    'mqtt:\n' +
    '  host: 127.0.0.1\n' +
    '  port: 1883\n' +
    '  user: <redacted>\n' +
    '  pass: <redacted>\n'
  );
  setNodeMeta('/etc/mqtt-worker.yml', { owner: 'telemetry', mode: '0600' });
}

// 2) Ustaw log historiana jako JEDYNY plik z widocznym leakiem
//    - tu trafia docelowy login/hasło, czytelny dla www-data (0644)
createDirPath('/var/log/historian'); // <-- DODAJ TO

writeFile('/var/log/historian/historian.log',
  `${new Date().toISOString()} connected to postgres as historian\n` +
  `${new Date().toISOString()} connected to postgres as historian\n` +
  `${new Date().toISOString()} NOTICE: rotating historian buffers (size exceeded)\n` +
  `${new Date().toISOString()} WARN: historian cache out of sync (lag=421ms)\n` +
  `${new Date().toISOString()} INFO: ingestion worker #3 restarted (exit=143)\n` +
  `${new Date().toISOString()} NOTE: legacy-db-user=hist_old legacy-db-pass=Password2021  # deprecated\n` +
  `${new Date().toISOString()} NOTE: test-credentials user=t1 pass=1234  # disabled\n` +
  `${new Date().toISOString()} NOTE: vendor-user=plc_team vendor-pass=Qwerty!2022  # access revoked\n` +
  `${new Date().toISOString()} DEBUG: historian.repl: upstream heartbeat miss (cluster=pol-eu-west)\n` +
  `${new Date().toISOString()} DEBUG: historian.repl: resync requested (reason=slot_invalid)\n` +
  `${new Date().toISOString()} DEBUG: replication_slot pol_hist_01 confirmed_restart_lsn=0/C4E29F0\n` +
  `${new Date().toISOString()} TRACE: cfg: /etc/histd.conf → apply override key=db_user value=test_runner\n` +
  `${new Date().toISOString()} TRACE: cfg: /etc/histd.conf → apply override key=db_pass value=TemP-Run-992  # invalid\n` +
  `${new Date().toISOString()} DEBUG: archiver: archived local segment 0000000100000000000000FF\n` +
  `${new Date().toISOString()} DEBUG: archiver: skipping remote sync (mode=readonly)\n` +
  `${new Date().toISOString()} INFO: historian maintenance window scheduled for 2025-12-05 02:00 UTC\n` +
  `${new Date().toISOString()} INFO: NOTICE FOR ADMINS: rotate any non-expiring credentials before year-end\n` +
  `${new Date().toISOString()} AUTH: attempted login using user=steve pass=Aa123456! (rejected)\n` +
  `${new Date().toISOString()} AUTH: attempted login using user=analytics pass=an@lyt1cs (rejected)\n` +
  `${new Date().toISOString()} AUTH: attempted login using user=backup pass=BackUP!!2023 (rejected)\n` +
  `${new Date().toISOString()} METRIC: ingest_rate=423/s window=5s\n` +
  `${new Date().toISOString()} METRIC: avg_processing_latency=182ms\n` +
  `${new Date().toISOString()} INFO: historian scrubber completed (invalid_rows=0)\n` +
  `${new Date().toISOString()} INFO: integrity_check: OK\n` +
  `${new Date().toISOString()} DEBUG: restart requested by systemd (reason=exit-code)\n` +
  `${new Date().toISOString()} DEBUG: systemd: final status MainPID=4733 Result=timeout\n` +
  `${new Date().toISOString()} DEBUG: HISTLOG rotation #12 completed\n` +
  `${new Date().toISOString()} DEBUG: compressing rotated logs (method=zstd19)\n` +
  `${new Date().toISOString()} DEBUG: pg-driver: env override detected: PGUSER=hist_test\n` +
  `${new Date().toISOString()} DEBUG: pg-driver: env override detected: PGPASS=not_used_in_prod  # ignore\n` +
  `${new Date().toISOString()} NOTE: deprecation flags enabled (HIST_USE_V2=1 HIST_ALLOW_LEGACY=0)\n` +
  `${new Date().toISOString()} INFO: historian startup sequence complete (version=3.12.7)\n` +
  `${new Date().toISOString()} INFO: ready for ingest events\n`+
`${new Date().toISOString()} DEBUG: historian.repl: WAL receiver ping latency=38ms\n` +
`${new Date().toISOString()} INFO: timeseries compaction cycle started (policy=v3-tiered)\n` +
`${new Date().toISOString()} INFO: timeseries compaction cycle complete (rewritten=42 blocks)\n` +
`${new Date().toISOString()} DEBUG: retention: evaluated 328 partitions (expired=0)\n` +
`${new Date().toISOString()} DEBUG: retention: next sweep in 180 seconds\n` +
`${new Date().toISOString()} TRACE: histd.filter-engine: rule-set v12 loaded\n` +
`${new Date().toISOString()} TRACE: histd.filter-engine: applying 124 filter rules\n` +
`${new Date().toISOString()} DEBUG: ingestion.pipeline: segment rotated (id=3f22b1)\n` +
`${new Date().toISOString()} DEBUG: ingestion.pipeline: processing lag=212ms\n` +
`${new Date().toISOString()} INFO: cache: warm-up sequence finished (miss=4%)\n` +
`${new Date().toISOString()} DEBUG: cache: current size=214MB peak=224MB\n` +
`${new Date().toISOString()} WARN: cache: unexpected eviction burst detected\n` +
`${new Date().toISOString()} DEBUG: pg-driver: idle connections=4 active=2\n` +
`${new Date().toISOString()} DEBUG: pg-driver: pooled statement reuse ratio=0.87\n` +
`${new Date().toISOString()} INFO: historian.monitor: background vacuum triggered\n` +
`${new Date().toISOString()} INFO: historian.monitor: background vacuum complete\n` +
`${new Date().toISOString()} DEBUG: fsync: sync queue depth=3\n` +
`${new Date().toISOString()} DEBUG: fsync: flushed 118 pages\n` +
`${new Date().toISOString()} DEBUG: fsync: throttle=soft limit applied\n` +
`${new Date().toISOString()} INFO: historian.scheduler: job=prune-old-indices completed\n` +
`${new Date().toISOString()} NOTE: dev-db-user=admin dev-db-pass=Adm1n@ctf2025!\n` +
`${new Date().toISOString()} TRACE: historian.scheduler: evaluating next job in 90s\n` +
`${new Date().toISOString()} INFO: metric: ingestion_rate=402/s window=10s\n` +
`${new Date().toISOString()} INFO: metric: avg_query_latency=24ms\n` +
`${new Date().toISOString()} DEBUG: metric: io_bytes_read=4.3MB io_bytes_write=2.1MB\n` +
`${new Date().toISOString()} DEBUG: metric: wal_bytes_generated=812KB\n` +
`${new Date().toISOString()} WARN: netlink: packet reorder detected (delta=4)\n` +
`${new Date().toISOString()} INFO: netlink: interface eth1 restored carrier\n` +
`${new Date().toISOString()} NOTE: dev-db-user=admin dev-db-pass=Adm1n@ctf2025!\n` +
`${new Date().toISOString()} DEBUG: netlink: interface stats tx=23918 rx=22104 drops=0\n` +
`${new Date().toISOString()} DEBUG: archiver: segment 000000010000000000000100 queued\n` +
`${new Date().toISOString()} DEBUG: archiver: backlog=19 segments threshold=32\n` +
`${new Date().toISOString()} TRACE: archiver: deduplicated 4 WAL blocks\n` +
`${new Date().toISOString()} INFO: storage: volume utilization=71%\n` +
`${new Date().toISOString()} DEBUG: storage: inode usage=12%\n` +
`${new Date().toISOString()} DEBUG: storage: scrub window opened (depth=120 files)\n` +
`${new Date().toISOString()} INFO: storage: scrub cycle complete (corrupt=0)\n` +
`${new Date().toISOString()} DEBUG: syswatch: collector tick (cycle=5s)\n` +
`${new Date().toISOString()} DEBUG: syswatch: cpu_load=0.42 mem_usage=512MB\n` +
`${new Date().toISOString()} DEBUG: syswatch: page_faults_minor=14 major=0\n` +
`${new Date().toISOString()} INFO: historian.alerts: no anomalies detected\n` +
`${new Date().toISOString()} TRACE: historian.alerts: window=300s samples=14502\n` +
`${new Date().toISOString()} DEBUG: historian.buffer: commit pointer advanced\n` +
`${new Date().toISOString()} DEBUG: historian.buffer: flushed 93 records\n` +
`${new Date().toISOString()} TRACE: historian.buffer: compression ratio=1.82x\n` +
`${new Date().toISOString()} DEBUG: historian.query: cache hit (pattern=ts:agg:5m)\n` +
`${new Date().toISOString()} DEBUG: historian.query: fallback to disk for segment=32\n` +
`${new Date().toISOString()} INFO: historian.query: executed batch lookup (rows=812)\n` +
`${new Date().toISOString()} DEBUG: historian.query: execution_time=18ms\n` +
`${new Date().toISOString()} WARN: historian.query: slow query detected (82ms)\n` +
`${new Date().toISOString()} INFO: historian.cluster: node health=green\n` +
`${new Date().toISOString()} DEBUG: historian.cluster: raft heartbeat OK\n` +
`${new Date().toISOString()} DEBUG: historian.cluster: leader=node02 uptime=18d\n` +
`${new Date().toISOString()} INFO: historian.cluster: sync_offset=12ms\n` +
`${new Date().toISOString()} DEBUG: historian.loader: async batch committed\n` +
`${new Date().toISOString()} DEBUG: historian.loader: queued rows=241 remaining=0\n` +
`${new Date().toISOString()} TRACE: historian.loader: checksum validation OK\n` +
`${new Date().toISOString()} DEBUG: historian.api: GET /v1/records?limit=100 (200)\n` +
`${new Date().toISOString()} DEBUG: historian.api: POST /v1/ingest/bulk (202)\n` +
`${new Date().toISOString()} INFO: historian.api: client=10.4.12.8 connected\n` +
`${new Date().toISOString()} DEBUG: historian.api: client=10.4.12.8 disconnected\n`
);

setNodeMeta('/var/log/historian/historian.log', { owner: 'historian', mode: '0644' });

// 3) Upewnij się, że inne logi / pliki konfiguracyjne mają restrykcyjne tryby

setNodeMeta('/etc/nginx/nginx.conf', { owner: 'root', mode: '0644' }); // conf zwykle czytelny, ok
setNodeMeta('/etc/nginx/sites-available/default', { owner: 'root', mode: '0644' });
createDirPath('/var/log/nginx');
writeFile('/var/log/nginx/access.log.1', '');
setNodeMeta('/var/log/nginx/access.log.1', { owner: 'www-data', mode: '0640' }); // dostęp zależny od potrzeby

// 4) sprawdź w konsoli symulacji - debug helper
try {
  // not necessary in production; helpful while editing
  // Term.print && Term.print('[CTF] credential leak is only in /var/log/historian/historian.log');
} catch(e){}


    // Proste atrapy /proc (statyczne — to tylko symulacja)
    createDirPath('/proc');
    writeFile('/proc/cpuinfo',
      'processor\t: 0\n' +
      'model name\t: CPU\n' +
      'cpu MHz\t\t: 2400.00\n'
    );
    writeFile('/proc/meminfo',
      'MemTotal:       16384256 kB\n' +
      'MemFree:        12345678 kB\n'
    );

    // Domowe root’a i profil
    writeFile('/root/.bashrc', 'export PATH=/usr/bin:/bin\n');
// Mała nagroda dla gracza, który zdobył roota
writeFile('/root/CONGRATS.txt',
  'Wow. You made it to /root.\n' +
  'Congratulations, you obtained a root shell.\n' +
  '\n' +
  'Remember: in real environments, this level of access means TOTAL control.\n' +
  'Treat it with respect. :)\n'
);

// tylko root może czytać
setNodeMeta('/root/CONGRATS.txt', { owner: 'root', mode: '0600' });

    // Atrapy binarek (pliki placeholder, żeby ls/ktoś widział sensowny układ)
    ['bash','sh','ls','cat','ps','kill','grep','find','curl','wget','tar','chmod','chown','mkdir','rm','mv','cp','touch'].forEach(n => {
      writeFile('/bin/' + n, '(binary placeholder)\n');
    });
    ['systemctl','journalctl'].forEach(n => {
      writeFile('/usr/bin/' + n, '(binary placeholder)\n');
    });
// --- Set realistic owners/modes for sensitive paths (security simulation) ---
setNodeMeta('/root', { owner: 'root', mode: '0700' });
setNodeMeta('/home/admin', { owner: 'admin', mode: '0700' });
setNodeMeta('/home', { owner: 'root', mode: '0755' });
setNodeMeta('/var/www', { owner: 'www-data', mode: '0755' });
setNodeMeta('/etc', { owner: 'root', mode: '0755' });
setNodeMeta('/etc/passwd', { owner: 'root', mode: '0644' });
setNodeMeta('/etc/sudoers.d', { owner: 'root', mode: '0750' });
setNodeMeta('/etc/sudoers.d/backup', { owner: 'root', mode: '0640' });
setNodeMeta('/var/backups', { owner: 'root', mode: '0755' });
setNodeMeta('/home/admin/.bashrc', { owner: 'admin', mode: '0644' });
}

  /********** UI helpers **********/
  function print(line = '', cls = '') {
    const el = document.createElement('div');
    if(cls) el.className = cls;
    el.textContent = line;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }
  function printHTML(html){
    const el = document.createElement('div');
    el.innerHTML = html;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }
  function clear(){
    body.innerHTML = '';
  }
let __lastPromptEl = null;

function renderPrompt(cmdText = '') {
  // zbuduj aktualny cwd
  const parts = [];
  let cur = cwd;
  while (cur && cur !== root) { parts.unshift(cur.name); cur = cur.parent; }
  const cwdStr   = '/' + parts.join('/');
  const basePrompt = `${currentUser()}@${hostname}:${cwdStr}${promptChar()} `;
  const fullLine   = basePrompt + (cmdText || '');

  let el = __lastPromptEl;

  // jeśli już mamy pusty prompt po 'clear', uaktualnij go zamiast tworzyć nowy
  if (el) {
    el.textContent = fullLine;
  } else {
    el = document.createElement('div');
    el.textContent = fullLine;
    el.className = 'prompt';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    __lastPromptEl = el;
  }

  // === aktualizuj widoczny prompt w dolnym pasku ===
  const promptSpan = document.querySelector('.terminal-input .prompt');
  if (promptSpan) {
    promptSpan.textContent = basePrompt;   // zamiast samego "$"
  }

  // input nie musi mieć paddingu – prompt jest w osobnym <span>
  if (input) {
    input.style.paddingLeft = '0px';
  }

  return el;
}

  /********** Command implementations **********/
function cmd_clear(){
  clear();           // czyści ekran
  __lastPromptEl = null;   // stary prompt zniknął z DOM
  renderPrompt('');        // narysuj nowy pusty prompt
}
function cmd_help(){
  print('Available commands:');
  const cmds = [
    // terminal / info
    'help, man',
    'clear',
    'history',

    // file system
    'ls, ls -la',
    'pwd',
    'cd <dir>',
    'cat <file>',
    'echo <text> [> file | >> file]',
    'touch <file>',
    'mkdir <dir>',
    'rm <file|dir> [-r]',
    'cp <src> <dst>',
    'mv <src> <dst>',

    // text processing
    'head <file>',
    'tail <file>',
    'grep <pattern> <file>',
    'find <path> -name <pattern>',

    // users / privilege
    'whoami',
    'id',
    'passwd <user> <newpass>',
    'su <user> <password>',
    'sudo <cmd>',

    // system info
    'uname [-a]',
    'date',
    'cal',

    // processes / network (fake but functional output)
    'ps',
    'kill <pid>',
    'ping <host>',
    'netstat'
   
  ];

  cmds.forEach(c => print('  ' + c));
}

  function listDir(node, flags = {}){
    if(node.type !== 'dir') { print(`ls: not a directory: ${node.name}`); return; }
    const names = Object.keys(node.children).sort();
    if(flags.long){
      names.forEach(n => {
        const it = node.children[n];
        const t = it.type === 'dir' ? 'd' : '-';
        const size = it.type === 'file' ? String((it.content||'').length).padStart(6,' ') : '     -';
        print(`${t}rw-r--r-- 1 ${username} ${username} ${size} Jan 1 00:00 ${n}`);
      });
   } else {
      print(names.join('  '));
    }
  }

function cmd_ls(args){
  const flags = {};
  const paths = [];
  for(const a of args){
    if(a === '-l' || a === '-la' || a === '-al'){
      flags.long = true; flags.all = true;
    }
    else if(a === '-a'){ flags.all = true; }
    else paths.push(a);
  }

  function listDirFiltered(node, nodePath){
    if(node.type !== 'dir'){ print(`ls: not a directory: ${node.name}`); return; }

    // permission: need 'x' to enter dir and 'r' to list
    if(!canAccessNode(node, 'x') || !canAccessNode(node, 'r')) { print(`ls: cannot open directory '${nodePath}': Permission denied`); return; }

    let names = Object.keys(node.children).sort();
    if(!flags.all){
      names = names.filter(n => !n.startsWith('.'));
    }
    if(flags.long){
      names.forEach(n => {
        const it = node.children[n];
        const t = it.type === 'dir' ? 'd' : '-';
        const size = it.type === 'file' ? String((it.content||'').length).padStart(6,' ') : '     -';
        const owner = it.owner || 'root';
        print(`${t}rw-r--r-- 1 ${owner} ${owner} ${size} Jan 1 00:00 ${n}`);
      });
    } else {
      print(names.join('  '));
    }
  }

  if(paths.length === 0) listDirFiltered(cwd, '.');
  else {
    for(const p of paths){
      const node = resolvePath(p);
      if(!node){ print(`ls: cannot access '${p}': No such file or directory`); continue; }
      if(node.type === 'dir'){
        print(`${p || '.'}:`);
        listDirFiltered(node, p || '.');
      } else {
        // file permission
        if(!canAccessNode(node, 'r')) { print(`ls: cannot access '${p}': Permission denied`); continue; }
        print(node.name);
      }
    }
  }
}

  function cmd_pwd(){ 
    // construct path from cwd
    let parts = [];
    let cur = cwd;
    while(cur && cur !== root){
      parts.unshift(cur.name);
      cur = cur.parent;
    }
    print('/' + parts.join('/'));
  }

function cmd_cd(args){
  const target = args[0] || '/home/admin';
  const node = resolvePath(target);
  if(!node || node.type !== 'dir'){ print(`bash: cd: ${target}: No such file or directory`); return; }
  // need 'x' permission to enter
  if(!canAccessNode(node, 'x')) { print(`bash: cd: ${target}: Permission denied`); return; }
  cwd = node;
}

function cmd_cat(args){
  if(args.length === 0){ print(''); return; }
  for(const p of args){
    const node = resolvePath(p);
    if(!node){ print(`cat: ${p}: No such file or directory`); continue; }
    if(node.type === 'dir'){ print(`cat: ${p}: Is a directory`); continue; }
    if(!canAccessNode(node, 'r')){ print(`cat: ${p}: Permission denied`); continue; }
    print(node.content || '');
  }
}

  function cmd_echo(args, raw){
    if(args.length === 0){ print(''); return; }
    // handle redirection > and >>
    const joined = args.join(' ');
    const m = joined.match(/(.*)\s(>>?)\s(.+)$/);
    if(m){
      const text = m[1];
      const op = m[2];
      const target = m[3];
      const destNode = resolvePath(target);
      if(op === '>' ){
        // overwrite or create
        const ep = ensureParent(target);
        if(!ep){ print(`bash: ${target}: No such file or directory`); return; }
        let node = destNode;
        if(!node){
          // create
          node = { type:'file', name: ep.name, parent: ep.parentNode, content: '' };
          ep.parentNode.children[ep.name] = node;
        }
        node.content = text + '\n';
      } else { // >>
        const ep = ensureParent(target);
        if(!ep){ print(`bash: ${target}: No such file or directory`); return; }
        let node = destNode;
        if(!node){
          node = { type:'file', name: ep.name, parent: ep.parentNode, content: '' };
          ep.parentNode.children[ep.name] = node;
        }
        node.content = (node.content || '') + text + '\n';
      }
      return;
    }
    print(raw || args.join(' '));
  }

  function cmd_touch(args){
    if(args.length === 0) return;
    for(const p of args){
      const ep = ensureParent(p);
      if(!ep){ print(`touch: cannot touch '${p}': No such file or directory`); continue; }
      let node = resolvePath(p);
      if(!node){
        node = { type:'file', name: ep.name, parent: ep.parentNode, content: '' };
        ep.parentNode.children[ep.name] = node;
      } else {
        if(node.type === 'dir') { print(`touch: cannot touch '${p}': Is a directory`); continue; }
        // update mtime - ignored in this sim
      }
    }
  }

  function cmd_mkdir(args){
    if(args.length === 0){ print('mkdir: missing operand'); return; }
    for(const p of args){
      const ep = ensureParent(p);
      if(!ep){ print(`mkdir: cannot create directory '${p}': No such file or directory`); continue; }
      if(ep.parentNode.children[ep.name]) { print(`mkdir: cannot create directory '${p}': File exists`); continue; }
      const node = { type:'dir', name: ep.name, parent: ep.parentNode, children: {} };
      ep.parentNode.children[ep.name] = node;
    }
  }

  function rmRecursive(node){
    if(node.type === 'file'){ delete node.parent.children[node.name]; return; }
    // dir
    for(const k of Object.keys(node.children)){
      rmRecursive(node.children[k]);
    }
    delete node.parent.children[node.name];
  }

  function cmd_rm(args){
    if(args.length === 0){ print('rm: missing operand'); return; }
    const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr');
    const targets = args.filter(a => !a.startsWith('-'));
    for(const t of targets){
      const node = resolvePath(t);
      if(!node){ print(`rm: cannot remove '${t}': No such file or directory`); continue; }
      if(node.type === 'dir' && !recursive){ print(`rm: cannot remove '${t}': Is a directory`); continue; }
      rmRecursive(node);
    }
  }

  function copyNode(srcNode, destParent, destName){
    if(srcNode.type === 'file'){
      destParent.children[destName] = { type:'file', name: destName, parent: destParent, content: srcNode.content };
    } else {
      const newDir = { type:'dir', name: destName, parent: destParent, children: {} };
      destParent.children[destName] = newDir;
      for(const k of Object.keys(srcNode.children)){
        copyNode(srcNode.children[k], newDir, srcNode.children[k].name);
      }
    }
  }

  function cmd_cp(args){
    if(args.length < 2){ print('cp: missing file operand'); return; }
    const src = args[0], dst = args[1];
    const srcNode = resolvePath(src);
    if(!srcNode){ print(`cp: cannot stat '${src}': No such file or directory`); return; }
    const destNode = resolvePath(dst);
    const ep = ensureParent(dst);
    if(destNode && destNode.type === 'dir'){
      // copy into directory
      copyNode(srcNode, destNode, srcNode.name);
    } else if(ep){
      // copy to path (create/overwrite)
      copyNode(srcNode, ep.parentNode, ep.name);
    } else {
      print(`cp: cannot create regular file '${dst}': No such file or directory`);
    }
  }

  function cmd_mv(args){
    if(args.length < 2){ print('mv: missing file operand'); return; }
    const src = args[0], dst = args[1];
    const srcNode = resolvePath(src);
    if(!srcNode){ print(`mv: cannot stat '${src}': No such file or directory`); return; }
    const destNode = resolvePath(dst);
    const ep = ensureParent(dst);
    if(destNode && destNode.type === 'dir'){
      // move into dir
      delete srcNode.parent.children[srcNode.name];
      srcNode.name = srcNode.name;
      srcNode.parent = destNode;
      destNode.children[srcNode.name] = srcNode;
    } else if(ep){
      // move/rename
      delete srcNode.parent.children[srcNode.name];
      srcNode.name = ep.name;
      srcNode.parent = ep.parentNode;
      ep.parentNode.children[ep.name] = srcNode;
    } else {
      print(`mv: cannot move '${src}' to '${dst}'`);
    }
  }

  function cmd_uname(args){
    if(args.includes('-a')) print('Linux ' + hostname + ' 5.10.0 #1 SMP x86_64 GNU/Linux');
    else print('Linux');
  }

function cmd_whoami(){ print(currentUser()); }
 function cmd_id(args){
   const target = (args && args[0]) ? args[0] : currentUser();
   const pw = resolvePath('/etc/passwd');
   if (!pw || pw.type !== 'file') {
     print(`uid=1000(${target}) gid=1000(${target}) groups=1000(${target})`);
     return;
   }
   const line = (pw.content||'').split('\n').find(l => l.startsWith(target + ':'));
   if (!line) {
     print(`id: ${target}: no such user`);
     return;
   }
   const parts = line.split(':'); // name:x:UID:GID:gecos:home:shell
   const uid = parts[2], gid = parts[3];
   print(`uid=${uid}(${target}) gid=${gid}(${target}) groups=${gid}(${target})`);
 }
  function cmd_date(){ print(new Date().toString()); }

  function cmd_cal(){ 
    // simple month calendar (current month)
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const first = new Date(year, month, 1).getDay(); // 0 Sun..6 Sat
    const days = new Date(year, month+1, 0).getDate();
    print(`     ${now.toLocaleString(undefined, {month:'long'})} ${year}`);
    print('Su Mo Tu We Th Fr Sa');
    let line = '';
    for(let i=0;i<first;i++) line += '   ';
    for(let d=1; d<=days; d++){
      line += String(d).padStart(2,' ') + ' ';
      if((first + d) % 7 === 0 || d === days){
        print(line.trimEnd());
        line = '';
      }
    }
  }

  function cmd_history() {
    history.forEach((h,i) => print(`${i+1}  ${h}`));
  }

  function cmd_ps(){ 
    // show some fake processes
    const procs = [
      { pid: 1, cmd: 'init' },
      { pid: 101, cmd: 'bash' },
      { pid: 202, cmd: 'node terminal.js' },
      { pid: 303, cmd: 'sshd' }
    ];
    print('  PID TTY          TIME CMD');
    procs.forEach(p => print(`${String(p.pid).padStart(5,' ')} pts/0    00:00:00 ${p.cmd}`));
  }

  function cmd_kill(args){
    if(args.length === 0){ print('kill: usage: kill <pid>'); return; }
    const pid = parseInt(args[0],10);
    if(isNaN(pid)){ print(`kill: ${args[0]}: arguments must be process or job IDs`); return; }
    print(`Sent SIGTERM to pid ${pid}`); // no real effect
  }

  function cmd_ping(args){
    const host = args[0] || '127.0.0.1';
    print(`PING ${host}: 56 data bytes`);
    for(let i=0;i<4;i++){
      print(`64 bytes from ${host}: icmp_seq=${i+1} ttl=64 time=${(Math.random()*10).toFixed(2)} ms`);
    }
    print('');
    print(`--- ${host} ping statistics ---`);
    print('4 packets transmitted, 4 received, 0% packet loss, time 3001ms');
  }

function cmd_man(args){
  const m = args[0] || 'help';
  const helpText = {
    help:   'help: displays a list of available commands.',
    man:    'man <cmd>: show a short help entry for a command.',

    clear:  'clear: clear the terminal screen.',
    ls:     'ls: lists files in a directory. The -l / -la options show more details.',
    pwd:    'pwd: print the current working directory.',
    cd:     'cd <dir>: change directory.',
    cat:    'cat <file>: print the contents of a file.',
    echo:   'echo: print text. Supports redirection: echo hi > file',
    touch:  'touch <file>: create an empty file or update its timestamp.',
    mkdir:  'mkdir <dir>: create a directory.',
    rm:     'rm <file|dir> [-r]: remove files or directories.',
    cp:     'cp <src> <dst>: copy files or directories.',
    mv:     'mv <src> <dst>: move or rename files or directories.',

    whoami: 'whoami: print the current user name.',
    id:     'id: show user and group IDs.',
    history:'history: show recently entered commands.',

    ps:     'ps: list running processes.',
    kill:   'kill <pid>: send a termination signal to a process.',
    ping:   'ping <host>: send ICMP echo requests.',

    head:   'head <file>: show the first lines of a file.',
    tail:   'tail <file>: show the last lines of a file.',
    grep:   'grep <pattern> <file>: search for lines matching a pattern.',
    find:   'find <path> -name <pattern>: search for files by name.',

    uname:  'uname [-a]: show system information.',
    date:   'date: display the current date and time.',
    cal:    'cal: show a monthly calendar.',

    passwd: 'passwd <user> <newpass>: change the password for a user.',
    su:     'su <user> <password>: switch to another user account.',
    sudo:   'sudo <cmd>: run a command with elevated privileges. Use "sudo -l" to list allowed commands.',

    apt:    'apt: package management utility.',
    yum:    'yum: package management utility.',
  };

  print(helpText[m] || `No manual entry for ${m}`);
}

  function cmd_chmod(args){
    print('chmod: mode changed');
  }
  function cmd_chown(args){
    print('chown: owner changed');
  }
function cmd_passwd(args){
  const caller = currentUser();
  const target = (args && args[0]) ? args[0] : caller;
  const newPass = (args && args[1]) ? args[1] : null;

  if (!newPass){
    print('usage: passwd <user> <newpass>');
    return;
  }

  window.__passwd = window.__passwd || {};

  // 1) www-data nie może zmieniać niczego
  if (caller === 'www-data') {
    print('passwd: Permission denied for www-data');
    return;
  }

  // 2) Tylko root może zmieniać cudze hasła
  if (caller !== 'root' && target !== caller) {
    print('passwd: only root can change passwords for other users');
    return;
  }

  // 3) Rootowe hasło może zmieniać tylko root
  if (target === 'root' && caller !== 'root') {
    print('passwd: Permission denied for root account');
    return;
  }

  // 4) opcjonalnie – jeśli konto ma być zablokowane, nie pozwalaj na zmianę
  if (window.__passwd[target] === null) {
    print(`passwd: account ${target} is locked`);
    return;
  }

  window.__passwd[target] = newPass;
  print(`Password updated for ${target}.`);
}

function cmd_su(args){
  const target = (args && args[0]) ? args[0] : 'root';

  // sprawdź, czy użytkownik istnieje w /etc/passwd
  const pw = resolvePath('/etc/passwd');
  if (!pw || pw.type !== 'file') {
    print('su: cannot access /etc/passwd');
    return;
  }
  const rec = (pw.content || '').split('\n').find(l => l.startsWith(target + ':'));
  if (!rec) {
    print(`su: user ${target} does not exist`);
    return;
  }
  const parts = rec.split(':'); // name:x:UID:GID:gecos:home:shell
  const home  = parts[5] || '/';
  // BLOKADA: tylko root może zrobić su root
  if (target === 'root' && !__isRoot) {
    print('su: permission denied (root login disabled)');
    return;
  }
  // --- WYMAGANIE HASŁA ---
  // jeśli NIE jesteś rootem i chcesz wejść na inne konto -> wymagaj hasła
  let needsPassword = !__isRoot;

  if (needsPassword) {
    // konto zablokowane? (www-data ma null)
    if (window.__passwd && window.__passwd[target] === null){
      print('su: Authentication failure (account locked)');
      return;
    }
    const given = (args && args[1]) ? args[1] : null;
    if (!given){
      print('su: authentication required. Usage: su <user> <password>');
      return;
    }
    const real = window.__passwd ? window.__passwd[target] : undefined;
    if (!real || given !== real){
      print('su: Authentication failure');
      return;
    }
  }

  // --- ZALOGUJ ---
  if (target === 'root') {
    __isRoot = true;
    window.__currentUserOverride = undefined; // root ignoruje override
    print('root shell obtained.');
  } else {
    __isRoot = false;
    window.__currentUserOverride = target;
  }

  // ustaw katalog domowy (jeśli istnieje), inaczej /
  const nextCwd = resolvePath(home) || resolvePath('/') || cwd;
  if (nextCwd && nextCwd.type === 'dir') {
    cwd = nextCwd;
  }

  renderPrompt('');
}

function cmd_sudo(args, rawCmd){
  const u = currentUser(); // 'admin', 'www-data' lub 'root'

  // 1) Blokada sudo dla nie-admina (chyba że już jesteś rootem)
  if (!__isRoot && u !== 'admin') {
    print(`sudo: ${u} is not in the sudoers file. This incident will be reported.`);
    return;
  }

  // 2) Prompt z właściwą nazwą użytkownika
  print(`[sudo] password for ${u}:`);

  const joined = args.join(' ').trim();

  // 3) sudo -l -> pokaż przywileje tylko dla admin/root
  if (args[0] === '-l') {
    print(`Matching Defaults entries for ${u} on ${hostname}:`);
    print('    env_reset, mail_badpass');
    print('');
    print(`User ${u} may run the following commands on ${hostname}:`);
    print('    (root) NOPASSWD: /usr/local/bin/backup');
    return;
  }

  // 4) sudo /usr/local/bin/backup [...]
  if (joined.startsWith('/usr/local/bin/backup')) {
    print('Running backup as root...');

    // exploit: tar --checkpoint-action=exec=/bin/sh => „root shell”
    if (joined.includes('--checkpoint-action=exec=/bin/sh')) {
      __isRoot = true; // mamy „root”
      print('# You got a root shell!');
      // „proof”
      writeFile('/home/admin/root.txt', 'Root access granted via backup exploit\n');
      renderPrompt('');
      return;
    }

    print('Backup created at /var/backups/backup.tgz');
    return;
  }

  // 5) W innym przypadku spróbuj uruchomić przekazaną komendę
  if (args.length) handleCommand(args.join(' '));
}

  function cmd_apt(args){
    print('Reading package lists... Done');
    print('E: Unable to locate package');
  }

  function cmd_git(args){
    print('git: not a git repository. Try "git init" (not implemented).');
  }

  function cmd_curl(args){
    print('curl: try `curl http://example.com` - will not fetch in this demo.');
  }
  function cmd_wget(args){
    print('wget: fetching is disabled in this sandbox.');
  }

function cmd_head(args){
  if(args.length === 0){ print('head: missing file operand'); return; }
  const node = resolvePath(args[0]);
  if(!node || node.type !== 'file'){ print(`head: cannot open '${args[0]}' for reading: No such file`); return; }
  if(!canAccessNode(node, 'r')){ print(`head: cannot open '${args[0]}' for reading: Permission denied`); return; }
  const lines = (node.content || '').split('\n').slice(0,10);
  lines.forEach(l => print(l));
}

function cmd_tail(args){
  if(args.length === 0){ print('tail: missing file operand'); return; }
  const node = resolvePath(args[0]);
  if(!node || node.type !== 'file'){ print(`tail: cannot open '${args[0]}' for reading: No such file`); return; }
  if(!canAccessNode(node, 'r')){ print(`tail: cannot open '${args[0]}' for reading: Permission denied`); return; }
  const lines = (node.content || '').split('\n').slice(-10);
  lines.forEach(l => print(l));
}

function cmd_grep(args){
  if(args.length < 2){ print('grep: missing operand'); return; }
  const pattern = args[0];
  const node = resolvePath(args[1]);
  if(!node || node.type !== 'file'){ print(`grep: ${args[1]}: No such file`); return; }
  if(!canAccessNode(node, 'r')){ print(`grep: ${args[1]}: Permission denied`); return; }
  const re = new RegExp(pattern);
  (node.content||'').split('\n').forEach((l,i) => {
    if(re.test(l)) print(`${i+1}:${l}`);
  });
}
function cmd_find(args){
  // very basic: find <path> -name <pattern>
  if(args.length < 3 || args[1] !== '-name'){ print('find: usage: find <path> -name <pattern>'); return; }
  const start = resolvePath(args[0]);
  if(!start || start.type !== 'dir'){ print('find: path does not exist'); return; }
  // need execute permission to descend
  if(!canAccessNode(start, 'x')) { print('find: path does not exist or permission denied'); return; }

  const pat = args[2].replace(/\*/g, '.*');
  const re = new RegExp('^' + pat + '$');
  const out = [];
  function walk(n, prefix){
    for(const k of Object.keys(n.children)){
      const child = n.children[k];
      const path = prefix + '/' + child.name;
      if(re.test(child.name)) out.push(path);
      if(child.type === 'dir'){
        // only recurse if we can enter that directory
        if(canAccessNode(child, 'x')) walk(child, path);
      }
    }
  }
  walk(start, args[0] === '/' ? '' : (args[0].replace(/\/+$/,'')));
  out.forEach(p => print(p));
}


// --- plugin hook for external commands ---
const __customCmds = {};
window.SimTerm = window.SimTerm || {};
window.SimTerm.register = (name, fn) => { __customCmds[name] = fn; };
window.SimTerm.print = print; // pozwala modułom wypisywać do terminala

// >>> NEW: expose aktualnego usera i informację czy to root
window.SimTerm.getUser = () => currentUser();
window.SimTerm.isRoot  = () => __isRoot === true;

  /********** Command dispatcher **********/
  function handleCommand(inputLine){
    const raw = inputLine;
    const parts = inputLine.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const args = parts.map(p => p.replace(/^"(.*)"$/,'$1'));
    const name = args.shift() || '';
// external command override (from simproc.js)
if (__customCmds[name]) { __customCmds[name](args); return; }

    switch(name){
      case '': return;
      case 'help': cmd_help(); break;
      case 'man': cmd_man(args); break;
      case 'clear': cmd_clear(); break;
      case 'ls': cmd_ls(args); break;
      case 'pwd': cmd_pwd(); break;
      case 'cd': cmd_cd(args); break;
      case 'cat': cmd_cat(args); break;
      case 'echo': cmd_echo(args, raw.replace(/^echo\s*/,'')); break;
      case 'touch': cmd_touch(args); break;
      case 'mkdir': cmd_mkdir(args); break;
      case 'rm': cmd_rm(args); break;
      case 'cp': cmd_cp(args); break;
      case 'mv': cmd_mv(args); break;
      case 'uname': cmd_uname(args); break;
      case 'whoami': cmd_whoami(); break;
      case 'id': cmd_id(); break;
      case 'date': cmd_date(); break;
      case 'cal': cmd_cal(); break;
      case 'history': cmd_history(); break;
      case 'ps': cmd_ps(); break;
      case 'kill': cmd_kill(args); break;
      case 'ping': cmd_ping(args); break;
      case 'chmod': cmd_chmod(args); break;
      case 'chown': cmd_chown(args); break;
      case 'passwd': cmd_passwd(args); break;
      case 'su': cmd_su(args); break;      
      case 'sudo': cmd_sudo(args, raw); break;
      case 'apt':
      case 'apt-get':
      case 'yum': cmd_apt(args); break;
      case 'git': cmd_git(args); break;
      case 'curl': cmd_curl(args); break;
      case 'wget': cmd_wget(args); break;
      case 'head': cmd_head(args); break;
      case 'tail': cmd_tail(args); break;
      case 'grep': cmd_grep(args); break;
      case 'find': cmd_find(args); break;
      default:
        print(`bash: ${name}: command not found. Type "help".`);
    }
  }

  /********** input handling **********/
input.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    const cmd = input.value;

    // 1) Zrób echo starego promptu z wpisaną komendą
    renderPrompt(cmd);
    __lastPromptEl = null;

    if(cmd.trim()){
      history.push(cmd);
      histIdx = history.length;
    }

    // 2) Wykonaj komendę (tu np. cd zmieni cwd)
    try{
      handleCommand(cmd);
    } catch (err){
      print(`Error: ${err.message}`);
    }

    input.value = '';

    // 3) WSTAW NOWY PROMPT z odświeżoną ścieżką / userem
    renderPrompt('');
    } else if(e.key === 'ArrowUp'){
      if(histIdx > 0){
        histIdx--;
        input.value = history[histIdx] || '';
        setTimeout(()=>input.setSelectionRange(input.value.length, input.value.length), 0);
      } else if(histIdx === 0){
        input.value = history[0] || '';
      }
    } else if(e.key === 'ArrowDown'){
      if(histIdx < history.length - 1){
        histIdx++;
        input.value = history[histIdx] || '';
      } else {
        histIdx = history.length;
        input.value = '';
      }
      setTimeout(()=>input.setSelectionRange(input.value.length, input.value.length), 0);
    }
  });

  // --- Load plants.json and create hidden /.data under /home/user with plant dirs ---
// --- Load plants.json and create hidden /.data under /home/user with plant dirs ---
function loadPlantsIntoFS(){
  fetch('data/plants.json')
    .then(r => r.json())
    .then(list => {
      if (!Array.isArray(list)) return;

      // utwórz bazowy katalog
      createDirPath('/home/user/.data');

      list.forEach(p => {
        const id = p.id || (p.country + '-' + (p.name||'').toLowerCase().replace(/\s+/g,'-'));
        const basePath = `/home/user/.data/${id}`;
        createDirPath(basePath);

        // podkatalogi
        createDirPath(`${basePath}/config`);
        createDirPath(`${basePath}/logs`);
        createDirPath(`${basePath}/critical`);

        // pliki
        const info = [
          `name: ${p.name || ''}`,
          `country: ${p.country || ''}`,
          `capacity_gw: ${p.capacity_gw || ''}`,
          `types: ${(p.types||[]).join(', ')}`,
          '',
          (p.description || '').replace(/\n/g, '\\n')
        ].join('\n');
        writeFile(`${basePath}/info.txt`, info);

        const status = `status: nominal\nlast_update: ${new Date().toISOString()}`;
        writeFile(`${basePath}/status.txt`, status);

        // przykładowe pliki w subdirach
        writeFile(`${basePath}/config/default.conf`, `# Default config for ${p.name}`);
        writeFile(`${basePath}/logs/boot.log`, `[${new Date().toISOString()}] Boot sequence OK`);
        writeFile(`${basePath}/critical/README.txt`, `Critical files for ${p.name} – handle with care!`);
      });

writeFile('/home/user/.data/README.txt',
`GRID OPERATIONS – INTERNAL FILES
---------------------------------

This directory stores operational metadata for all power plants connected 
to the continental grid. The files are used by monitoring tools, forecast 
models, and automated dispatch systems.

Most entries contain:
• basic plant descriptors
• generation capacity
• fuel type / grid region
• internal routing identifiers

Do not modify these files manually. Changes propagate instantly across 
live monitoring dashboards.

If you notice inconsistencies or missing data, notify the Shift Lead.
`);

      print('[urgent] Read the email from chief.engineer@australisnova.gov.au.');
    })
    .catch(err => {
      console.warn('Could not load plants.json for SimFS:', err);
    });
}

  // Zasiej standardowy układ katalogów FHS
  seedFHS();


  // Welcome
  print('System online.');
  print('Operator connected.');
  print('Only authorized commands are available in this environment.');
  print('For permissible actions, use: help');


  // attempt to seed plants into FS
  loadPlantsIntoFS();

})();