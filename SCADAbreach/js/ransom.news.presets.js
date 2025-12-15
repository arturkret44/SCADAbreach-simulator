// js/ransom.news.presets.js
// Konfiguracja newsów wywoływanych przez ransomware (per elektrownia)

(function(){
  // UWAGA: {plantName} i {country} są podstawiane w phish_scenario.js przez tmpl()
  window.RANSOM_NEWS_PRESETS = {
    // --- POLAND: Vistara Station ---
    "poland-vistara": {
      title: "Vistara Station disruption triggers controlled outages in {country}",
      lead:  "A suspected cyber incident at Vistara Station forces operators to shed load in selected regions.",
      byline: "Reuters • {country}",
      image: "media/news/news_1.webp",
html: `
  <p><strong>{country} — Vistara Station</strong><br>
  Grid operators reported a series of controlled outages after an incident at the
  <strong>{plantName}</strong> power complex early Tuesday.</p>

  <p>According to the control centre, automated SCADA systems at {plantName} began issuing irregular
  commands, prompting engineers to isolate parts of the network and temporarily reduce load.</p>

  <p>“The behaviour strongly suggests a cyber component,” one official said under condition of anonymity.
  “We are working with national CERT teams to verify the full scope of the intrusion.”</p>

  <p>Internal diagnostic logs reviewed by investigators contained a long, cryptic string of characters,
  which analysts believe might represent a digital signature or recovery token fragment used by the attackers:</p>

  <pre class="ioc" style="white-space:pre-wrap;word-break:break-all;margin:8px 0 0;font-size:11px;background:#f8f8f8;padding:6px;border-radius:6px;">
  5057aa624cec4a93c6320d98e67beba964f0b9d2caeb106c0715e41398dcaacd4cdc713b6ab5eb0aaf73265f685ba09b991714d5ed5eb5148901dd6ef89e6c08
  </pre>

  <p>Cybersecurity experts consulted by Reuters noted that the format matches known SHA-512 digests sometimes
  used in staged encryption processes — suggesting this may be part of a broader ransomware framework.</p>

  <p>Short outages were reported in several urban districts, but critical infrastructure remained online
  using backup power and redundant feeds.</p>

  <p>Authorities stressed that there is no indication of a total grid collapse, but security services have
  raised the alert level for other strategic sites connected to {plantName}.</p>
`
},
    // --- USA: Libernova Plant ---
    "usa-libernova": {
      title: "Protective shutdown at {plantName} nuclear facility in {country}",
      lead:  "{plantName} temporarily disconnects from the grid after control system irregularities.",
      byline: "Associated Press • {country}",
      image: "media/news/nuclear_facility.webp",
      html: `
        <p><strong>{country} —</strong> Operators at the <strong>{plantName}</strong> nuclear power station
        initiated a protective shutdown after monitoring systems detected unusual control traffic in the early hours
        of the morning.</p>

        <p>The 3.2 GW facility, which supplies power to several million homes, was disconnected from the grid
        “out of an abundance of caution”, according to the plant’s spokesperson.</p>

        <p>While officials declined to give technical details, they confirmed that cyber specialists have been
        called in to analyse telemetry and event logs from the affected control network.</p>

        <p>Regulators emphasised that all reactor safety systems functioned as designed and that there was
        “no impact on nuclear safety parameters”.</p>
      `
    },

    // --- Canada: Maplorion Station ---
    "canada-maplorion": {
      title: "Hydro output reduced at {plantName} after control anomaly in {country}",
      lead:  "Flow through key turbines at {plantName} is lowered while engineers inspect control commands.",
      byline: "CBC • {country}",
      image: "media/news/hydro.webp",
      html: `
        <p><strong>{country} —</strong> The 2.5 GW <strong>{plantName}</strong> hydro station temporarily reduced
        output on Tuesday after operators observed an “unusual pattern” in remote control instructions.</p>

        <p>Grid dispatchers said the reduction was coordinated to avoid instability and that neighbouring
        plants increased production to compensate for the shortfall.</p>

        <p>Cybersecurity teams are reviewing access logs and VPN connections to determine whether the anomaly
        was linked to malicious activity or a misconfiguration in the automation layer.</p>
      `
    },

    // --- Mexico: Aztelon Energia ---
    "mexico-aztelon": {
      title: "Combined solar–gas plant {plantName} reports forced derating in {country}",
      lead:  "Operators at {plantName} limit output after suspicious commands hit gas turbines.",
      byline: "El Universal • {country}",
      image: "media/news/mexico.webp",
      html: `
        <p><strong>{country} —</strong> The hybrid <strong>{plantName}</strong> station, which combines solar fields
        with gas turbines, reported a forced derating event after controllers received a burst of unexpected
        shutdown instructions.</p>

        <p>Dispatch logs show that several turbines simultaneously entered a low-power mode, triggering alarms
        in the central control room.</p>

        <p>Officials say the plant remains stable and that power has been rerouted from other sources to
        maintain supply to nearby industrial areas.</p>
      `
    },

    // --- Brazil: Amazonara Complex ---
    "brazil-amazonara": {
      title: "Grid operator investigates incident at {plantName} in northern {country}",
      lead:  "Short-lived voltage dips reported after a disturbance at the {plantName} hydro complex.",
      byline: "Folha • {country}",
      image: "media/news/Brazil.webp",
      html: `
        <p><strong>{country} —</strong> Several communities along the transmission corridor supplied by
        <strong>{plantName}</strong> reported brief voltage dips and flickering lights after a disturbance
        in the plant’s control system.</p>

        <p>The 3.6 GW complex, built along a major river, is crucial for regional supply. Engineers say
        that water levels and mechanical systems remain within normal limits.</p>

        <p>The national operator is reviewing whether the disturbance is connected to recent cyber
        probes reported at other high-voltage substations in the region.</p>
      `
    },

    // --- Argentina: Pampyros Facility ---
    "argentina-pampyros": {
      title: "Wind–solar hybrid {plantName} temporarily curtailed in {country}",
      lead:  "{plantName} cuts production after remote control platform shows signs of compromise.",
      byline: "La Nación • {country}",
      image: "media/news/Argentina.webp",
      html: `
        <p><strong>{country} —</strong> The 1.4 GW <strong>{plantName}</strong> hybrid facility briefly
        curtailed production when its remote operations interface started issuing commands that did not
        match operator inputs.</p>

        <p>The operator disconnected the platform and shifted to local control while incident response
        teams began analysing the event.</p>

        <p>Although consumers experienced only minor fluctuations, authorities warned that the case
        highlights growing risks to renewable plants connected via public networks.</p>
      `
    },

    // --- UK: Albryth Powerworks ---
    "uk-albryth": {
      title: "Investigators probe abnormal control traffic at {plantName} in {country}",
      lead:  "Offshore wind and nuclear units at {plantName} placed under tighter monitoring.",
      byline: "BBC • {country}",
      image: "media/news/UK.webp",
      html: `
        <p><strong>{country} —</strong> Supervisory systems at <strong>{plantName}</strong> detected
        abnormal control traffic affecting both on-site nuclear units and connected offshore wind assets.</p>

        <p>Operators say they activated additional manual checks and temporarily limited automated
        set-point changes while the source of the traffic is investigated.</p>

        <p>The national grid company confirmed that overall stability was maintained and that any
        suspicious connections have been blocked.</p>
      `
    },

    // --- France: Lumivère Station ---
    "france-lumivere": {
      title: "{plantName} incident sparks fresh debate on cyber risk in {country}",
      lead:  "France’s nuclear-heavy grid faces questions after transient alarms at {plantName}.",
      byline: "Le Monde • {country}",
      image: "media/news/France.webp",
      html: `
        <p><strong>{country} —</strong> Transient alarms at the <strong>{plantName}</strong> nuclear station
        prompted a brief switch to backup control modes, officials confirmed on Tuesday.</p>

        <p>Although no safety limits were exceeded, the incident has reignited public discussion about
        the resilience of nuclear facilities to remote cyber manipulation.</p>

        <p>The operator stressed that the plant’s layered safety design kept all key systems within
        normal operating envelopes throughout the disturbance.</p>
      `
    },

    // --- Germany: Rheindrax Plant ---
    "germany-rheindrax": {
      title: "Gas-fired {plantName} reports suspicious configuration changes in {country}",
      lead:  "Engineers at {plantName} roll back altered set-points after integrity checks fail.",
      byline: "Der Spiegel • {country}",
      image: "media/news/Niemcy.webp",
      html: `
        <p><strong>{country} —</strong> Staff at <strong>{plantName}</strong> discovered that several
        turbine control set-points had been modified without a corresponding work order or change ticket.</p>

        <p>The changes were reverted and additional monitoring enabled while investigators examine whether
        the modifications were caused by operator error or a hostile intrusion.</p>

        <p>The 2.2 GW plant acts as a flexible backup for renewables and is considered critical
        for balancing the regional grid.</p>
      `
    },

    // --- Italy: Vesunova Energia ---
    "italy-vesunova": {
      title: "Geothermal–solar plant {plantName} enters safe mode in {country}",
      lead:  "{plantName} automatically limits output after control logic detects conflicting commands.",
      byline: "ANSA • {country}",
      image: "media/news/wlochy.webp",
      html: `
        <p><strong>{country} —</strong> The <strong>{plantName}</strong> facility switched several units
        into safe mode after its control logic detected overlapping and conflicting instructions
        from different operator accounts.</p>

        <p>Plant staff say the event did not affect geothermal reservoirs or solar hardware, but
        it temporarily reduced available capacity on the regional grid.</p>

        <p>Forensic teams are now comparing command logs with authentication events to determine
        whether the conflict was the result of a misconfigured script or an attempted compromise.</p>
      `
    },

    // --- Spain: Iberasolix Plant ---
    "spain-iberasolix": {
      title: "Solar farm {plantName} throttled after remote access alert in {country}",
      lead:  "{plantName}, one of the largest solar farms in Southern Europe, briefly reduces output after a security warning.",
      byline: "El País • {country}",
      image: "media/news/hiszpania.webp",
      html: `
        <p><strong>{country} —</strong> Operators at the <strong>{plantName}</strong> solar farm
        temporarily reduced output and isolated part of the control network after monitoring tools
        flagged an unusual remote access attempt.</p>

        <p>The 2.0 GW site is spread across sun-drenched fields and normally supplies a large share
        of daytime demand in the region.</p>

        <p>Engineers say that inverters and field devices were switched to local fallback modes
        while cybersecurity teams review access logs and firewall events.</p>
      `
    },

    // --- Netherlands: Tulivento Station ---
    "netherlands-tulivento": {
      title: "Offshore wind array {plantName} reports anomalous turbine commands in {country}",
      lead:  "Wind turbines at {plantName} briefly enter standby before operators take manual control.",
      byline: "NOS • {country}",
      image: "media/news/Holland.webp",
      html: `
        <p><strong>{country} —</strong> A portion of the <strong>{plantName}</strong> offshore wind
        array entered standby mode after a sequence of unexpected pitch and yaw commands hit several turbines.</p>

        <p>Control room staff quickly switched the affected turbines to manual control and restored
        power export to the onshore grid connection.</p>

        <p>The operator is now investigating whether the anomalous commands originated from a compromised
        maintenance VPN or from misconfigured automation scripts.</p>
      `
    },

    // --- Switzerland: Matterion Energie ---
    "switzerland-matterion": {
      title: "Mountain hydro plant {plantName} triggers safety spill at reservoir in {country}",
      lead:  "Automatic protection at {plantName} opens spillways after control system disturbance.",
      byline: "SRF • {country}",
      image: "media/news/Switzerland.webp",
      html: `
        <p><strong>{country} —</strong> The alpine <strong>{plantName}</strong> facility briefly opened
        its spillways after control channels between the dam and the power house reported inconsistent data.</p>

        <p>Grid operators say the safety behaviour worked as intended and that water levels remain well
        within regulatory limits.</p>

        <p>Specialists are analysing whether the disturbance was related to external interference
        or to a fault in the telemetry infrastructure running through mountain tunnels.</p>
      `
    },

    // --- Austria: Alpenyra Plant ---
    "austria-alpenyra": {
      title: "Pumped-storage site {plantName} suspends cycling operations in {country}",
      lead:  "{plantName} halts routine pump–turbine cycles after scheduling platform shows irregular jobs.",
      byline: "ORF • {country}",
      image: "media/news/Austria.webp",
      html: `
        <p><strong>{country} —</strong> The <strong>{plantName}</strong> pumped-storage facility temporarily
        suspended routine charge–discharge cycles after its scheduling platform generated jobs that did not
        match operator-defined templates.</p>

        <p>The site, often described as a “giant battery” for the grid, remains available for emergency support
        while incident responders validate the integrity of control interfaces.</p>

        <p>Authorities say there is no risk to public safety but warn that any compromise of large-scale storage
        assets could have wider implications for grid stability.</p>
      `
    },

    // --- Sweden: Nordalis Energy ---
    "sweden-nordalis": {
      title: "Mixed nuclear–hydro complex {plantName} under heightened monitoring in {country}",
      lead:  "Additional checks introduced at {plantName} after unexplained set-point changes on a hydro unit.",
      byline: "SVT • {country}",
      image: "media/news/sweden.webp",
      html: `
        <p><strong>{country} —</strong> Operators at <strong>{plantName}</strong> activated heightened
        monitoring procedures when one hydro unit reported set-point changes that could not be traced
        to any logged operator session.</p>

        <p>The affected unit was temporarily run in manual mode, while nuclear units in the same complex
        remained at normal output.</p>

        <p>The incident has prompted calls for a broader review of how shared networks are managed across
        different generation technologies at the site.</p>
      `
    },

       // --- Norway: Fjordyra Hydro ---
    "norway-fjordyra": {
      title: "Fjord hydro plant {plantName} triggers protective response in {country}",
      lead:  "Automatic protections at {plantName} activate after irregular readings on key transmission lines.",
      byline: "NRK • {country}",
      image: "media/news/Norway.webp",
      html: `
        <p><strong>{country} —</strong> The <strong>{plantName}</strong> hydropower station briefly
        reduced output and activated protective schemes after operators observed irregular readings
        on transmission lines leaving the fjord.</p>

        <p>According to the grid operator, the response was automatic and helped prevent wider
        instability in the western region.</p>

        <p>Investigators are reviewing whether the anomalous data originated from faulty sensors,
        communication issues, or deliberate tampering with grid telemetry.</p>
      `
    },

    // --- Finland: Aurivanta Energia ---
    "finland-aurivanta": {
      title: "Biomass–nuclear site {plantName} reports unexplained control session in {country}",
      lead:  "A late-night login at {plantName} triggers incident response and temporary tightening of remote access.",
      byline: "Yle • {country}",
      image: "media/news/finland.webp",
      html: `
        <p><strong>{country} —</strong> The mixed <strong>{plantName}</strong> facility launched
        an internal investigation after operators discovered a control session active under a user
        account that should have been offline.</p>

        <p>While no immediate impact on biomass boilers or nuclear units was observed, remote
        access to several subsystems has been temporarily restricted.</p>

        <p>Officials say the event underscores the importance of monitoring privileged access
        in complex, hybrid plants.</p>
      `
    },

    // --- Denmark: Skandora Windworks ---
    "denmark-skandora": {
      title: "Offshore wind hub {plantName} hit by coordinated set-point changes in {country}",
      lead:  "Multiple turbines at {plantName} receive simultaneous curtailment commands under investigation.",
      byline: "DR • {country}",
      image: "media/news/denmark.webp",
      html: `
        <p><strong>{country} —</strong> Operators at the <strong>{plantName}</strong> offshore wind
        hub are analysing a sequence of coordinated curtailment commands that briefly reduced
        export capacity.</p>

        <p>The incident prompted a switch to local control modes on affected turbines while
        security teams review access logs to the park's central control platform.</p>

        <p>The site, a flagship example of offshore renewables in the Baltic, returned to
        normal operation within hours.</p>
      `
    },

    // --- Czechia: Bohemora Plant ---
    "czechia-bohemora": {
      title: "Nuclear station {plantName} activates manual fallback at control room in {country}",
      lead:  "Operators at {plantName} revert to analogue procedures after disturbance on digital HMI network.",
      byline: "ČTK • {country}",
      image: "media/news/czech.webp",
      html: `
        <p><strong>{country} —</strong> Shift staff at <strong>{plantName}</strong> temporarily
        reverted to analogue panels and backup procedures after the main digital HMI network
        experienced a disturbance.</p>

        <p>The operator stressed that reactor safety functions remained unaffected and that
        the fallback was executed “according to established playbooks”.</p>

        <p>Cyber and IT teams are now examining whether the disruption originated from a
        software fault or from unauthorised activity on the corporate side of the network.</p>
      `
    },

    // --- Romania: Carpathora Station ---
    "romania-carpathora": {
      title: "Hybrid plant {plantName} in {country} pauses exports after cross-site alarm storm",
      lead:  "Hydro and nuclear units at {plantName} temporarily decouple from the grid while alarm flood is investigated.",
      byline: "Agerpres • {country}",
      image: "media/news/romania.webp",
      html: `
        <p><strong>{country} —</strong> The <strong>{plantName}</strong> hydro–nuclear complex
        briefly paused exports to the national grid after control rooms reported a sudden
        “alarm storm” across multiple units.</p>

        <p>Engineers say many of the alarms did not correspond to real-world measurements,
        suggesting a possible issue with the signalling or event processing layer.</p>

        <p>Authorities emphasised that essential cooling and safety systems were not affected,
        but have requested a detailed report on the resilience of shared monitoring platforms
        at the site.</p>
      `
    },
    // --- Turkey: Anatryon Enerji ---
    "turkey-anatryon": {
      title: "{plantName} taken offline temporarily amid control alerts in {country}",
      lead:  "Operators at {plantName} limit exports after unexpected control-plane messages were detected.",
      byline: "Anadolu Agency • {country}",
      image: "media/news/turkey.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} station reduced exports to the grid after operators
        observed irregular control-plane messages affecting turbine governors.</p>

        <p>Dispatchers coordinated with neighbouring sites to cover the shortfall while engineers investigate
        whether the anomaly was caused by a misconfiguration or external interference.</p>

        <p>Plant managers emphasised that safety systems were unaffected and that the reduction was preventative.</p>
      `
    },

    // --- Russia: Volgryn Complex ---
    "russia-volgryn": {
      title: "Major complex {plantName} isolates some units after telemetry inconsistencies in {country}",
      lead:  "Volgryn Complex reduces output on selected feeders while telemetry is validated by engineers.",
      byline: "TASS • {country}",
      image: "media/news/russia.webp",
      html: `
        <p><strong>{country} —</strong> Engineers at the {plantName} mega-complex isolated several units
        after automated monitoring reported inconsistencies in telemetry streams to the dispatch centre.</p>

        <p>The operator said the action was precautionary and designed to protect long-distance transmission
        corridors from cascading faults.</p>

        <p>Investigations are focusing on communication gateways and recent maintenance changes to SCADA nodes.</p>
      `
    },

    // --- Ukraine: Dniprovia Plant ---
    "ukraine-dniprovia": {
      title: "{plantName} curtails flow amid control-system alarms in {country}",
      lead:  "Hydroelectric output at {plantName} reduced following an alarm cascade in supervisory systems.",
      byline: "Ukrinform • {country}",
      image: "media/news/ukraine.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} hydro station temporarily curtailed generation
        after an alarm cascade in supervisory control systems triggered automated protections.</p>

        <p>Operators moved to manual control and are working to reconcile sensor readings with actual plant conditions.</p>

        <p>Authorities assured the public that critical consumers remain served by reserve capacity.</p>
      `
    },

    // --- Saudi Arabia: Deserion Sunworks ---
    "saudiarabia-deserion": {
      title: "Solar mega-park {plantName} reduces export after grid interface fault in {country}",
      lead:  "Export capacity from {plantName} scaled back while engineers check inverters and SCADA links.",
      byline: "SPA • {country}",
      image: "media/news/saudi_arabia.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} desert solar complex temporarily reduced export capacity
        to the national grid after an interface fault was detected between inverters and the grid management system.</p>

        <p>Technicians are performing coordinated checks across string inverters and communication nodes to restore full output.</p>

        <p>Officials say the incident did not affect large consumers thanks to buffer reserves and flexible gas units.</p>
      `
    },

    // --- UAE: Sahranix Station ---
    "uae-sahranix": {
      title: "Hybrid station {plantName} experiences brief control outage, grid holds in {country}",
      lead:  "Sahranix Station briefly lost a supervisory feed; engineers applied contingency scripts to stabilise output.",
      byline: "Gulf News • {country}",
      image: "media/news/UAE.webp",
      html: `
        <p><strong>{country} —</strong> The hybrid {plantName} station experienced a brief loss of a supervisory feed,
        prompting engineers to execute contingency scripts that kept the plant online while isolating the faulty link.</p>

        <p>Grid operators confirmed that national supply was unaffected and that full diagnostics are underway.</p>

        <p>Security teams will audit remote-access logs and recent configuration changes as part of the follow-up.</p>
      `
    },

    // --- China: Longhua Nova ---
    "china-longhua": {
      title: "Massive {plantName} reduces output after telemetry anomalies in {country}",
      lead:  "Operators at {plantName} scale back production while control-room alarms are investigated.",
      byline: "Xinhua • {country}",
      image: "media/news/china.webp",
      html: `
        <p><strong>{country} —</strong> Longhua Nova temporarily reduced generation after operators detected
        telemetry anomalies in the plant’s central monitoring system.</p>

        <p>The 5.0 GW facility, one of the region’s largest, entered a precautionary mode while engineers
        validate sensor streams and communication paths to the dispatch centre.</p>

        <p>Authorities say safety systems and reactor protections (where applicable) remained fully functional
        and that there is no immediate danger to the public.</p>
      `
    },

    // --- Japan: Fujinari Works ---
    "japan-fujinari": {
      title: "{plantName} placed into protective state after control-system alarms in {country}",
      lead:  "Operators at {plantName} triggered automated protections following anomalous command sequences.",
      byline: "NHK • {country}",
      image: "media/news/japan.webp",
      html: `
        <p><strong>{country} —</strong> The Fujinari Works entered a protective state after its control system
        detected a sequence of unexpected commands that did not match normal operating procedures.</p>

        <p>Plant engineers switched several units to manual control and are coordinating with regulators
        to perform a full forensic review of recent operational logs.</p>

        <p>Officials emphasised that earthquake- and tsunami-resilient designs were not implicated and that
        safety margins remain intact.</p>
      `
    },

    // --- South Korea: Hanryth Power ---
    "korea-hanryth": {
      title: "Dispatchers curb output from {plantName} as control links are tested in {country}",
      lead:  "Hanryth Power temporarily reduces automated set-point changes while engineers validate remote links.",
      byline: "Yonhap • {country}",
      image: "media/news/south_korea.webp",
      html: `
        <p><strong>{country} —</strong> The hybrid units at {plantName} had automated set-point changes
        temporarily suspended amid ongoing tests of remote control links to ensure integrity.</p>

        <p>Grid operators said the move was precautionary and that backup resources were called upon
        to maintain supply balance across affected regions.</p>

        <p>Cybersecurity teams will review recent access sessions and update protections on external gateways.</p>
      `
    },

    // --- India: Gangetra Shakti Plant ---
    "india-gangetra": {
      title: "{plantName} scales back output after control-room irregularities in {country}",
      lead:  "A mix of coal, solar and hydro units at {plantName} are operating at reduced capacity while checks proceed.",
      byline: "The Hindu • {country}",
      image: "media/news/Indie.webp",
      html: `
        <p><strong>{country} —</strong> Gangetra Shakti Plant reduced output across several units following
        irregularities detected in the central control room’s command logs.</p>

        <p>Dispatchers rerouted supply and activated reserve units to avoid disruptions to industrial consumers.</p>

        <p>Investigations are ongoing to determine whether the anomalies were due to a software fault or
        malicious interference.</p>
      `
    },

    // --- Pakistan: Indaryon Energia ---
    "pakistan-indaryon": {
      title: "{plantName} enters safe mode after supervisory alarms in {country}",
      lead:  "Indaryon Energia curtailed generation after multiple supervisory alarms triggered automated protection.",
      byline: "Dawn • {country}",
      image: "media/news/pakistan.webp",
      html: `
        <p><strong>{country} —</strong> Indaryon Energia’s control systems triggered automated protections
        after several supervisory alarms were reported, leading to a temporary curtailment of generation.</p>

        <p>Plant staff moved critical systems to manual oversight while technicians validate sensor and gateway health.</p>

        <p>Officials assured that essential services remain powered via contingency arrangements.</p>
      `
    },
    // --- Thailand: Siamora Solar ---
    "thailand-siamora": {
      title: "Solar park {plantName} throttles output after communication fault in {country}",
      lead:  "Engineers at {plantName} reduce production following a data-sync error between inverters and control hub.",
      byline: "Bangkok Post • {country}",
      image: "media/news/thailand.webp",
      html: `
        <p><strong>{country} —</strong> Operators at {plantName} reported a data-sync fault that caused
        temporary throttling of solar array output across multiple fields.</p>

        <p>Technicians say the communication issue between local inverters and the central control hub
        lasted only minutes, but triggered automatic safety routines.</p>

        <p>Grid authorities confirmed there was no impact on consumer supply and that diagnostics are underway.</p>
      `
    },

    // --- Vietnam: Mekoryn Plant ---
    "vietnam-mekoryn": {
      title: "Coal-to-gas station {plantName} reports brief outage in {country}",
      lead:  "{plantName} automatically halted turbines for inspection following inconsistent sensor data.",
      byline: "VNExpress • {country}",
      image: "media/news/Vietnam.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} hybrid station halted turbine operations
        for a short period after inconsistent pressure readings were detected on monitoring consoles.</p>

        <p>Plant engineers initiated inspection procedures to rule out hardware faults and possible
        manipulation of control signals.</p>

        <p>Operations have since resumed at partial capacity while the analysis continues.</p>
      `
    },

    // --- Indonesia: Nusaryon Station ---
    "indonesia-nusaryon": {
      title: "Geothermal site {plantName} triggers safety interlocks in {country}",
      lead:  "Protective systems at {plantName} activated after anomalous temperature spikes in control readings.",
      byline: "Jakarta Post • {country}",
      image: "media/news/idonezja.webp",
      html: `
        <p><strong>{country} —</strong> The geothermal complex {plantName} automatically triggered
        safety interlocks when control systems detected inconsistent temperature readings across several wells.</p>

        <p>Field crews confirmed that physical measurements did not match the reported spikes, suggesting
        a sensor or telemetry malfunction.</p>

        <p>The facility remains stable, and generation continues at reduced output while systems are recalibrated.</p>
      `
    },

    // --- Australia: Australis Nova ---
    "australia-australisnova": {
      title: "Hybrid renewables site {plantName} temporarily curtailed after grid signal event in {country}",
      lead:  "{plantName} cuts production briefly following unexpected frequency variations on export lines.",
      byline: "ABC News • {country}",
      image: "media/news/australia.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} hybrid solar–wind facility curtailed output
        for several minutes after grid frequency variations triggered automatic stabilisation controls.</p>

        <p>Engineers later identified a surge of irregular control packets as the cause of false readings
        on several monitoring systems.</p>

        <p>The Australian Energy Market Operator confirmed that full capacity was restored within the hour.</p>
      `
    },

    // --- South Africa: Ubunara Station ---
    "southafrica-ubunara": {
      title: "Coal–solar plant {plantName} limits generation after control warning in {country}",
      lead:  "A brief control-system warning at {plantName} led to precautionary output limitation.",
      byline: "News24 • {country}",
      image: "media/news/RPA.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} hybrid station, combining coal and solar units,
        limited generation for one hour after operators received a control-system warning related
        to turbine governor responses.</p>

        <p>Officials said the measure was precautionary and that power exports have since normalised.</p>

        <p>The energy ministry requested a technical review of incident logs to confirm the origin
        of the transient signal anomaly.</p>
      `
    },
    // --- Egypt: Nilyth Complex ---
    "egypt-nilyth": {
      title: "Hydro facility {plantName} reports flow-control issue in {country}",
      lead:  "Engineers at {plantName} temporarily adjust sluice operations after control irregularities.",
      byline: "Al Ahram • {country}",
      image: "media/news/Egipt.webp",
      html: `
        <p><strong>{country} —</strong> The hydroelectric {plantName} complex on the Nile River reported
        a temporary flow-control issue that prompted adjustments to sluice operations.</p>

        <p>Operators detected inconsistent readings in gate-position sensors and initiated
        manual overrides to maintain balanced water discharge.</p>

        <p>Officials emphasised that generation resumed normally within the hour and that
        dam safety was never compromised.</p>
      `
    },

    // --- Nigeria: Lagoryn Energia ---
    "nigeria-lagoryn": {
      title: "Gas-fired {plantName} plant throttles turbines after control fault in {country}",
      lead:  "Short-lived control-system glitch at {plantName} prompts brief reduction in generation.",
      byline: "The Guardian Nigeria • {country}",
      image: "media/news/nigeria.webp",
      html: `
        <p><strong>{country} —</strong> Operators at {plantName} briefly throttled back gas turbines
        after a control-system fault caused misalignment between demand signals and actual output.</p>

        <p>Technicians performed a controlled restart sequence, restoring full power within thirty minutes.</p>

        <p>The national grid company confirmed the issue was isolated and is investigating potential
        causes, including cyber interference.</p>
      `
    },

    // --- Morocco: Atlorya Solar ---
    "morocco-atlorya": {
      title: "Desert solar array {plantName} undergoes partial shutdown in {country}",
      lead:  "Portions of {plantName} automatically disconnected following irregular temperature data from sensors.",
      byline: "Le Matin • {country}",
      image: "media/news/marocco.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} solar complex temporarily disconnected several
        collector fields after temperature sensors began reporting erratic data inconsistent with
        actual operating conditions.</p>

        <p>Plant engineers isolated affected sections to prevent cascading shutdowns and are reviewing
        firmware on sensor clusters deployed across the site.</p>

        <p>Authorities reported that national supply remained stable and that no damage to infrastructure occurred.</p>
      `
    },
    // --- Iran: Persenyx Plant ---
    "iran-persenyx": {
      title: "Nuclear facility {plantName} switches to heightened monitoring in {country}",
      lead:  "Transient alarms at {plantName} trigger stricter supervision of reactor control systems.",
      byline: "IRNA • {country}",
      image: "media/news/iran.webp",
      html: `
        <p><strong>{country} —</strong> The {plantName} nuclear power station reported a series of transient
        alarms in its control rooms, prompting operators to switch several subsystems to heightened monitoring mode.</p>

        <p>According to officials, all key safety parameters remained within normal limits, but engineers
        temporarily restricted remote access to certain control functions as a precaution.</p>

        <p>Specialised cyber teams have been tasked with reviewing recent connections to the plant’s
        supervisory networks and verifying the integrity of configuration files.</p>
      `
    },

    // --- Philippines: Baynara Station ---
    "philippines-baynara": {
      title: "Geothermal plant {plantName} reports control disturbance in {country}",
      lead:  "Steam-field management at {plantName} briefly adjusted after conflicting control inputs.",
      byline: "Philippine Daily Inquirer • {country}",
      image: "media/news/filipiny.webp",
      html: `
        <p><strong>{country} —</strong> Operators at the {plantName} geothermal station briefly adjusted
        steam-field management after detecting conflicting control inputs on wellhead valves.</p>

        <p>The facility shifted to more conservative settings while engineers verified that reservoir
        pressures and temperatures remained within safe operating bands.</p>

        <p>The incident caused no interruption to consumer supply, but the operator has launched
        an internal review focusing on remote access policies and automation scripts.</p>
      `
    },

  };
})();
