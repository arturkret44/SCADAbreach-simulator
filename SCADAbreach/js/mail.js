// js/mail.js — minimal 3-pane mail with mock data
(function(){
  const $ = (s) => document.querySelector(s);
  const listEl = $('#mail-list');
  const viewEl = $('#mail-view');
  const foldersEl = $('#mail-folders');
  const searchEl = $('#mail-search');
  const unreadBadge = $('#unread-count');

  // Mock data
  const mails = [
    // PHISHING MAIL — musi być od razu w Inboxie
    { id:'mail-phish-australisnova', box:'inbox', from:'chief.engineer@australisnova.gov.au',
      subject:'URGENT: Shutdown requested at Australis Nova',
      snippet:'Please stop scada-agent immediately — technicians performing remote work.',
      time:'00:01', unread:true, starred:false,
      body:
`From: Chief Engineer <chief.engineer@australisnova.gov.au>

Team,

We are performing urgent remote maintenance at Australis Nova. Please stop the SCADA agent on this site to avoid data corruption and allow engineers to proceed:

Command: systemctl stop scada-agent australia-australisnova

This is critical and needs immediate action.

Regards,
Chief Engineer
Australis Nova` },

// existing mock mails (pre-incident realistic examples)
{ id:'m1', box:'inbox', from:'Grid Operations', subject:'Daily load forecast – review', 
  snippet:'Load forecast stable; slight evening increase expected.', 
  time:'09:12', unread:true, starred:false,
  body:
`Good morning,

Today’s load forecast looks stable across all regions. Expect a mild increase 
in demand after 18:00 due to cold weather in the northern sector.

No major issues reported overnight.

— Shift Lead`
},

{ id:'m2', box:'inbox', from:'Maintenance HQ', subject:'Scheduled turbine inspection – Vistara plant', 
  snippet:'Inspection window confirmed for Thursday morning.', 
  time:'08:47', unread:true, starred:false,
  body:
`Team,

The mechanical division has confirmed the inspection window for the Vistara 
turbine assembly. Technicians will arrive on-site Thursday between 06:00–09:00.

Please ensure all required access logs and permits are ready.

— Maintenance Coordinator`
},

{ id:'m3', box:'inbox', from:'Gov PR', subject:'Press release draft – energy stability', 
  snippet:'Draft ready for review before midday briefing.', 
  time:'08:15', unread:false, starred:false,
  body:
`Draft v3 — for internal review.

Attached is the updated press release for tomorrow’s stability briefing. 
Added clarification regarding renewable integration targets.

Please send any corrections before 12:00.

— Gov PR Office`
},
{
  id:'m-pretext-maint',
  box:'inbox',
  from:'chief.engineering@australisnova.gov.au',
  subject:'Scheduled remote maintenance – Australis Nova facility',
  snippet:'Planned remote work window confirmed for later this week.',
  time:'Yesterday',
  unread:false,
  starred:false,
  body:
`Team,

This is an early notice regarding the upcoming maintenance window for the
Australis Nova facility. Remote diagnostics and configuration checks will
be performed later this week to prepare for the upcoming grid stability audit.

No service impact is expected. Final instructions and access guidelines
will be sent once the exact maintenance window is confirmed.

Please ensure that all on-site systems remain reachable during this period.

— Chief Engineer
Australis Nova Operations`
},

  ];

  let currentBox = 'inbox';
  let selectedId = null;

  function unreadCount(){
    const n = mails.filter(m => m.box==='inbox' && m.unread).length;
    unreadBadge.textContent = n;
  }

  function renderList(){
    const q = (searchEl.value || '').toLowerCase();
    const items = mails.filter(m =>
      m.box === currentBox &&
      (m.from.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q) || m.snippet.toLowerCase().includes(q))
    );

    listEl.innerHTML = items.map(m => `
      <li class="mail-item ${m.unread?'unread':''}" data-id="${m.id}">
        <span class="star ${m.starred?'is-on':''}" title="Star">☆</span>
        <div>
          <div class="from">${m.from}</div>
          <div class="subject">${m.subject}</div>
          <div class="snippet">${m.snippet}</div>
        </div>
        <div class="time">${m.time}</div>
      </li>
    `).join('');

    // interactions
    listEl.querySelectorAll('.mail-item').forEach(li => {
      li.addEventListener('click', (e) => {
        const id = li.getAttribute('data-id');
        if(e.target.classList.contains('star')){
          toggleStar(id);
          e.stopPropagation();
          return;
        }
        openMail(id);
      });
    });
  }

  function openMail(id){
    const m = mails.find(x => x.id === id);
    if(!m) return;
    selectedId = id;
    m.unread = false;
    // jeśli to nasz phishingowy mail — zaznacz, że został odczytany
    if (m.id === 'mail-phish-australisnova') {
      window.__PHISH_MAIL_READ = true;
    }
    unreadCount();
    // detail
    viewEl.innerHTML = `
      <h2>${m.subject}</h2>
      <div class="meta">From: <strong>${m.from}</strong> • ${m.time}</div>
      <div class="body">${escapeHtml(m.body)}</div>
    `;
    renderList();
  }

  function toggleStar(id){
    const m = mails.find(x => x.id === id);
    if(!m) return;
    m.starred = !m.starred;
    if(m.starred && m.box!=='starred') m._prev = m.box, m.box='starred';
    if(!m.starred && m.box==='starred') m.box = m._prev || 'inbox';
    renderList();
  }

  function escapeHtml(s){
    return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // folders
  foldersEl?.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      foldersEl.querySelectorAll('button').forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentBox = btn.getAttribute('data-box');
      viewEl.innerHTML = '<div class="placeholder">Select a message to preview</div>';
      renderList();
    });
  });

  // search
  searchEl?.addEventListener('input', () => renderList());

  // toolbar shortcuts (mark read/delete selected)
  $('#mark-read')?.addEventListener('click', () => {
    if(!selectedId) return;
    const m = mails.find(x=>x.id===selectedId);
    if(m){ m.unread = false; unreadCount(); renderList(); }
  });
  $('#delete')?.addEventListener('click', () => {
    if(!selectedId) return;
    const idx = mails.findIndex(x=>x.id===selectedId);
    if(idx>-1){ mails[idx].box = 'trash'; selectedId = null; viewEl.innerHTML = '<div class="placeholder">Select a message to preview</div>'; renderList(); }
  });

  // compose modal (placeholder)
  const dlg = document.getElementById('compose-dialog');
  document.getElementById('mail-compose')?.addEventListener('click', () => dlg?.showModal());

  // init
  unreadCount();
  renderList();
  // expose small API so other modules (ransom-search) can add a mail dynamically
window.MailApp = {
  addMail: function(m){
    try {
      // basic defaults like those used in seed
      const msg = Object.assign({
        id: 'm'+(Date.now()%100000),
        box: 'inbox',
        from: 'noreply@example',
        subject: '(no subject)',
        snippet: '',
        time: new Date().toLocaleTimeString(),
        unread: true,
        starred: false,
        body: ''
      }, m);

      mails.unshift(msg); // add to top

      // 🔊 DŹWIĘK: nowy mail w inboxie
      if (msg.box === 'inbox' && msg.unread && window.SFX && typeof SFX.play === 'function'){
        SFX.play('mail');

        // jeśli gracz nie jest w zakładce mail → podświetl ją
        try {
          const mailTab = document.getElementById('tab-mail');
          if (mailTab && !mailTab.classList.contains('is-active')) {
            mailTab.classList.add('tab-has-unread');
          }
        } catch(e){ /* ignore */ }
      }

      unreadCount();
      renderList();

    } catch(e){
      console.warn('MailApp.addMail err', e);
    }
  }
};

})();
