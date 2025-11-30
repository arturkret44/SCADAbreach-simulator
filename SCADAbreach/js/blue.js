// js/blue.js — mock Blue Team data
(function(){
  const logTable = document.querySelector('#bt-log-table tbody');
  const alertsEl = document.getElementById('bt-alert-cards');

const logs = [
  { time:'09:15:12', src:'192.168.1.14', event:'User login', sev:'info' },
  { time:'09:14:55', src:'10.0.2.8', event:'Port scan detected (low volume)', sev:'low' },
  { time:'09:13:30', src:'203.0.113.50', event:'IDS: suspicious payload (investigate)', sev:'medium' },
];

const alerts = [
  { id:1, title:'Phishing attempt reported', sev:'med', status:'Investigating' },
  { id:2, title:'Unusual outbound connection (review)', sev:'low', status:'Open' },
  // mniej krzykliwych "high" na start
];

  function renderLogs(){
    logTable.innerHTML = logs.map(l=>`
      <tr>
        <td>${l.time}</td>
        <td>${l.src}</td>
        <td>${l.event}</td>
        <td><span class="sev sev-${l.sev}">${l.sev.toUpperCase()}</span></td>
      </tr>`).join('');
  }

  function renderAlerts(){
    alertsEl.innerHTML = alerts.map(a=>`
      <div class="alert-card">
        <div class="sev sev-${a.sev}">${a.sev.toUpperCase()}</div>
        <h3>${a.title}</h3>
        <p>Status: ${a.status}</p>
      </div>
    `).join('');
  }

  renderLogs();
  renderAlerts();
})();
