// js/news.js — mock danych + renderer + eventy pod przyszłą konsolę
(function(){
  // Global app namespace
  window.App = window.App || {};
  App.bus = App.bus || new EventTarget();
  App.news = App.news || [];

  // ---- Helpers ----
  const $ = (sel) => document.querySelector(sel);

  function timeAgo(ts){
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const m = Math.floor(diff / 60000);
    if(m < 1) return 'just now';
    if(m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if(h < 24) return `${h} h ago`;
    const d = Math.floor(h / 24);
    return `${d} d ago`;
  }

  function byPriority(a, b){
    // pinned first, then severity (high>med>low), then time desc
    const sevRank = {high:3, med:2, low:1};
    if(!!b.pinned - !!a.pinned) return (!!b.pinned) - (!!a.pinned);
    if((sevRank[b.severity]||0) - (sevRank[a.severity]||0)) return (sevRank[b.severity]||0) - (sevRank[a.severity]||0);
    return (b.ts||0) - (a.ts||0);
  }

  function sanitize(str){ return (str||'').toString(); }
App.utils = { timeAgo, sanitize };

// --- Lock na główny hero (pierwszy raz wybierz z EMBED) ---
let __LOCKED_HERO_ID = null;


// Wspólny szablon karty (miniatura + badże + tytuł + lead)
function renderCardHTML(it){
  return `
    ${it.image ? `<div class="news-card-thumb"><img src="${sanitize(it.image)}" alt=""></div>` : ''}
    <div class="badges">
      <span class="badge ${'sev-'+(it.severity||'low')}">${(it.severity||'low').toUpperCase()}</span>
      <span class="badge">${sanitize(it.category||'General')}</span>
      <span class="meta">${sanitize(it.source||'Internal')} • ${timeAgo(it.ts)}</span>
    </div>
    <h4>${sanitize(it.title)}</h4>
    <p>${sanitize(it.lead||'')}</p>
  `;
}

// Krótkie newsy do „entertainment boxa”
// Krótkie newsy do „entertainment boxa”

// Zwykły, „lajtowy” tryb przed eskalacją
const heroTickerItemsNormal = [
  "More people are returning to analog hobbies, with film cameras making a strong comeback.",
  "A 15-minute walk boosts focus more effectively than a morning coffee, new studies show.",
  "Cities begin testing smart benches powered entirely by solar energy.",
  "Young parents increasingly embrace minimalist approaches to raising children.",
  "Experts predict that remote work will become the standard for 70% of companies by 2030.",
  "Record attendance at this year's marathon with over 40,000 runners at the start.",
  "A new superfood is trending: fermented green rice.",
  "Digital fatigue is now affecting even elementary school students, psychologists warn.",
  "Vacation trends show people choosing quiet countryside villages over crowded resorts.",
  "Home micro-gardens in glass jars are becoming a popular décor trend.",
  "Eco-friendly smart homes gain popularity among celebrities.",
  "A world-class football star signs with a fast-growing international league.",
  "Ten minutes of daily meditation reduces stress levels by up to 25%.",
  "More companies introduce the four-day workweek as a permanent model.",
  "Electric bikes are rapidly replacing second family cars.",
  "Scientists develop biodegradable sports shoes made from mycelium fibers.",
  "Steam ovens are becoming the new standard in modern kitchens.",
  "The national volleyball team sets a new record for seasonal wins.",
  "Fitness influencers promote five-minute micro-workouts as daily boosters.",
  "Retro-jogging inspired by the 80s becomes a fitness sensation.",
  "More people learn foreign languages through podcasts during commutes.",
  "Minimalist high-protein breakfasts dominate social media trends.",
  "Cinemas introduce relaxation pods instead of traditional seats.",
  "Walking cats on harnesses becomes a rising trend among pet owners.",
  "A new app allows users to monitor household water usage in real time.",
  "Nutrition experts recommend avoiding late meals for better sleep quality.",
  "A legendary football coach reveals strategies behind a historic final.",
  "More women pursue careers in the tech sector than ever before.",
  "Slow dating makes a comeback as people prefer face-to-face interactions.",
  "Homes filled with air-purifying plants become the trend of the year.",
  "Hybrid sports clubs combine gym space, coworking zones, and cafés.",
  "Weekend getaways to off-grid cabins are booming among millennials.",
  "Interest in self-defense classes grows in major cities.",
  "Interior designers introduce mood-responsive smart lighting.",
  "Short, frequent breaks in the workday increase creativity by over 30%.",
  "Fusion ramen dishes with local ingredients dominate culinary trends.",
  "A rising MMA fighter shocks fans with a rapid climb up the rankings.",
  "Spontaneous low-budget trips gain popularity across Europe.",
  "Fashion blends classic silhouettes with futuristic materials.",
  "More people switch to jobs that allow them to travel freely.",
  "Mental coaches recommend starting each day with three minutes of gratitude.",
  "Physical book sales rise despite the dominance of e-readers.",
  "A new streaming platform offers only short episodes under 10 minutes.",
  "Retro board games and classic tabletop editions are seeing a revival.",
  "Cities open nighttime food markets catering to shift workers.",
  "Fitness clubs introduce recovery zones with therapeutic light treatment.",
  "Young adults return to sewing and traditional craft workshops.",
  "A beloved celebrity launches a foundation supporting youth in sports.",
  "Experts warn that weekend oversleeping cannot replace regular rest.",
  "Mindfulness walks without phones become a popular stress-relief trend.",
];

// Tryb kryzysowy po eskalacji / rozlaniu ataku
const heroTickerItemsCrisis = [
  "International agencies report simultaneous disruptions in power grids across three continents.",
  "Influencers complain they can’t stream their 'dramatic blackout updates' without electricity.",
  "Multiple power plants declare loss of connection with central monitoring systems.",
  "A famous celebrity asks online: 'Does anyone actually know how a candle works?'.",
  "Residents of major cities line up for water and powerbanks as outages continue.",
  "Streamers fight over the last working powerbanks to host 'the most authentic live ever'.",
  "Fire departments report a surge in generator-related fires during the blackout.",
  "Fitness creators release guides: 'How to do leg day in complete darkness'.",
  "Government officials admit: 'We do not know the full scale of the incident.'",
  "Restaurants promote new menu items labeled 'limited edition – served unheated'.",
  "Television broadcasts cut off abruptly, leaving viewers with flashing error messages.",
  "Beauty influencers switch to a natural look: 'I literally can’t see myself anyway'.",
  "Ports suspend ship traffic due to loss of navigation systems.",
  "A tech influencer reviews a candle: 'It glows, but there’s no app — wouldn’t recommend'.",
  "Mobile operators warn of imminent signal loss across entire regions.",
  "Fashion sites add a new category: 'Emergency blackout outfits'.",
  "Experts warn that supply chains are collapsing under prolonged outages.",
  "A cooking influencer publishes: 'Ten meals you can prepare without light, tools, or hope'.",
  "More metropolitan areas are plunged into darkness at dawn.",
  "Celebrities show off 'designer candles' as a blackout-season essential.",
  "Railway systems halt operations after control networks fail.",
  "Gamers attempt offline modes for the first time — many quit after ten minutes.",
  "Authorities caution that fuel reserves may not last much longer.",
  "Gossip portals debate how paparazzi should operate without flashlights.",
  "Borders undergo massive delays as digital checkpoints fail.",
  "A streamer declares the blackout 'the most realistic survival game ever'.",
  "Airport towers report issues with radios and radars.",
  "Shops advertise 'passive refrigerators' — basically styrofoam boxes.",
  "Financial markets plummet as investors freeze trading.",
  "ASMR creators record 'generator malfunction sounds' for relaxation.",
  "Hospitals begin running out of battery-powered medical equipment.",
  "A beauty influencer laments: 'My sonic toothbrush died. I'm forced to use a normal one…'.",
  "Several nations declare states of emergency after losing grid stability.",
  "TV celebrities ask: 'Wait… does blackout mean no television?'.",
  "Banks report widespread failures of ATMs and card terminals.",
  "Young adults discover books — 'It’s like a tablet but made of paper'.",
  "Authorities warn of citywide water shortages as pump stations fail.",
  "A wellness influencer sells a course titled 'How to breathe in darkness' for 99 dollars.",
  "Police struggle to maintain order as outages stretch into the night.",
  "TikTok goes viral with a trend: 'How I look in total darkness?' — videos are fully black.",
  "Satellite images show regions going entirely dark overnight.",
  "DIY bloggers craft lamps using plastic bottles and cheap flashlights.",
  "Experts say grid restoration could take weeks or months.",
  "Influencers launch the 'blackout haul' — survival gadgets they don’t know how to use.",
  "Citizens queue at public wells as potable water grows scarce.",
  "Instagram’s newest trend: photos of nothing — because nothing is visible.",
  "Local authorities begin distributing emergency food supplies.",
  "A food vlogger reviews cold canned beans as 'the gourmet cuisine of the blackout'.",
  "Energy regulators fear cascading outages across neighboring regions.",
  "Celebrities beg online: 'Bring back electricity, my content depends on it!'.",
  "Energy regulators report unusual surges in high-voltage transmission lines across multiple regions.",
  "A lifestyle influencer cries on livestream audio: 'I can’t charge my ring light… how will people see my authenticity?'.",
  "Government analysts confirm that several power hubs went offline within seconds of each other.",
  "A travel vlogger posts: 'Guys, the blackout totally ruined my sunset vlog aesthetic'.",
  "Cybersecurity teams warn of coordinated intrusion attempts targeting industrial control systems.",
  "A reality-TV star cancels a planned 'candlelit Q&A' because the candles wouldn't fit her brand palette.",
  "Several cities activate emergency sirens after experiencing rolling outages overnight.",
  "A gamer claims the blackout is just 'hardcore immersion mode' and asks where to buy DLC for electricity.",
  "Crisis centers report supply trucks failing due to fuel shortages across multiple highways.",
  "A beauty guru launches a new trend: 'Makeup by intuition – because mirrors don't work now'.",
  "Air traffic monitoring systems experience partial shutdowns across several airports.",
  "TikTokers create a trend called 'flashlight dances', featuring only silhouettes and chaos.",
  "Experts confirm a rare simultaneous failure of multiple backup generators.",
  "Influencers fight in comments over which one has 'the most aesthetic emergency lantern'.",
  "Authorities warn that parts of the grid may have suffered permanent damage.",
  "A well-known streamer apologizes: 'Sorry guys, I can't go live — I'm currently unplugged from life'.",
  "Medical logistics networks report delays in delivering critical supplies.",
  "A famous chef declares: 'Cold food is the new haute cuisine — embrace the darkness!'.",
  "Satellite operators detect unstable voltage patterns across national energy nodes.",
  "A fitness influencer posts: 'No gym, no treadmill… I'm forced to walk like a medieval peasant'.",
  "Transport ministries confirm that highway signs and tunnel lights are failing.",
  "A wellness influencer recommends 'guided breathing until the grid returns'.",
  "Emergency management offices warn that communication towers are running on residual power.",
  "A tech vlogger reviews a matchbox: 'Manual ignition device — surprisingly efficient'.",
  "Government briefings mention 'anomalous behavior' in regional power dispatch systems.",
  "Fashion influencers debut the 'Blackout Streetwear' collection: mostly darkness and confusion.",
  "Several countries activate cross-border energy support protocols.",
  "A popular podcaster complains that the world ending during his vacation is 'disrespectful'.",
  "Authorities deploy additional surveillance drones, though many fail mid-flight.",
  "A lifestyle blogger posts a tutorial: 'How to romanticize your blackout breakdown'.",
  "Infrastructure experts warn that restoring power will require massive system rewrites.",
  "A wellness coach starts offering 'emergency affirmations' for people afraid of the dark.",
  "National security agencies investigate suspected tampering with grid frequency control.",
  "A travel influencer brags: 'Visited 5 countries today — all equally dark, 10/10 vibe'.",
  "Energy companies confirm that reservoir pumps are slowing down due to low system pressure.",
  "A gamer hosts an offline LAN party consisting entirely of staring at unplugged PCs.",
  "Emergency services note a rise in elevator malfunctions across high-rise districts.",
  "A foodie influencer reviews a flashlight: 'Perfect for midnight snack exploration'.",
  "Scientists warn that cooling failures in data centers may cause irreversible outages.",
  "A celebrity tweets: 'Without electricity, how do I even know who I am?'.",
  "Local governments begin issuing rationing guidelines for water and heating.",
  "A fashion blogger presents a guide: 'How to stay chic while surrounded by despair'.",
  "Security experts confirm increased probing of grid-connected IoT devices.",
  "Couples vloggers post 'romantic blackout challenges' filmed entirely in audio format.",
  "Authorities report that emergency phone lines are overloaded and unstable.",
  "An influencer declares: 'This blackout is ruining my circadian rhythm — and my brand deals'.",
  "Engineers warn that transformer damage could cascade into long-term regional failures.",
  "A celebrity chef advertises a new dish: 'Ambient-temperature noodles — inspired by necessity'.",
  "International observers say the blackout may spread if grid isolation fails.",
  "A beauty influencer says: 'No power? My skincare routine now relies on hope and instincts'.",
];

let heroTickerItems = heroTickerItemsNormal; // aktualnie używany zestaw
let heroTickerIndex = 0;
let heroTickerTimerStarted = false;

function setHeroTickerMode(mode){
  if (mode === 'crisis') {
    heroTickerItems = heroTickerItemsCrisis;
  } else {
    heroTickerItems = heroTickerItemsNormal;
  }
  heroTickerIndex = 0;
  const line = document.getElementById('hero-ticker-line');
  if (line && heroTickerItems.length) {
    line.textContent = heroTickerItems[0];
  }
}

// Proste globalne API, żeby inne skrypty mogły przełączyć tryb
window.NewsTicker = window.NewsTicker || {};
window.NewsTicker.setCrisisMode = function(){
  setHeroTickerMode('crisis');
};
window.NewsTicker.setNormalMode = function(){
  setHeroTickerMode('normal');
};

function startHeroTicker(){
  if (heroTickerTimerStarted) return;
  heroTickerTimerStarted = true;

  setInterval(() => {
    const line = document.getElementById('hero-ticker-line');
    if (!line || !heroTickerItems.length) return;
    heroTickerIndex = (heroTickerIndex + 1) % heroTickerItems.length;
    line.textContent = heroTickerItems[heroTickerIndex];
  }, 8000); // co 5 sekund zmiana tekstu
}

  // ---- Renderers ----
function renderHero(mainItem, sideItems){
  const main = $('#news-hero-main');
  const side = $('#news-hero-side');
  if(!main || !side) return;

  // media slot (video > image fallback)
const mediaHTML = mainItem.embed
  ? `<div class="embed-wrap is-lazy" data-src="${sanitize(mainItem.embed)}">
       <button class="embed-play" aria-label="Play">▶</button>
     </div>`
  : (mainItem.video
    ? `<video src="${sanitize(mainItem.video)}" ${mainItem.poster ? `poster="${sanitize(mainItem.poster)}"` : ''} controls playsinline preload="metadata"></video>`
    : `<img src="${sanitize(mainItem.image||'https://via.placeholder.com/800x400')}" alt="" loading="lazy" decoding="async">`);

const isEmbed = !!mainItem.embed;

main.innerHTML = `
  <div id="news-hero-media" class="hero-media ${isEmbed ? 'is-embed' : ''}">
    ${mediaHTML}
  </div>
  <div class="badges">
    <span class="badge ${'sev-'+(mainItem.severity||'low')}">${(mainItem.severity||'low').toUpperCase()}</span>
    <span class="badge">${sanitize(mainItem.category||'General')}</span>
    <span class="meta">${timeAgo(mainItem.ts)} • ${sanitize(mainItem.region||'Global')}</span>
  </div>
<h2>${sanitize(mainItem.title)}</h2>
${mainItem.thumb ? `<img class="hero-thumb-below" src="${sanitize(mainItem.thumb)}" alt="">` : ''}
<p>${sanitize(mainItem.lead||'')}</p>

`;
// lazy-load iframe po kliknięciu
const lazy = main.querySelector('.embed-wrap.is-lazy');
if (lazy) {
  const loadIframe = () => {
    const src = lazy.getAttribute('data-src');
    if (!src) return;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('webkitallowfullscreen', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    iframe.loading = 'lazy';
    lazy.replaceChildren(iframe);
    lazy.classList.remove('is-lazy');
  };
  // klik w przycisk lub w sam placeholder
  lazy.addEventListener('click', (e) => { e.preventDefault(); loadIframe(); }, { once: true });
  const btn = lazy.querySelector('.embed-play');
  btn?.addEventListener('click', (e) => { e.stopPropagation(); loadIframe(); }, { once: true });
}

side.innerHTML = '';

// 1) Box z krótkimi newsami
const tickerArticle = document.createElement('article');
tickerArticle.className = 'hero-side-ticker';
tickerArticle.innerHTML = `
  <div class="hero-side-ticker-header">
    <div class="hero-side-ticker-title">
      <span class="hst-label">Hot News</span>
      <span class="hst-pill">
        <span class="hst-dot"></span>
        LIVE
      </span>
    </div>
  </div>
  <p id="hero-ticker-line" class="hero-side-ticker-text">
    ${sanitize(heroTickerItems[0])}
  </p>
`;

side.appendChild(tickerArticle);

// 2) Normalne artykuły pod spodem (np. AI trailer)
sideItems.forEach(it => {
  const el = document.createElement('article');
  el.innerHTML = renderCardHTML(it);
  side.appendChild(el);
});

// uruchom rotację tekstów (raz)
startHeroTicker();

}
function renderGrid(items){
  const grid = $('#news-grid');
  if(!grid) return;
  grid.innerHTML = '';
  items.forEach(it => {
    const card = document.createElement('article');
    card.innerHTML = `
      ${it.image ? `<div class="news-card-thumb"><img src="${sanitize(it.image)}" alt=""></div>` : ''}
      <div class="badges">
        <span class="badge ${'sev-'+(it.severity||'low')}">${(it.severity||'low').toUpperCase()}</span>
        <span class="badge">${sanitize(it.category||'General')}</span>
        <span class="meta">${sanitize(it.source||'Internal')} • ${timeAgo(it.ts)}</span>
      </div>
      <h4>${sanitize(it.title)}</h4>
      <p>${sanitize(it.lead||'')}</p>
    `;
    grid.appendChild(card);
  });
}
let __HERO_FINALIZED = false; // ustawimy na true, gdy pojawi się pierwszy artykuł z embed


function renderAll(){
  
  const list = [...App.news].filter(it => {
    
    return !(it.category === 'Mail' && it.source === 'Mail system');
  });

  if (!list.length) return;

  let main = null;



  // 1) Jeśli mamy już zablokowanego hero – spróbuj go znaleźć
  if (__LOCKED_HERO_ID) {
    main = list.find(n => n.id === __LOCKED_HERO_ID) || null;
  }

  // 2) Jeśli jeszcze nie ma zablokowanego hero, albo go nie znaleźliśmy,
  //    wybierz najlepszy i w razie czego go zablokuj
  if (!main) {
    const sorted = list.slice().sort(byPriority);
    main = sorted[0];

    // jeśli to pierwszy raz i mamy „fajny” hero (video / embed),
    // zapamiętaj go na stałe
    if (!__LOCKED_HERO_ID && (main.video || main.embed)) {
      __LOCKED_HERO_ID = main.id;
    }
  }

  // 3) Reszta newsów = wszystko poza hero
  const remaining = list.filter(it => it !== main);

  // SIDE: weź jeden najświeższy artykuł
  const sideByTime = remaining.slice().sort((a,b) => (b.ts||0) - (a.ts||0));
  const s1 = sideByTime[0];

  // GRID: reszta
  const rest = remaining.filter(it => it !== s1).sort(byPriority);

  renderHero(main, s1 ? [s1] : []);
  renderGrid(rest.slice(0, 12));

  if (window.NewsLinkify) setTimeout(window.NewsLinkify, 0);
}

  // ---- Store API ----
  App.addNews = function(item){
    const doc = {
      id: crypto.randomUUID(),
      title: '',
      lead: '',
      category: 'General',
      region: 'Global',
      source: 'Internal',
      severity: 'low', // low|med|high
      image: '',
      pinned: false,
      ts: Date.now(),
      silent: false,
      ...item
    };
    App.news.push(doc);


    // 🔊 DŹWIĘK: nowy news (jeśli nie jest oznaczony jako silent)
    if (!doc.silent && window.SFX && typeof SFX.play === 'function'){
      SFX.play('news');
    }
    App.bus.dispatchEvent(new CustomEvent('news:changed', { detail: { type:'add', item: doc }}));
    renderAll();
    return doc;
  };

  App.updateNews = function(id, patch){
    const idx = App.news.findIndex(n => n.id === id);
    if(idx === -1) return;
    App.news[idx] = { ...App.news[idx], ...patch };
    App.bus.dispatchEvent(new CustomEvent('news:changed', { detail: { type:'update', item: App.news[idx] }}));
    renderAll();
  };

  App.clearNews = function(){
    App.news = [];
    App.bus.dispatchEvent(new CustomEvent('news:changed', { detail: { type:'clear' }}));
    renderAll();
  };

  // Listen for future console events
  App.bus.addEventListener('news:add', (e) => App.addNews(e.detail||{}));
  App.bus.addEventListener('news:clear', () => App.clearNews());

  // ---- Seed mock data ----
  const now = Date.now();
  const seed = [
{
  title: 'AI-generated film trailer goes viral overnight',
  lead: 'Fans stunned as synthetic actors deliver lifelike performances in debut release.',
  category: 'Tech & Culture',
  region: 'Global',
  severity: 'med',
  source: 'The Verge',
  image: 'media/news/AI_trailer.webp',  
  ts: now - 3*60*1000,
  pinned: true   
},

{ title:'European Council holds summit on economic growth', image: 'media/news/summit.webp', lead:'Leaders discuss fiscal policies and joint recovery plans.', category:'Politics', region:'Europe', severity:'low', source:'Reuters', ts: now - 8*60*1000 },
{ title:'Telecom ministers meet to expand 5G cooperation', image: 'media/news/5G.webp', lead:'Countries agree to accelerate infrastructure investments across the region.', category:'Technology', region:'Central Europe', severity:'med', source:'Euronews', ts: now - 15*60*1000 },
{ title:'Local elections draw strong voter turnout', image:'media/news/vote.webp', lead:'Preliminary results expected later this evening.', category:'Politics', region:'Local', severity:'high', source:'Associated Press', ts: now - 25*60*1000 },
{ title:'Government extends refinery upgrade program', image: 'media/news/rafinery.webp', lead:'Officials say the decision will boost national energy independence.', category:'Economy', region:'Poland', severity:'low', source:'Bloomberg', ts: now - 35*60*1000 },
{ title:'Baltic ports report steady cargo traffic', image: 'media/news/port.webp', lead:'Trade routes remain stable despite seasonal weather conditions.', category:'Economy', region:'Baltic Region', severity:'low', source:'Reuters', ts: now - 50*60*1000 },
{ title:'Central Bank maintains interest rates unchanged', image: 'media/news/bank.webp', lead:'Monetary authorities cite stable inflation and strong market performance.', category:'Finance', region:'Poland', severity:'low', source:'Financial Times', ts: now - 65*60*1000 },
{ title:'Fuel prices remain stable across the country', image: 'media/news/fuel.webp', lead:'Energy ministry confirms adequate supply and distribution levels.', category:'Economy', region:'Poland', severity:'med', source:'BBC News', ts: now - 75*60*1000 },
{ title:'Regional power grid operates smoothly after maintenance', image: 'media/news/power_grid.webp', lead:'Engineers confirm stable electricity supply and system reliability.', category:'Energy', region:'Local', severity:'low', source:'Reuters', ts: now - 95*60*1000 },
{ title:'EU announces new digital cooperation framework', image: 'media/news/digital.webp', lead:'Initiative aims to strengthen cybersecurity and data-sharing standards.', category:'Diplomacy', region:'Global', severity:'high', source:'Politico', ts: now - 120*60*1000 },

  ];
  seed.forEach(App.addNews);
// --- Opening trailer jako osobny doc + ID zapamiętane globalnie ---
const openingTrailer = App.addNews({
  title: "Top news summary",
  lead: "A brief overview of the key events and developments shaping the day.",
  category: "Info",
  region: "Global",
  severity: "high",
  source: "BlackOut Media",
  video: "media/news/News1.mp4",      // startowy film
  poster: "media/trailer_poster.jpg",
  ts: Date.now(),
  pinned: true
});

// Proste API do podmiany trailera po eskalacji
window.NewsHero = window.NewsHero || {};
window.NewsHero.openingId = openingTrailer.id;

/**
 * hero „kryzysowy” trailer po eskalacji.
 * Ścieżkę filmu można zmienić wg uznania.
 */
window.NewsHero.setEscalationTrailer = function(){
  try {
    if (!window.App || typeof App.updateNews !== 'function') return;
    if (!window.NewsHero || !window.NewsHero.openingId) return;

    App.updateNews(window.NewsHero.openingId, {
      video: "media/news/Kernelians2.mp4",       // 
      poster: "media/news/Kernelians_poster.jpg", // opcjonalny plakat
      lead: "News transmission interrupted. The Kernelians are taking control.",
      category: "Crisis",
      severity: "high",
      source: "Global Network"
    });
  } catch(e) {
    console.error("setEscalationTrailer error", e);
  }
};

  // Initial render (in case DOM is ready before seeding)
  renderAll();

 // === Mini news (left column under terminal) ===
  const listEl = document.getElementById('mini-news-list');
  const openLink = document.getElementById('mini-news-open-news');

  function renderMiniNews(limit = 6){
    if(!listEl) return;
    const sevRank = {high:3, med:2, low:1};
    const items = [...App.news]
      .sort((a,b)=> (b.pinned?-1:0)-(a.pinned?-1:0) || (sevRank[b.severity]||0)-(sevRank[a.severity]||0) || (b.ts||0)-(a.ts||0))
      .slice(0, limit);

    listEl.innerHTML = items.map(it => `
      <div class="mini-news-item">
        <div>
          <div class="title">${sanitize(it.title)}</div>
          <div class="lead">${sanitize(it.lead||'')}</div>
        </div>
        <div class="meta">
          <span class="mini-badge ${'mini-sev-'+(it.severity||'low')}">${(it.severity||'low').toUpperCase()}</span>
          &nbsp; ${timeAgo(it.ts)}
        </div>
      </div>
    `).join('');
  }

  // re-render on any news change
  App.bus.addEventListener('news:changed', () => renderMiniNews());

  // initial render (in case this script runs after seeding)
  renderMiniNews();

  // clicking "View all" switches to News tab
  openLink?.addEventListener('click', (e)=>{
    e.preventDefault();
    document.getElementById('tab-news')?.click();
  });
})();
