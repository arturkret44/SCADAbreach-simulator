// js/app.js
console.log('Aplikacja wystartowała. Dodawaj moduły w js');

document.addEventListener('DOMContentLoaded', () => {
  if (window.BlueUI && window.BlueData) {
    BlueUI.start(); // uruchamia UI + symulację
  }
});
(function(){
  const backdrop = document.getElementById("disclaimer-backdrop");
  const check    = document.getElementById("disclaimer-accept-check");
  const btn      = document.getElementById("disclaimer-accept");

  if (!backdrop || !check || !btn) return;

  // Jeśli już zaakceptowane – NIC NIE ROBIMY, overlay zostaje ukryty (display:none)
  if (localStorage.getItem("disclaimerAccepted") === "yes") {
    return;
  }

  // 👇 TUTAJ: user jeszcze nie zaakceptował → dopiero teraz pokazujemy
  backdrop.style.display = "flex";

  btn.disabled = !check.checked;

  check.addEventListener("change", function () {
    btn.disabled = !this.checked;
  });

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    localStorage.setItem("disclaimerAccepted", "yes");

    // możesz od razu ukryć:
    backdrop.style.display = "none";
  });
})();
// === Simple global SFX helper ===
(function(){
  const sounds = {};

  function load(name, src){
    const a = new Audio(src);
    a.preload = 'auto';
    sounds[name] = a;
  }

  // Załaduj swoje dźwięki
  load('mail',      'media/sfx/mail.mp3');
  load('news',      'media/sfx/news.mp3');
  load('overload',  'media/sfx/overload.mp3');
  load('critical',  'media/sfx/critical.mp3');

  window.SFX = {
    play(name){
      const a = sounds[name];
      if (!a) return;
      try {
        // restart od początku, żeby szybkie eventy nie czekały na koniec poprzedniego
        a.currentTime = 0;
        a.play().catch(()=>{ /* autoplay block itd. ignorujemy */ });
      } catch(e){}
    }
  };
})();
