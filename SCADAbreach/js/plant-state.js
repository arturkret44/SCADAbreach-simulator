// js/plant-state.js — wspólny stan elektrowni dla mapy + Power Plant
(function(){
  const PlantState = {
    // mapy pomocnicze
    plantsById: new Map(),       // id -> plant (z plants.json)
    plantsByCountry: new Map(),  // country -> [id, id, ...]
    statusById: new Map(),       // id -> 'normal' | 'warn' | 'critical' | 'overload'
    overloadTimers: new Map(),   // id -> timeout handle dla przeciążenia

    // rejestrujemy listę plantów z plants.json (wywoła to power.js)
    registerPlants(list){
      if (!Array.isArray(list)) return;
      list.forEach(p => {
        const country = p.country || p.country_name || 'Unknown';
        // Spróbuj użyć fielda id, jeśli istnieje; inaczej zbuduj pseudo-id
        const slugName = (p.name || '')
          .toLowerCase()
          .replace(/\s+/g,'-')
          .replace(/[^a-z0-9-]/g,'');
        const id = p.id || `${country.toLowerCase()}-${slugName || 'plant'}`;

        // zapamiętaj plant
        this.plantsById.set(id, p);

        // indeks po kraju
        const arr = this.plantsByCountry.get(country) || [];
        if (!arr.includes(id)) arr.push(id);
        this.plantsByCountry.set(country, arr);

        // jeśli brak stanu, ustaw normal
        if (!this.statusById.has(id)) {
          this.statusById.set(id, 'normal');
        }

        // schowaj id do obiektu, żeby power.js miał łatwiej
        p.__plantId = id;
      });
    },

    // aktualizacja po stronie kraju (przychodzi z eventu plant:status)
    setCountryStatus(country, status){
      if (!country || !status) return;
      const ids = this.plantsByCountry.get(country) || [];

      // jeśli mamy planty przypięte do kraju -> ustaw im stan
      if (ids.length){
        ids.forEach(id => this.statusById.set(id, status));
      } else {
        // fallback: zapamiętaj "sam kraj" (na wypadek, gdyby nie było powiązań)
        const key = `country:${country}`;
        this.statusById.set(key, status);
      }
    },

    // odczyt aktualnego stanu dla konkretnego planta (obiekt z plants.json)
    getStatusForPlant(plant){
      if (!plant) return 'normal';
      const id = plant.__plantId || plant.id;
      if (id && this.statusById.has(id)) return this.statusById.get(id);

      const country = plant.country || plant.country_name;
      if (!country) return 'normal';

      const key = `country:${country}`;
      return this.statusById.get(key) || 'normal';
    },

    // czy plant jest przejęty (atak) i ma być zablokowany w UI
    //  - 'warn'      -> przejęty / zagrożony
    //  - 'critical'  -> przejęty (rozlany ransomware)
    //  - 'overload'  -> NIE jest przejęty (to nasz challenge dla gracza)
    isLocked(plant){
      const st = this.getStatusForPlant(plant);
      return st === 'warn' || st === 'critical';
    },

    // helper do przywracania na zielono po udanym shutdown (np. przy overload)
    setPlantNormal(plant){
      if (!plant) return;
      const id = plant.__plantId || plant.id;
      if (id) this.statusById.set(id, 'normal');

      // wyczyść ewentualny timer przeciążenia
      const t = this.overloadTimers.get(id);
      if (t){
        clearTimeout(t);
        this.overloadTimers.delete(id);
      }

      const country = plant.country || plant.country_name;
      if (country && window.App && App.bus){
        App.bus.dispatchEvent(new CustomEvent('plant:status', {
          detail:{ country, status:'normal' }
        }));
      }
    },

    // ===== OVERLOAD: ustawienie przeciążenia dla konkretnej elektrowni =====
    setOverloadForPlant(plant){
      if (!plant) return;
      const id = plant.__plantId || plant.id;
      if (!id) return;

      const current = this.statusById.get(id) || 'normal';
      // przeciążamy tylko zdrowe planty
      if (current !== 'normal') return;

      this.statusById.set(id, 'overload');

      const country = plant.country || plant.country_name;
      if (country && window.App && App.bus){
        // powiadom mapę / resztę gry
        App.bus.dispatchEvent(new CustomEvent('plant:status', {
          detail:{ country, status:'overload' }
        }));
      }
  // --- Blue Team alert dla overload (pomarańczowy stan) ---
  try {
    const BD = window.BlueData;
    if (BD) {
      const plantId   = id;
      const plantName = plant.name || plantId;
      const alert = {
        plant_id: plantId,
        plant_name: plantName,
        severity: 'high',    // pomarańczowy challenge, ale poważny
        title: 'Grid overload – intrusion attempt detected',
        summary: `Network instability and a possible intrusion attempt were detected at ${plantName}. Risk of remote takeover. Use the "Power Plant" panel to perform an emergency shutdown and prevent compromise.`,
        type: 'overload',
        status: 'new'
      };

      if (typeof BD.createAlert === 'function') {
        BD.createAlert(alert);
      } else {
        // fallback jak w innych miejscach: ręczne dopchnięcie alertu
        (BD.alerts ||= []).unshift({
          id: Math.random().toString(36).slice(2),
          created_at: Date.now(),
          updated_at: Date.now(),
          ...alert,
          evidence_ids: []
        });
        if (typeof BD.emit === 'function') {
          BD.emit('alert', alert);
          BD.emit('update');
        }
      }
    }
  } catch(e) {
    // cicho ignorujemy, żeby nie rozwalić gry jeśli BlueData jeszcze nie istnieje
  }

      // uruchom 60-sekundowy licznik – jeśli gracz nie zareaguje, plant -> critical
      const self = this;
      const old = this.overloadTimers.get(id);
      if (old){
        clearTimeout(old);
      }

      const handle = setTimeout(function(){
        const cur = self.statusById.get(id);
        if (cur === 'overload'){
          self.statusById.set(id, 'critical');

          const country2 = plant.country || plant.country_name;
          if (country2 && window.App && App.bus){
            App.bus.dispatchEvent(new CustomEvent('plant:status', {
              detail:{ country: country2, status:'critical' }
            }));
          }
        }
        self.overloadTimers.delete(id);
      }, 60 * 1000);

      this.overloadTimers.set(id, handle);

    },

    // wybierz losowy „normalny” plant
    pickRandomNormalPlant(){
      const normals = [];
      this.plantsById.forEach((p,id) => {
        const st = this.statusById.get(id) || 'normal';
        if (st === 'normal'){
          normals.push(p);
        }
      });
      if (!normals.length) return null;
      const idx = Math.floor(Math.random() * normals.length);
      return normals[idx] || null;
    },

    // odpalenie cyklu przeciążeń (wywołamy to z ransom.js po eskalacji)
    startOverloadCycle(){
      // żeby nie odpalać wielu intervali naraz
      if (this._overloadTimer) return;

      const intervalMs = 8 * 60 * 1000; // 8 minut (na dev możesz zmniejszyć)

      this._overloadTimer = setInterval(() => {
        this.triggerRandomOverload();
      }, intervalMs);
    },

    // NOWE: zatrzymanie cyklu przeciążeń + czyszczenie timeoutów overload
    stopOverloadCycle(){
      // zatrzymaj główny interval
      if (this._overloadTimer){
        clearInterval(this._overloadTimer);
        this._overloadTimer = null;
      }

      // wyczyść wszystkie pending timeouty, które mogłyby zmienić 'overload' -> 'critical'
      try {
        this.overloadTimers.forEach((handle, id) => {
          clearTimeout(handle);
        });
      } catch(e){}
      this.overloadTimers.clear();
    },

    // NOWE: sprawdzenie, czy wszystkie znane planty są w stanie 'critical'
    areAllCritical(){
      let any = false;
      for (const [id, plant] of this.plantsById.entries()){
        any = true;
        const st = this.statusById.get(id) || 'normal';
        if (st !== 'critical') return false;
      }
      return any; // true tylko jeśli mamy choć jedną plantę i wszystkie są critical
    },

    // pojedyncze losowanie przeciążenia
    triggerRandomOverload(){
      const plant = this.pickRandomNormalPlant();
      if (!plant) return;
      this.setOverloadForPlant(plant);
    }

  };

  // === Integracja z App.bus: reagujemy na globalne eventy plant:status ===
  try{
    window.App = window.App || {};
    App.bus = App.bus || new EventTarget();

    App.bus.addEventListener('plant:status', (e) => {
      const d = e.detail || {};
      if (!d.country || !d.status) return;
      PlantState.setCountryStatus(d.country, d.status);
    });
  }catch(e){ /* ignore */ }

  window.PlantState = PlantState;
})();
