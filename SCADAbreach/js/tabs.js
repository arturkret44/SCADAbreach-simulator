(function(){
const tabbar = document.querySelector('.tabbar');
const tabs = () => Array.from(document.querySelectorAll('.tabbar .tab'));
const panels = () => Array.from(document.querySelectorAll('.viewport .panel'));


function activateTab(tab){
if(!tab) return;
const id = tab.getAttribute('aria-controls');
tabs().forEach(t => {
const active = t === tab;
t.classList.toggle('is-active', active);
t.setAttribute('aria-selected', String(active));
});
panels().forEach(p => {
const show = p.id === id;
p.hidden = !show;
p.classList.toggle('is-active', show);
});
  // jeśli przechodzimy na zakładkę mail – usuń niebieskie podświetlenie
  if (tab.id === 'tab-mail') {
    tab.classList.remove('tab-has-unread');
  }
  // Jeśli aktywowaliśmy Terminal, ustaw fokus na input
  if (id === 'panel-terminal') {
    setTimeout(() => {
      document.getElementById('terminal-input')?.focus();
    }, 0);
  }

}

function closeTab(tab){
  if(!tab) return;
  const all = tabs();
  if(all.length === 1) return; // nie zamykaj ostatniej karty
  const idx = all.indexOf(tab);
  const panelId = tab.getAttribute('aria-controls');
  const panel = document.getElementById(panelId);
  tab.remove();
  panel?.remove();
  const remaining = tabs();
  const nextIdx = Math.min(idx, remaining.length - 1);
  activateTab(remaining[nextIdx]);
  remaining[nextIdx].focus();
}

// Click handling
tabbar.addEventListener('click', (e) => {
const target = e.target.closest('.tab, .tab-add');
const closeBtn = e.target.closest('.tab-close');
if(closeBtn){
  const tabEl = closeBtn.closest('.tab');
  // zamykamy tylko karty dynamiczne (te z id zaczynającym się na 'tab-dynamic-')
  if(tabEl && tabEl.id && tabEl.id.startsWith('tab-dynamic-')){
    closeTab(tabEl);
  }
  return;
}

if(!target) return;
//if(target.classList.contains('tab-add')){
// Przykładowo duplikuje bieżącą zakładkę – na razie mock
//const t = tabs().at(-1);
//const clone = t.cloneNode(true);
//const uid = 'dynamic-' + Math.random().toString(36).slice(2,8);
//clone.id = 'tab-dynamic-' + uid;
//clone.setAttribute('aria-controls', 'panel-dynamic-' + uid);

//clone.querySelector('.tab-title').textContent = 'New tab';
// dodaj pokaż krzyżyk TYLKO w nowej karcie
//let closeBtn = clone.querySelector('.tab-close');
//if(!closeBtn){
  //closeBtn = document.createElement('span');
  //closeBtn.className = 'tab-close';
  //closeBtn.setAttribute('aria-label','Close Tab');
  //closeBtn.textContent = '×';
  //clone.appendChild(closeBtn);
//}
// upewnij się, że nie jest ukryty (główne mają hidden w HTML)
//closeBtn.hidden = false;

//tabbar.insertBefore(clone, document.querySelector('.tabbar-spacer'));


//const panel = panels().at(-1).cloneNode(true);
//panel.id = 'panel-dynamic-' + uid;
//panel.querySelector('h1').textContent = 'empty card';
//panel.querySelector('p').textContent = 'Tu dodamy zawartość później.';
//document.querySelector('.viewport').appendChild(panel);
//activateTab(clone);
//return;
//}
if(target.classList.contains('tab')) activateTab(target);
});


// Klawiatura: Ctrl+Tab / Ctrl+Shift+Tab między zakładkami
document.addEventListener('keydown', (e) => {
const isCtrlTab = (e.ctrlKey || e.metaKey) && e.key === 'Tab';
if(!isCtrlTab) return;
e.preventDefault();
const list = tabs();
const idx = list.findIndex(t => t.classList.contains('is-active'));
const dir = e.shiftKey ? -1 : 1;
const next = (idx + dir + list.length) % list.length;
activateTab(list[next]);
list[next].focus();
});


// Inicjalizacja
activateTab(document.querySelector('.tab.is-active'));
})();
