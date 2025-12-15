// js/news.sections.js — tematyczne sekcje pod "Latest News"
(function(){
  // Asekuracyjnie, gdyby kolejność skryptów była zła
  window.App = window.App || {};
  App.bus = App.bus || new EventTarget();

  // Lokalny store kategorii
  App.categories = App.categories || []; // [{ name, items: [...] }]

  // Używamy helperów z news.js
  const utils = App.utils || {};
  const timeAgo = utils.timeAgo || (ts => {
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff/60000);
    if(m<1) return 'just now';
    if(m<60) return `${m} min ago`;
    const h = Math.floor(m/60);
    if(h<24) return `${h} h ago`;
    const d = Math.floor(h/24);
    return `${d} d ago`;
  });
  const sanitize = utils.sanitize || (s => (s||'').toString());

  function renderCategorySection(name, items){
    const host = document.getElementById('news-sections');
    if(!host) return;

    const section = document.createElement('section');
    section.className = 'news-category';

    const h = document.createElement('h2');
    h.className = 'news-category-heading';
    h.textContent = name;
    section.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'news-category-grid';

    items.slice(0,4).forEach(it => {
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

    section.appendChild(grid);
    host.appendChild(section);
  }

  function renderCategories(){
    const host = document.getElementById('news-sections');
    if(!host) return;
    host.innerHTML = '';
    App.categories.forEach(cat => renderCategorySection(cat.name, cat.items || []));
  }

  // Publiczne API
  App.addCategory = function(name, items=[]){
    const norm = (items||[]).map(it => ({
      id: crypto.randomUUID(),
      title: '',
      lead: '',
      category: name,
      region: 'Global',
      source: 'Internal',
      severity: 'low',
      image: '',
      pinned: false,
      ts: Date.now(),
      ...it
    }));
    App.categories.push({ name, items: norm });
    renderCategories();
  };

  App.setCategories = function(list=[]){
    App.categories = list.map(cat => ({
      name: cat.name,
      items: (cat.items||[]).map(it => ({
        id: crypto.randomUUID(),
        title: '',
        lead: '',
        category: cat.name,
        region: 'Global',
        source: 'Internal',
        severity: 'low',
        image: '',
        pinned: false,
        ts: Date.now(),
        ...it
      }))
    }));
    renderCategories();
  };

  // Render po załadowaniu DOM (skrypt jest defer, ale dodajmy ochronę)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCategories);
  } else {
    renderCategories();
  }

  // (Opcjonalnie) nasłuchiwanie na zdarzenia, gdybyś chciał kiedyś
  // przeładowywać sekcje po jakimś evencie:
  // App.bus.addEventListener('categories:changed', renderCategories);
})();
// --- Seed przykładowych kategorii (opcjonalnie) ---
(function seedCategories(){
  const now = Date.now();
  App.setCategories([
    {
      name: 'Lifestyle',
      items: [
        { title:'Morning routines that boost focus', lead:'Small habits, big impact.', image:'https://picsum.photos/600/338?l=1', severity:'low', source:'Editorial', ts: now - 40*60*1000 },
        { title:'Urban gardening in small spaces', lead:'Herbs on your sill.', image:'https://picsum.photos/600/338?l=2', severity:'low', source:'Editorial', ts: now - 2*60*60*1000 },
        { title:'Minimalism: less but better', lead:'Declutter your week.', image:'https://picsum.photos/600/338?l=3', severity:'low', source:'Editorial', ts: now - 3*60*60*1000 },
        { title:'Sleep hygiene 101', lead:'Your dark mode matters.', image:'https://picsum.photos/600/338?l=4', severity:'low', source:'Editorial', ts: now - 4*60*60*1000 },
      ]
    },
    {
      name: 'Business',
      items: [
        { title:'Markets close higher after strong earnings', lead:'Tech stocks lead the rally.', image:'https://picsum.photos/600/338?b=1', severity:'low', source:'Reuters', ts: now - 90*60*1000 },
        { title:'Oil prices drop amid global slowdown fears', lead:'Energy sector under pressure.', image:'https://picsum.photos/600/338?b=2', severity:'med', source:'Bloomberg', ts: now - 3*60*60*1000 },
        { title:'Startups attract record venture capital', lead:'Fintech leads investments.', image:'https://picsum.photos/600/338?b=3', severity:'low', source:'TechCrunch', ts: now - 4*60*60*1000 },
        { title:'Central bank signals rate pause', lead:'Analysts see stability ahead.', image:'https://picsum.photos/600/338?b=4', severity:'low', source:'FT', ts: now - 5*60*60*1000 },
      ]
    },
    {
      name: 'Sports',
      items: [
        { title:'Local team secures championship win', lead:'Fans celebrate late-night victory.', image:'https://picsum.photos/600/338?s=1', severity:'low', source:'ESPN', ts: now - 60*60*1000 },
        { title:'Star striker suffers injury ahead of finals', lead:'Coach confirms sidelining.', image:'https://picsum.photos/600/338?s=2', severity:'med', source:'Sky Sports', ts: now - 2*60*60*1000 },
        { title:'Olympic committee announces new events', lead:'Surfing and climbing return.', image:'https://picsum.photos/600/338?s=3', severity:'low', source:'IOC', ts: now - 3*60*60*1000 },
        { title:'Tennis legend retires after 20 years', lead:'Career full of records ends.', image:'https://picsum.photos/600/338?s=4', severity:'low', source:'BBC Sport', ts: now - 4*60*60*1000 },
      ]
    },
    {
      name: 'Entertainment',
      items: [
        { title:'Famous actor spotted in New York', lead:'Rumors spark about new movie role.', image:'https://picsum.photos/600/338?e=1', severity:'low', source:'People', ts: now - 45*60*1000 },
        { title:'Singer releases surprise album', lead:'Fans flood streaming platforms.', image:'https://picsum.photos/600/338?e=2', severity:'med', source:'Billboard', ts: now - 2*60*60*1000 },
        { title:'Celebrity couple announces breakup', lead:'Social media reacts wildly.', image:'https://picsum.photos/600/338?e=3', severity:'high', source:'TMZ', ts: now - 3*60*60*1000 },
        { title:'Award show highlights viral moment', lead:'Internet can’t stop talking.', image:'https://picsum.photos/600/338?e=4', severity:'low', source:'Variety', ts: now - 5*60*60*1000 },
      ]
    },
    {
      name: 'Cybersecurity',
      items: [
        { title:'Top 10 phishing lures Q3', lead:'Finance and HR dominate.', image:'https://picsum.photos/600/338?c=1', severity:'high', source:'SOC', ts: now - 70*60*1000 },
        { title:'Ransomware TTPs watchlist', lead:'Common initial access vectors.', image:'https://picsum.photos/600/338?c=2', severity:'med', source:'CERT', ts: now - 5*60*60*1000 },
        { title:'Hardening checklists refresher', lead:'CIS benchmarks in practice.', image:'https://picsum.photos/600/338?c=3', severity:'low', source:'Blue Team', ts: now - 6*60*60*1000 },
        { title:'New VPN appliance patches', lead:'Apply before weekend.', image:'https://picsum.photos/600/338?c=4', severity:'high', source:'Vendor', ts: now - 7*60*60*1000 },
      ]
    }
  ]);
})();
