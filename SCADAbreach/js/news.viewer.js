// js/news.viewer.js — linkowanie tytułów/leadów + modal z artykułem
(function(){
  // proste style modala (wstrzyknięte z JS, żeby nic nie ruszać w CSS)
  const css = `
  .nv-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;z-index:9998;}
  .nv-modal{position:fixed;inset:auto;top:6%;left:50%;transform:translateX(-50%);width:min(900px,94vw);max-height:88vh;overflow:auto;background:#f4f4f4; color:#111;
;border:1px solid rgba(138,180,248,.2);border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.4);padding:24px;z-index:9999;display:none;}
  .nv-modal h1{font-size:22px;margin:0 0 8px;font-weight:700}
  .nv-modal .nv-byline{font-size:12px;color:#9aa4b2;margin-bottom:14px}
  .nv-modal .nv-body p{line-height:1.6;margin:0 0 12px}
  .nv-close{position:absolute;top:10px;right:12px;cursor:pointer;font-size:18px;opacity:.8}
  .nv-link{cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .nv-link:hover{opacity:.9}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // tworzymy backdrop + kontener modala
  const backdrop = document.createElement('div');
  backdrop.className = 'nv-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'nv-modal';
  modal.innerHTML = `<div class="nv-close" title="Close">✕</div><div class="nv-content"></div>`;
  document.body.append(backdrop, modal);

function openModal(title, lead){
  const store = (window.NewsContent || {});
  const obj = store[title] || { byline: '', html: `<p>${(lead||'')}</p>`};
  const box = modal.querySelector('.nv-content');

  // --- helpers: stały (pseudo)autor na podstawie tytułu + rok + krótki ID
const AUTHORS = [
  'Alex Mercer', 'Nadia Kovalenko', 'Ethan Graves', 'Mira Tanaka',
  'Jordan Reyes', 'Sofia Lindström', 'Liam Hartman', 'Elena Markovic',
  'Darius Pierce', 'Chloe Navarro', 'Victor Halberg', 'Isabella Duarte'
];

  const pickAuthor = (seed) => {
    let h = 0; for (let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i)) >>> 0;
    return AUTHORS[h % AUTHORS.length];
  };
  const shortHash = (seed) => {
    let h = 2166136261 >>> 0;
    for (let i=0;i<seed.length;i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619)>>>0; }
    return (h>>>0).toString(36).slice(0,6).toUpperCase();
  };
  const year = new Date().getFullYear();
  const author = obj.author || pickAuthor(title);
  const docId  = 'GIN-' + shortHash(title);

  box.innerHTML = `
    <h1>${escapeHtml(title)}</h1>
    ${obj.byline ? `<div class="nv-byline">${escapeHtml(obj.byline)}</div>` : ''}
    <div class="nv-body">
      ${obj.html || `<p>${escapeHtml(lead||'')}</p>`}
    </div>
    <footer class="nv-footer">
      <div class="line">
        <span class="muted">Author:</span><span>${escapeHtml(author)}</span>
        <span class="sep">•</span>
        <span class="muted">Document ID:</span><span class="id">${docId}</span>
      </div>
      <div class="line">
        <span class="brand">© ${year} Global Insight News</span>
        <span class="sep">•</span>
        <span>Editorial Office: 221B Fleet Street, London EC4, UK</span>
        <span class="sep">•</span>
        <span>Contact: editorial@globalinsight.news · +44 20 0000 0000</span>
      </div>
      <div class="line">
        <span class="muted">All rights reserved. Reproduction or distribution without written permission is prohibited.</span>
      </div>
    </footer>
  `;

  backdrop.style.display = 'block';
  modal.style.display = 'block';
}

  function closeModal(){
    backdrop.style.display = 'none';
    modal.style.display = 'none';
  }
  modal.querySelector('.nv-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  // „linkowanie” tytułów i leadów po renderze
  function linkify() {
    // sekcje z news.js
    const heroMain = document.querySelector('#news-hero-main');
    const heroSide = document.querySelector('#news-hero-side');
    const grid = document.querySelector('#news-grid');

    // helper: dla danego art elementu o strukturze z news.js
    function wireArticle(container, titleSel, leadSel){
      if(!container) return;
      container.querySelectorAll('article').forEach(a=>{
        const titleEl = a.querySelector(titleSel);
        const leadEl = a.querySelector(leadSel);
        if(!titleEl) return;
        const title = titleEl.textContent.trim();
        const lead = leadEl ? leadEl.textContent.trim() : '';

        // oznacz jako "link" bez zmiany struktury
        titleEl.classList.add('nv-link');
        if(leadEl) leadEl.classList.add('nv-link');

        // zdarzenia
        const open = (ev)=>{ ev.preventDefault(); openModal(title, lead); };
        titleEl.addEventListener('click', open);
        if(leadEl) leadEl.addEventListener('click', open);
        titleEl.addEventListener('mouseover', ()=>{ titleEl.style.cursor='pointer'; });
        if(leadEl) leadEl.addEventListener('mouseover', ()=>{ leadEl.style.cursor='pointer'; });
      });
    }

    // hero main: <h2> + <p>
    if(heroMain){
      const t = heroMain.querySelector('h2');
      const p = heroMain.querySelector('p');
      if(t){
        t.classList.add('nv-link');
        if(p) p.classList.add('nv-link');
        const title = t.textContent.trim();
        const lead = p ? p.textContent.trim() : '';
        const open = (ev)=>{ ev.preventDefault(); openModal(title, lead); };
        t.addEventListener('click', open);
        if(p) p.addEventListener('click', open);
        t.addEventListener('mouseover', ()=>{ t.style.cursor='pointer'; });
        if(p) p.addEventListener('mouseover', ()=>{ p.style.cursor='pointer'; });
      }
    }

// hero side: <article><h4> + <p> (renderCardHTML używa h4)
wireArticle(heroSide, 'h4', 'p');

    // grid: <article><h4> + <p>
    wireArticle(grid, 'h4', 'p');
  }

  // Przelinkuj po każdym rerenderze news
  if(window.App && App.bus){
    App.bus.addEventListener('news:changed', ()=> {
      // odrocz o 0 ms, żeby działać po innerHTML z news.js
      setTimeout(linkify, 0);
    });
  }
  // oraz raz na start (po seeding)
  window.addEventListener('load', ()=> setTimeout(linkify, 0));

// Upublicznij linkify dla innych skryptów (news.js)
window.NewsLinkify = linkify;

// proste API do otwierania artykułu po tytule
window.NewsViewer = window.NewsViewer || {};
window.NewsViewer.open = function(title, lead){
  openModal(title, lead || '');
};

// Jeśli App.bus jeszcze nie żyje — spróbuj za chwilę
(function attachNewsBus(){
  if (window.App && App.bus) {
    App.bus.addEventListener('news:changed', () => setTimeout(linkify, 0));
  } else {
    setTimeout(attachNewsBus, 150);
  }
})();

})();
// --- Flash "News" tab when a new article is added (simple, safe) ---
window.addEventListener('load', () => {
  const tabNews = document.getElementById('tab-news');
  if (!tabNews || !window.App || !App.bus) return;

  const stopFlash = () => tabNews.classList.remove('flash-news');

  App.bus.addEventListener('news:changed', (e) => {
    // mrugaj TYLKO gdy dodano nowy artykuł i News NIE jest aktywny
    const isAdd = e?.detail?.type === 'add';
    const isActive = tabNews.classList.contains('is-active');
    if (!isAdd || isActive) return;

    tabNews.classList.add('flash-news');

    // auto-stop po 6 s
    setTimeout(stopFlash, 6000);

    // kliknięcie w zakładkę — natychmiast stop (listener jednorazowy)
    const onClick = () => { stopFlash(); tabNews.removeEventListener('click', onClick); };
    tabNews.addEventListener('click', onClick, { once: true });
  });
});
