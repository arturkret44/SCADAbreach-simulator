// js/map.js — real GeoJSON land + 40 dots + hover tooltips
(function(){
  const cvs = document.getElementById('world-map');
  if(!cvs) return;
  const ctx = cvs.getContext('2d');

  let hovered = null; // aktualnie wskazywana kropka (dla tooltipa)

  // --- Projection (equirectangular) ---
  function project(lat, lon){
    const x = (lon + 180) / 360 * cvs.width;
    const y = (90 - lat) / 180 * cvs.height;
    return [x, y];
  }

  function drawBackdrop(){
    const g = ctx.createLinearGradient(0,0,0,cvs.height);
    g.addColorStop(0, '#0c1118');
    g.addColorStop(1, '#0a0e14');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,cvs.width,cvs.height);

    // graticule
    ctx.strokeStyle = 'rgba(138,180,248,0.07)';
    ctx.lineWidth = 1;
    for(let lat = -60; lat <= 60; lat += 30){
      const [, y] = project(lat, 0);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke();
    }
    for(let lon = -180; lon <= 180; lon += 60){
      const [xTop, yTop] = project(80, lon);
      const [xBot, yBot] = project(-80, lon);
      ctx.beginPath(); ctx.moveTo(xTop, yTop); ctx.lineTo(xBot, yBot); ctx.stroke();
    }
  }

  // --- draw GeoJSON polygons (MultiPolygon/Polygon) ---
  function drawGeoJSON(geojson){
    ctx.strokeStyle = 'rgba(180,200,230,0.10)';
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1.2;

    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];

    for(const f of features){
      const g = f.geometry;
      if(!g) continue;

      const polys = g.type === 'Polygon' ? [g.coordinates] :
                    g.type === 'MultiPolygon' ? g.coordinates : [];

      for(const poly of polys){
        // poly = [ring1, ring2 (holes), ...]
        ctx.beginPath();
        for(let r = 0; r < poly.length; r++){
          const ring = poly[r]; // [[lon,lat], ...]
          for(let i = 0; i < ring.length; i++){
            const lon = ring[i][0];
            const lat = ring[i][1];
            const [x,y] = project(lat, lon);
            if(i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
          }
          ctx.closePath(); // zamknij ring
        }
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // --- 40 popular countries (approx centroids) ---
  const countries40 = [
    ['USA',39.8,-98.6], ['Canada',56.1,-106.3], ['Mexico',23.6,-102.5],
    ['Brazil',-14.2,-51.9], ['Argentina',-38.4,-63.6],
    ['UK',54.0,-2.0], ['France',46.2,2.2], ['Germany',51.2,10.4], ['Italy',42.8,12.8],
    ['Spain',40.3,-3.7], ['Netherlands',52.1,5.3], ['Switzerland',46.8,8.2], ['Austria',47.6,14.1],
    ['Poland',52.1,19.4], ['Sweden',62.0,15.0], ['Norway',62.0,10.0], ['Finland',64.5,26.0], ['Denmark',56.1,9.6],
    ['Czechia',49.8,15.5], ['Romania',45.9,24.9], ['Turkey',39.0,35.2], ['Russia',60.0,90.0], ['Ukraine',49.0,32.0],
    ['Saudi Arabia',23.6,45.1], ['UAE',24.4,54.4],
    ['India',22.9,79.9], ['Pakistan',30.4,69.4], ['China',35.9,104.2],
    ['Japan',36.2,138.0], ['South Korea',36.5,127.9], ['Thailand',15.1,101.2], ['Vietnam',14.1,108.3], ['Indonesia',-2.5,118.0],
    ['Australia',-25.3,133.8], ['South Africa',-29.0,24.0], ['Egypt',26.8,30.8], ['Nigeria',9.1,8.7], ['Morocco',31.8,-7.1],
    ['Iran',32.4,53.7], ['Philippines',12.8,122.9]
  ];

  // --- opisy elektrowni (kraj -> [tytuł, opis]) ---
  const plantInfo = {
    'USA': ['Libernova Plant', 'A next-generation nuclear power station with a capacity of 3.2 GW, providing electricity to over 5 million homes. Known for its advanced safety systems and efficiency.'],
    'Canada': ['Maplorion Station', 'A vast hydroelectric facility producing 2.5 GW, drawing power from strong river currents in the north. It plays a key role in Canada’s renewable energy grid.'],
    'Mexico': ['Aztelon Energia', 'A 1.8 GW combined solar and natural gas plant, ensuring stable power even during cloudy days. It supports Mexico’s growing industrial regions.'],
    'Brazil': ['Amazonara Complex', 'A massive 3.6 GW hydroelectric complex built along the Amazon River. It supplies much of northern Brazil with clean energy.'],
    'Argentina': ['Pampyros Facility', 'A 1.4 GW wind and solar hybrid facility located in the Pampas. Its wide plains make it ideal for constant wind power.'],
    'UK': ['Albryth Powerworks', 'A 2.1 GW nuclear and offshore wind hybrid plant. It symbolizes the UK’s transition to greener energy sources.'],
    'France': ['Lumivère Station', 'A state-of-the-art nuclear plant delivering 3.5 GW of stable electricity. It continues France’s tradition of relying heavily on nuclear power.'],
    'Germany': ['Rheindrax Plant', 'A 2.2 GW advanced natural gas station located by the Rhine. Designed to balance Germany’s solar and wind energy with reliable backup.'],
    'Italy': ['Vesunova Energia', 'A 1.6 GW geothermal and solar hybrid facility near volcanic zones. It harnesses both the sun and the Earth’s heat for sustainable power.'],
    'Spain': ['Iberasolix Plant', 'A 2.0 GW solar farm spread across vast sun-drenched fields. It’s one of the largest solar installations in Southern Europe.'],
    'Netherlands': ['Tulivento Station', 'A 1.3 GW wind power network, with iconic offshore turbines in the North Sea. It provides clean energy to Dutch cities.'],
    'Switzerland': ['Matterion Energie', 'A 1.9 GW hydro plant hidden among the Alps. Mountain reservoirs guarantee power during peak demand hours.'],
    'Austria': ['Alpenyra Plant', 'A 1.2 GW pumped-storage hydro facility. It works like a giant battery, storing energy by moving water up and down the mountains.'],
    'Poland': ['Vistara Station', 'A 2.3 GW coal-to-gas converted plant, modernized for cleaner emissions. It powers a significant part of central Poland.'],
    'Sweden': ['Nordalis Energy', 'A 2.0 GW nuclear and hydro mix, ensuring stability even during long winters. It’s a cornerstone of Sweden’s low-carbon strategy.'],
    'Norway': ['Fjordyra Hydro', 'A 2.7 GW hydropower station built into dramatic fjords. Almost entirely emissions-free, it powers much of Norway’s west coast.'],
    'Finland': ['Aurivanta Energia', 'A 1.5 GW biomass and nuclear hybrid plant. It makes use of Finland’s vast forests alongside advanced reactors.'],
    'Denmark': ['Skandora Windworks', 'A 1.8 GW offshore wind farm, stretching across the Baltic Sea. It’s Denmark’s flagship renewable project.'],
    'Czechia': ['Bohemora Plant', 'A 2.0 GW nuclear facility, central to the Czech grid. It provides reliable base load power across the country.'],
    'Romania': ['Carpathora Station', 'A 1.6 GW hydro and nuclear hybrid plant located near the Carpathian Mountains. It balances renewable sources with steady nuclear output.'],
    'Turkey': ['Anatryon Enerji', 'A 2.4 GW natural gas and solar mix. Positioned to serve both major cities and rural regions.'],
    'Russia': ['Volgryn Complex', 'A 4.0 GW hydro and nuclear mega-complex on the Volga River. One of the most powerful facilities in Eastern Europe.'],
    'Ukraine': ['Dniprovia Plant', 'A 2.8 GW hydroelectric station along the Dnipro River. It remains vital to Ukraine’s energy independence.'],
    'Saudi Arabia': ['Deserion Sunworks', 'A 3.5 GW desert solar farm. It captures endless sunlight and feeds energy into growing cities.'],
    'UAE': ['Sahranix Station', 'A 2.2 GW hybrid of solar towers and natural gas. Designed for both day-time peak and night-time stability.'],
    'India': ['Gangetra Shakti Plant', 'A 3.1 GW coal, solar, and hydro mix. It powers millions while gradually shifting toward renewables.'],
    'Pakistan': ['Indaryon Energia', 'A 1.7 GW hydro station along the Indus River. Seasonal water flow makes it both powerful and unpredictable.'],
    'China': ['Longhua Nova', 'A colossal 5.0 GW nuclear and solar mega-plant. It stands as one of Asia’s largest energy hubs.'],
    'Japan': ['Fujinari Works', 'A 2.6 GW advanced nuclear station built with earthquake-resistant technology. Safety is its highest priority.'],
    'South Korea': ['Hanryth Power', 'A 2.3 GW nuclear and offshore wind combination. It helps balance Korea’s heavy industrial demand.'],
    'Thailand': ['Siamora Solar', 'A 1.5 GW solar park in central plains. Its endless sunlight provides clean energy year-round.'],
    'Vietnam': ['Mekoryn Plant', 'A 1.4 GW coal-to-gas converted plant. Modernized to reduce emissions while meeting rapid growth needs.'],
    'Indonesia': ['Nusaryon Station', 'A 2.0 GW geothermal complex on volcanic islands. It turns natural volcanic heat into stable electricity.'],
    'Australia': ['Australis Nova', 'A 2.5 GW solar and wind mix in the outback. It showcases Australia’s push toward renewable exports.'],
    'South Africa': ['Ubunara Station', 'A 2.0 GW coal and solar hybrid facility. Built to modernize the grid while cutting carbon output.'],
    'Egypt': ['Nilyth Complex', 'A 2.9 GW hydro station on the Nile. Its water flow has powered Egypt for generations.'],
    'Nigeria': ['Lagoryn Energia', 'A 1.8 GW natural gas facility. It stabilizes Nigeria’s power grid and supports urban growth.'],
    'Morocco': ['Atlorya Solar', 'A 2.2 GW desert solar array. Famous for storing energy in molten salt, providing power even at night.'],
    'Iran': ['Persenyx Plant', 'A 2.6 GW nuclear plant, key to the country’s long-term energy strategy. It supplies steady base load power.'],
    'Philippines': ['Baynara Station', 'A 1.7 GW geothermal plant, built on volcanic terrain. It provides reliable green energy to the archipelago.'],
  };
const countryToPlantId = {
  'USA': 'usa-libernova',
  'Canada': 'canada-maplorion',
  'Mexico': 'mexico-aztelon',
  'Brazil': 'brazil-amazonara',
  'Argentina': 'argentina-pampyros',
  'UK': 'uk-albryth',
  'France': 'france-lumivere',
  'Germany': 'germany-rheindrax',
  'Italy': 'italy-vesunova',
  'Spain': 'spain-iberasolix',
  'Netherlands': 'netherlands-tulivento',
  'Switzerland': 'switzerland-matterion',
  'Austria': 'austria-alpenyra',
  'Poland': 'poland-vistara',
  'Sweden': 'sweden-nordalis',
  'Norway': 'norway-fjordyra',
  'Finland': 'finland-aurivanta',
  'Denmark': 'denmark-skandora',
  'Czechia': 'czechia-bohemora',
  'Romania': 'romania-carpathora',
  'Turkey': 'turkey-anatryon',
  'Russia': 'russia-volgryn',
  'Ukraine': 'ukraine-dniprovia',
  'Saudi Arabia': 'saudiarabia-deserion',
  'UAE': 'uae-sahranix',
  'India': 'india-gangetra',
  'Pakistan': 'pakistan-indaryon',
  'China': 'china-longhua',
  'Japan': 'japan-fujinari',
  'South Korea': 'korea-hanryth',
  'Thailand': 'thailand-siamora',
  'Vietnam': 'vietnam-mekoryn',
  'Indonesia': 'indonesia-nusaryon',
  'Australia': 'australia-australisnova',
  'South Africa': 'southafrica-ubunara',
  'Egypt': 'egypt-nilyth',
  'Nigeria': 'nigeria-lagoryn',
  'Morocco': 'morocco-atlorya',
  'Iran': 'iran-persenyx',
  'Philippines': 'philippines-baynara',
};

  const dots = countries40.map(([name, lat, lon]) => {
    const [x, y] = project(lat, lon);
    const info = plantInfo[name] || [name, ''];
    return {
      name,
      x, y,
      phase: Math.random() * Math.PI * 2,
      label: `${name} – ${info[0]}`,
      desc: info[1]
    };
  });

// --- Statusy kropek: 'normal' | 'warn' | 'critical'
const dotStatus = new Map(); // mapa: countryName -> status

function colorFor(status){
  switch(status){
    case 'warn':
      return { core: 'rgb(255,210,0)', glow: 'rgba(255,210,0,0.10)' };   // żółty

    case 'critical':
      return { core: 'rgb(255,70,70)', glow: 'rgba(255,70,70,0.12)' };   // czerwony

    case 'overload':
      return { core: 'rgb(255,140,0)', glow: 'rgba(255,140,0,0.14)' };   // pomarańczowy

    default:
      return { core: 'rgb(0,255,120)', glow: 'rgba(0,255,120,0.10)' };   // zielony (OK)
  }
}

function setDotStatus(countryName, status){
  dotStatus.set(countryName, status);
  // nic więcej nie trzeba — pętla rysowania i tak chodzi w requestAnimationFrame
}


  function drawDots(t){
    const time = t / 1000;
    for(const d of dots){
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + d.phase);
      const radius = 3 + pulse * 2;

const st = dotStatus.get(d.name) || 'normal';
const palette = colorFor(st);

// glow
ctx.beginPath();
ctx.arc(d.x, d.y, radius * 3, 0, Math.PI*2);
ctx.fillStyle = palette.glow;
ctx.fill();

// core
ctx.beginPath();
ctx.arc(d.x, d.y, radius, 0, Math.PI*2);
ctx.fillStyle = palette.core;
ctx.fill();

    }
  }

  // --- tooltip helpers ---
  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  function wrapText(text, maxWidth){
    if(!text) return [];
    ctx.save();
    ctx.font = '400 12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for(const w of words){
      const test = line ? line + ' ' + w : w;
      if(ctx.measureText(test).width > maxWidth){
        if(line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if(line) lines.push(line);
    ctx.restore();
    return lines;
  }

  function drawTooltip(dot){
    const pad = 10;
    const maxW = Math.min(320, cvs.width - dot.x - 20);
    const title = dot.label;
    const body = dot.desc || '';

    // wymiary
    const titleH = 14;   // wysokość linii tytułu
    const gap    = 20;   // >>> wiekszy odstęp między tytułem a opisem <<<
    ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    const titleW = ctx.measureText(title).width;

    ctx.font = '400 12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    const lineH = 16;
    const bodyLines = wrapText(body, maxW);
    const bodyW = Math.max(0, ...bodyLines.map(l => ctx.measureText(l).width));
    const bodyH = bodyLines.length * lineH;

    const boxW = Math.ceil(Math.max(titleW, bodyW)) + pad*2;
    const boxH = pad*2 + titleH + gap + bodyH;
    // pozycja z bezpiecznym odbiciem od krawędzi
    let bx = dot.x + 14;
    let by = dot.y + 14;
    if(bx + boxW > cvs.width - 6) bx = cvs.width - 6 - boxW;
    if(by + boxH > cvs.height - 6) by = dot.y - 14 - boxH;

    // tło + obrys
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(12,17,24,0.96)';
    roundRect(ctx, bx, by, boxW, boxH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(138,180,248,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, boxW, boxH, 8);
    ctx.stroke();

// separator pod tytułem (opcjonalnie)
ctx.beginPath();
ctx.moveTo(bx + pad, by + pad + titleH + Math.floor(gap/2));
ctx.lineTo(bx + boxW - pad, by + pad + titleH + Math.floor(gap/2));
ctx.strokeStyle = 'rgba(138,180,248,0.15)';
ctx.lineWidth = 1;
ctx.stroke();

    // tekst
    ctx.fillStyle = 'white';
    ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    const titleY = by + pad + 13;   // 13px dla 13px fontu wygląda lepiej niż "titleH"
    ctx.fillText(title, bx + pad, titleY);
    ctx.font = '400 12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, sans-serif';
    let ty = titleY + gap;
    for(const line of bodyLines){
      ctx.fillText(line, bx + pad, ty);
      ty += lineH;
    }
    ctx.restore();

    // cienka linia łącząca dymek z kropką
    ctx.beginPath();
    ctx.moveTo(dot.x + 6, dot.y + 6);
    ctx.lineTo(bx + 8, by + 8);
    ctx.strokeStyle = 'rgba(0,255,120,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // --- hover detection ---
cvs.addEventListener('mousemove', (e) => {
  const rect = cvs.getBoundingClientRect();

  // skalowanie: z rozmiaru widocznego (CSS) do logicznego (canvas.width / canvas.height)
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;

  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  let found = null;
  const hitR2 = 10 * 10; // promień trafienia w jednostkach canvas
  for (const d of dots) {
    const dx = mx - d.x;
    const dy = my - d.y;
    if (dx*dx + dy*dy <= hitR2) { found = d; break; }
  }
  hovered = found;
  cvs.style.cursor = hovered ? 'pointer' : 'default';
});

  // Kliknięcie w kropkę: przejście do Blue Team + filtr na dany plant
  cvs.addEventListener('click', () => {
    if (!hovered) return;

    const country = hovered.name;
    const plantId = countryToPlantId[country];
    if (!plantId) return; // brak powiązania — nic nie rób

    // 1) przełącz zakładkę na Blue Team
    const blueTab = document.getElementById('tab-blue');
    if (blueTab) {
      blueTab.click();
    }

    // 2) ustaw plant w Blue Team
    if (window.BlueUI && typeof window.BlueUI.focusPlant === 'function') {
      window.BlueUI.focusPlant(plantId);   // ⬅︎ tu była pomyłka
    } else {
      // fallback: jakby BlueUI jeszcze się nie zainicjalizowało
      localStorage.setItem('bt.currentPlant', plantId);
    }
  });

  // --- render loop ---
  let landGeoJSON = null;

  function frame(t){
    drawBackdrop();
    if(landGeoJSON){
      drawGeoJSON(landGeoJSON);
    } else {
      // nic — tylko tło i siatka, dopóki nie załaduje się mapa
    }
    drawDots(t);
    if(hovered){ drawTooltip(hovered); } // dymek na wierzchu
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // --- load GeoJSON (non-blocking) ---
  fetch('data/world-110m-land.json')
    .then(r => r.json())
    .then(json => { landGeoJSON = json; })
    .catch(() => {
      console.warn('GeoJSON not found. Using fallback background only.');
    });
// --- Integracja z resztą gry: reaguj na eventy statusu plantów ---
// Oczekujemy eventu: App.bus.dispatchEvent(new CustomEvent('plant:status', { detail:{ country:'Poland', status:'warn' } }))
(function hookStatuses(){
  window.App = window.App || {};
  App.bus = App.bus || new EventTarget();

  App.bus.addEventListener('plant:status', (e) => {
    const { country, status } = e.detail || {};
    if(!country || !status) return;

    const prev = dotStatus.get(country) || 'normal';
    setDotStatus(country, status);

    // 🔊 DŹWIĘK: zmiana statusu kraju / elektrowni
    if (window.SFX && typeof SFX.play === 'function'){
      if (status === 'critical' && prev !== 'critical'){
        SFX.play('critical');     // czerwony
      } else if (status === 'overload' && prev !== 'overload'){
        SFX.play('overload');     // pomarańczowy challenge
      }
    }

    if (window.PlantState && typeof window.PlantState.setCountryStatus === 'function') {
      window.PlantState.setCountryStatus(country, status);
    }
  });

})();

})();
