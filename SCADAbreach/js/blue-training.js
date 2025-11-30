// js/blue-training.js
(function () {
  const box = document.querySelector('.bt-training');
  if (!box) return;

  box.innerHTML = `
    <h2>Blue Team Learning Hub</h2>

    <details class="bt-training-section" open>
      <summary>🔹 What is the Blue Team?</summary>
      <div>
        <p>The Blue Team defends the organisation. Your job is to:</p>
        <ul>
          <li><strong>Detect</strong> malicious or abnormal activity in logs and telemetry.</li>
          <li><strong>Contain</strong> incidents quickly (isolate hosts, block IPs, disable accounts).</li>
          <li><strong>Eradicate &amp; Recover</strong> – remove malware, restore systems, harden configs.</li>
          <li><strong>Improve</strong> – feed lessons learned back into detections, playbooks and policies.</li>
        </ul>
        <p>In this game you are acting as a lightweight SOC / incident responder for the power grid.</p>
      </div>
    </details>

    <details class="bt-training-section">
      <summary>🧠 Cyber Kill Chain (Lockheed Martin)</summary>
      <div>
        <p>The Kill Chain is a simple way to think about how attacks unfold and where to stop them:</p>
        <ol>
          <li><strong>Reconnaissance</strong> – attacker profiles targets, OSINT, scanning.</li>
          <li><strong>Weaponization</strong> – build payload (malware, exploit, phish doc).</li>
          <li><strong>Delivery</strong> – send it: email, web, USB, VPN, supply chain…</li>
          <li><strong>Exploitation</strong> – vulnerability or user action is exploited.</li>
          <li><strong>Installation</strong> – malware gets persistence on a host.</li>
          <li><strong>Command &amp; Control (C2)</strong> – beaconing out to attacker infra.</li>
          <li><strong>Actions on Objectives</strong> – data theft, encryption, sabotage, etc.</li>
        </ol>
        <p>As Blue Team you want to detect &amp; break the chain as early as possible – ideally at Delivery / Exploitation, long before the attacker reaches their objectives.</p>
      </div>
    </details>

    <details class="bt-training-section">
      <summary>📎 MITRE ATT&amp;CK Framework</summary>
      <div>
        <p>MITRE ATT&amp;CK is a knowledge base of real attacker behaviours.</p>
        <ul>
          <li>Organised by <strong>Tactics</strong> (attacker goals, e.g. Initial Access, Lateral Movement, Impact).</li>
          <li>Each tactic contains <strong>Techniques</strong> (how they do it, e.g. phishing, valid accounts, remote services).</li>
          <li>There are separate matrices for <strong>Enterprise</strong> and <strong>ICS/OT</strong> environments.</li>
        </ul>
        <p>Examples that matter for a power grid scenario:</p>
        <ul>
          <li><strong>T1566 – Phishing</strong>: malicious emails to operators / engineers.</li>
          <li><strong>T1078 – Valid Accounts</strong>: using stolen VPN / domain creds.</li>
          <li><strong>T1021 – Remote Services</strong>: RDP/SSH into servers and HMIs.</li>
          <li><strong>T1486 – Data Encrypted for Impact</strong>: ransomware on critical systems.</li>
        </ul>
        <p>In a real SOC you map alerts and incidents to ATT&amp;CK techniques to understand coverage and gaps.</p>
      </div>
    </details>
    <details class="bt-training-section">
      <summary>🛠 OWASP Top 10 (Web & API Security)</summary>
      <div>
        <p>OWASP Top 10 is a list of the most critical web application security risks.</p>
        <ul>
          <li><strong>A01 — Broken Access Control</strong><br>
              Users can act as admins, view others' data, or change roles.</li>

          <li><strong>A02 — Cryptographic Failures</strong><br>
              Weak or missing encryption, sensitive data exposure.</li>

          <li><strong>A03 — Injection</strong><br>
              SQL injection, NoSQL injection, OS command injection, etc.</li>

          <li><strong>A04 — Insecure Design</strong><br>
              System is insecure by architecture — not just bugs.</li>

          <li><strong>A05 — Security Misconfiguration</strong><br>
              Default creds, open S3 buckets, verbose errors, debug on.</li>

          <li><strong>A06 — Vulnerable and Outdated Components</strong><br>
              Old libraries, unpatched servers, EoL software.</li>

          <li><strong>A07 — Identification & Authentication Failures</strong><br>
              Broken logins, weak MFA, session hijacking.</li>

          <li><strong>A08 — Software & Data Integrity Failures</strong><br>
              CICD pipeline tampering, insecure deserialization.</li>

          <li><strong>A09 — Security Logging & Monitoring Failures</strong><br>
              No logs → No detection → No response.</li>

          <li><strong>A10 — Server-Side Request Forgery (SSRF)</strong><br>
              Attacker tricks a server into making internal requests.</li>
        </ul>

        <p>Why does this matter for Blue Teams?</p>
        <ul>
          <li>You often detect incidents caused by these weaknesses.</li>
          <li>They show up in SIEM logs, WAF alerts and vulnerability scans.</li>
          <li>Many attacks on critical infrastructure start with a web foothold.</li>
        </ul>
      </div>
    </details>

    <details class="bt-training-section">
      <summary>📚 Key Tools for Blue Teams</summary>
      <div>
        <ul>
          <li><strong>Logging &amp; SIEM</strong>
            <ul>
              <li>Collect events from endpoints, servers, firewalls, AD, cloud.</li>
              <li>Use correlation rules, dashboards and detection content.</li>
            </ul>
          </li>
          <li><strong>Endpoint &amp; EDR</strong>
            <ul>
              <li>Detect suspicious processes, persistence, lateral movement.</li>
              <li>Isolate hosts and pull forensic data when needed.</li>
            </ul>
          </li>
          <li><strong>Network Monitoring</strong>
            <ul>
              <li>IDS/IPS, NetFlow, PCAP, TLS inspection where allowed.</li>
              <li>Look for C2 traffic, lateral movement, data exfiltration.</li>
            </ul>
          </li>
          <li><strong>Threat Intelligence</strong>
            <ul>
              <li>Feeds with indicators (IPs/domains/hashes) and TTP reports.</li>
              <li>Helps prioritise alerts and understand which groups might be involved.</li>
            </ul>
          </li>
          <li><strong>DFIR Tooling</strong>
            <ul>
              <li>Forensic triage, memory analysis, timeline analysis, disk images.</li>
              <li>Used for deeper incident investigations and post-incident review.</li>
            </ul>
          </li>
        </ul>
      </div>
    </details>

    <details class="bt-training-section">
      <summary>🧭 Where to Learn Blue Team Skills?</summary>
      <div>
        <p>Good starting points if you want to become a SOC / Blue Team analyst in real life:</p>
        <ul>
          <li><strong>Hands-on labs &amp; ranges</strong>
            <ul>
              <li>Look for SOC / Blue Team paths on training platforms (log analysis, SIEM, DFIR).</li>
              <li>Hunt in real logs, replay incidents, build detections.</li>
            </ul>
          </li>
          <li><strong>MITRE ATT&amp;CK resources</strong>
            <ul>
              <li>Read technique pages and detection / mitigation sections.</li>
              <li>Study a real APT group and map its techniques.</li>
            </ul>
          </li>
          <li><strong>Public reports &amp; blogs</strong>
            <ul>
              <li>Incident write-ups from security vendors, CERTs, govt agencies.</li>
              <li>Focus on: initial access, detection opportunities, and response actions.</li>
            </ul>
          </li>
          <li><strong>Home lab</strong>
            <ul>
              <li>Small lab with a SIEM, a couple of VMs and some attack simulations.</li>
              <li>Generate your own logs and practise hunting – similar idea to this game.</li>
            </ul>
          </li>
        </ul>
        <p>This panel is meant as general guidance – not a cheat sheet for the scenario. Use it as a mental model while you work through the incident.</p>
      </div>
    </details>
  `;
})();
