// js/phish_scenario.js
// Minimalny scenariusz: Australia od razu czerwona, a "pisząca" wiadomość i mail ransom dopiero po spawnRansom.
// Załaduj ten plik PO simproc.js.

(function(){
// global one-shot flag for the recovery guide mail
if (typeof window.__RANSOM_RECOVERY_GUIDE_SENT === 'undefined') {
window.__RANSOM_RECOVERY_GUIDE_SENT = false;
}
  // --- proste "pisanie" do terminala (bez blokowania) ---
  function printTyping(term, text, charDelay = 18, perLineDelay = 220, done){
    if(!term || typeof term.print !== 'function'){ if(done) done(); return; }
    const lines = String(text||'').split('\n');
    let li = 0;
    function typeLine(){
      if(li >= lines.length){ if(done) done(); return; }
      const line = lines[li++], chunkSize = 80;
      let i = 0;
      (function chunk(){
        if(i >= line.length){
          term.print(''); // newline
          setTimeout(typeLine, perLineDelay);
          return;
        }
        const next = Math.min(line.length, i + chunkSize);
        term.print(line.slice(i, next));
        i = next;
        setTimeout(chunk, charDelay);
      })();
    }
    typeLine();
  }

  // --- helpers: lookup plant info + build dynamic news article ---
  function getPlantInfo(plantId){
    const info = {
      id: plantId || 'unknown-site',
      name: plantId || 'Unknown site',
      country: 'Unknown region'
    };
    try{
      const BD = window.BlueData;
      if (BD && typeof BD.getPlants === 'function'){
        const pl = BD.getPlants().find(p => p.id === plantId);
        if (pl){
          info.name = pl.name || info.name;
          info.country = pl.country || pl.country_name || info.country;
        }
      }
    }catch(e){}
    return info;
  }

  // --- templating helper: "Hello {country}" -> podstaw wartości z ctx ---
  function tmpl(str, ctx){
    return String(str || '').replace(/\{(\w+)\}/g, (_, key) => {
      return (key in ctx) ? ctx[key] : '';
    });
  }

  function buildDynamicNews(plantId){
    const p = getPlantInfo(plantId);
    const ctx = {
      plantId: p.id,
      plantName: p.name || plantId || 'the facility',
      country: p.country || 'Poland'
    };

    // weź preset z globalnego obiektu z ransom.news.presets.js
    const presets = window.RANSOM_NEWS_PRESETS || {};
    const preset =
      presets[plantId] ||
      presets["__default__"] || {
        title: "Rolling power outages reported in parts of {country}",
        lead:  "Grid operator reports controlled outages following a disruption at the {plantName} facility.",
        byline: "Reuters • {country}",
        image: "media/news/news_1.png",
        html: ""
      };

    const title  = tmpl(preset.title, ctx);
    const lead   = tmpl(preset.lead, ctx);
    const byline = tmpl(preset.byline || `Reuters • {country}`, ctx);
    const image  = preset.image || 'media/news/news_1.png';

    // upewnij się, że mamy magazyn na pełne artykuły
    window.NewsContent = window.NewsContent || {};

    window.NewsContent[title] = {
      byline,
      html: tmpl(preset.html || '', ctx)
    };

    const isFirstRansomNews = !window.__RANSOM_NEWS_COUNT;
    window.__RANSOM_NEWS_COUNT = (window.__RANSOM_NEWS_COUNT || 0) + 1;

    return {
      title,
      lead,
      category: 'Energy',
      region: ctx.country,
      severity: 'high',
      source: 'Reuters',
      image,
      ts: Date.now(),
      pinned: isFirstRansomNews
    };
  }


  // --- opakuj spawnRansom tak, by dopisać wiadomość, mail okupowy i dodać artykuł do News ---
  function wrapSpawnRansom(){
    if(!window.spawnRansom || window.__PHISH_SCENARIO_WRAPPED) return;
    const orig = window.spawnRansom;

    window.spawnRansom = function(plantId, opts){
      // uruchom oryginał (tworzy ransom-worker i logi)
      try { orig(plantId, opts); } catch(e){ console.error(e); }

// ---- 1) attacker message (typed into terminal) ----
const msg = [
  '',
  '================================================================',
  '>>> KERNELIANS SYSTEM INTERCEPT <<<',
  '',
  'Heh. Good job, genius.',
  'You ran our payload exactly like we hoped.',
  '',
  'Your system coughed, choked, and died.',
  'All core data is locked. Keys? With us.',
  '',
  'If you want your precious controls back,',
  'drop 350 BTC to the route below:',
  '',
  'WALLET:',
  'ORUGS427NFZV62TVON2F65DIMVPWEZLHNFXG42LOM4XA',
  '',
  'Don’t get cute. Don’t get clever.',
  'Every "trick" nukes another chunk of your files.',
  '',
  'Oh, and check your privileges.',
  'Yeah. That’s right. We kicked you down to www-data.',
  'Admin time is over, hero.',
  '',
  'You want the grid back?',
  'Pay up and pray we feel generous.',
  '',
  'In darkness, we equalize.',
  '— KERNELIANS aka Kernel Aliens',
  '================================================================',
  '',
    '',
  '=== INCIDENT BRIEF =============================================',
  '',
  'CURRENT STATUS: You are the last operational SOC defender on the grid.',
  'SCOPE:      40 interconnected power plants across 12 global regions',
  'IMPACT:     Over 2 billion customers relying on continuous supply',
  '',
  '',
  'This is an active cyber-incident affecting critical infrastructure.',
  '',
  'Your objectives:',
  '  • Identify the source of the ransomware event',
  '  • Recover or reconstruct the decryption key (you have 60 minutes, when ready - use command ransom-decrypt <key>)',
  '  • Contain the spread before additional nodes enter CRITICAL state',
  '',
  'Failure to intervene will result in cascading blackouts',
  'and widespread grid instability.',
  '',
  'Proceed with urgency and caution.',
  '=================================================================',
  ''


].join('\n');

      try {
        // po takeover nie drukujemy już per-plant notice
        if (!window.__SUPPRESS_RANSOM_TTY) {
          if (window.SimTerm && typeof window.SimTerm.print === 'function') {
            printTyping(window.SimTerm, msg, 16, 200, function(){
              window.SimTerm.print('[system] connection closed by remote host');
            });
          } else {
            console.warn('ATTACKER MSG:\n' + msg);
          }
        }
      } catch(e) { console.error(e); }

      // ---- 2) wyślij mail ransomowy TYLKO raz i NIE podczas rozprzestrzeniania ----
      try{
        const fromSpread = !!(opts && (opts.fromSpread || opts.spread));
        if (!fromSpread && !window.__RANSOM_RECOVERY_GUIDE_SENT &&
            window.MailApp && typeof window.MailApp.addMail === 'function') {
          window.__RANSOM_RECOVERY_GUIDE_SENT = true;
window.MailApp.addMail({
  id: `mail-soc-critical-${plantId || 'site'}-${Date.now()}`,
  from: 'SOC Duty Team <soc-ops@grid.int>',
  subject: '[Urgent] We saw the same breach message you did',
  snippet: 'We will help as much as we can — search your system immediately.',
  time: new Date().toLocaleTimeString(),
  unread: true,
  starred: true,
  body:
`Operator,

We just received the same takeover message that appeared on your console.
This is no longer a local compromise — it’s spreading across the grid.
Stay focused. We will assist as much as we’re able.

Our window is short. Roughly one hour before they escalate again.
Those bastards always make mistakes under pressure, so there is still a chance
they left something behind on your host.

Here’s what we know so far:

1) A new, unauthorized process spun up at the exact moment
   your session was hijacked. It does not match any internal tools.

2) Something in your local user data changed right before the lockout.
   It’s subtle — almost like a forgotten breadcrumb.

We can’t transmit sensitive details through this channel.
It’s not safe — we have signs they’re moving against the core SOC systems.

Search your machine.
Process list. Hidden files. Anything that wasn’t there before.

If you manage to uncover a decryption key or token,
use the command below:

    ransom-decrypt <key>

We’ll reconnect when we have a secure line.
Hold the line, operator. You’re not alone in this.

— SOC Duty Team`
});

        }
      }catch(e){ console.error(e); }

      // ---- 3) dodaj artykuł do News (dopasowany do atakowanej elektrowni) ----
      try {
        if (window.App && typeof window.App.addNews === 'function') {
          const newsItem = buildDynamicNews(plantId);
          App.addNews(newsItem);

          // upewnij się, że linkify (podpinanie listenerów) wykona się po renderze
          setTimeout(() => {
            try { if (window.NewsLinkify) window.NewsLinkify(); } catch(e) { /* ignore */ }
          }, 0);
        }
      } catch(e){ console.error('addNews failed', e); }

    };

    window.__PHISH_SCENARIO_WRAPPED = true;
  }

  // --- ustawia Australię jako "critical" na mapie / w App ---
  function markAustraliaCritical(){
    try {
      if (typeof emitPlantStatus === 'function') {
        emitPlantStatus('Australia', 'critical');
      } else if (window.App && App.bus) {
        App.bus.dispatchEvent(new CustomEvent('plant:status', { detail:{ country:'Australia', status:'critical' } }));
      }
    }catch(e){}
  }


  function init(){
    wrapSpawnRansom();
    // Australia ma być czerwona przy starcie gry
    //markAustraliaCritical();
  }

  // poczekaj chwilę aż wszystko (simproc, terminal itp.) się zainicjalizuje
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }
})();
