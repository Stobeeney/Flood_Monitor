#pragma once
#include <Arduino.h>

const char DASHBOARD_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LRT2 Flood Monitor · ESP32 Setup</title><style>
:root{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;background:#f4f6f8}
*{box-sizing:border-box}body{margin:0;padding:20px 16px}main{max-width:760px;margin:auto}
header{background:#6b21a8;color:#fff;padding:18px 20px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 12px;color:#0f172a}
.badge{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.18);color:#fff}
.badge.ok{background:#16a34a}.badge.warn{background:#ea580c}.badge.err{background:#dc2626}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-top:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}
.kv{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
.kv span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600}
.kv strong{display:block;font-size:15px;margin-top:3px;color:#0f172a;word-break:break-all}
.big{font-size:40px;font-weight:700;letter-spacing:-1px;margin:6px 0}
label{display:block;font-size:12px;font-weight:600;color:#334155;margin:10px 0 4px}
input,select{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;background:#fff;color:#0f172a}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
button{padding:9px 14px;border:0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#6b21a8;color:#fff}
button.sec{background:#e2e8f0;color:#0f172a}button:disabled{opacity:.6;cursor:wait}
.msg{font-size:12px;margin-top:8px;color:#475569;min-height:18px}
.nets{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px}
.net{padding:5px 9px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;font-size:12px;cursor:pointer;color:#0f172a}
</style></head><body><main>
<header>
  <div><h1>LRT2 Flood Monitor · ESP32</h1><div style="font-size:12px;opacity:.9;margin-top:2px" id="rtc">RTC: —</div></div>
  <span class="badge" id="alertBadge">Connecting…</span>
</header>

<section class="card">
  <h2>Live Telemetry</h2>
  <div class="big"><span id="dist">—</span> <span style="font-size:18px;color:#64748b">cm</span> <span id="rawDist" style="font-size:13px;color:#64748b;font-weight:500"></span></div>
  <div class="row" style="margin-top:8px">
    <button type="button" class="sec" onclick="calibrateBase()">Set Current Distance as 0 cm Baseline</button>
    <span class="msg" id="baseMsg" style="margin:0"></span>
  </div>
  <div class="grid">
    <div class="kv"><span>Wi-Fi STA</span><strong id="wifiSta">Disconnected</strong></div>
    <div class="kv"><span>NTP Time Sync</span><strong id="ntpState">Waiting</strong></div>
    <div class="kv"><span>Supabase / Vercel</span><strong id="cloudState">Not configured</strong></div>
    <div class="kv"><span>Air780E GSM</span><strong id="gsmState">—</strong></div>
  </div>
</section>

<section class="card">
  <h2>1. Connect ESP32 to Wi-Fi (Auto-syncs PH Date &amp; Time)</h2>
  <div class="row" style="margin-top:0">
    <button type="button" class="sec" id="scanBtn" onclick="scanWifi()">Scan Wi-Fi Networks</button>
    <span class="msg" id="scanMsg" style="margin:0"></span>
  </div>
  <div class="nets" id="netList"></div>
  <form onsubmit="saveWifi(event)">
    <label for="ssid">Wi-Fi Network Name (2.4 GHz SSID)</label>
    <input id="ssid" required placeholder="Enter Wi-Fi SSID">
    <label for="pass">Wi-Fi Password</label>
    <input id="pass" type="password" placeholder="Enter Wi-Fi password">
    <div class="row">
      <button type="submit" id="wifiBtn">Save &amp; Connect Wi-Fi</button>
      <button type="button" class="sec" onclick="syncNtp()">Sync Time Now</button>
    </div>
    <div class="msg" id="wifiMsg"></div>
  </form>
</section>

<section class="card">
  <h2>2. Cloud Sync to Supabase (for Vercel Live Dashboard)</h2>
  <form onsubmit="saveCloud(event)">
    <label for="sbUrl">Supabase Project URL</label>
    <input id="sbUrl" placeholder="https://your-project.supabase.co">
    <label for="sbKey">Supabase Anon Key</label>
    <input id="sbKey" type="password" placeholder="eyJhbGciOi...">
    <label for="stationId">LRT-2 Station ID</label>
    <select id="stationId">
      <option value="santolan">santolan (Marikina River)</option>
      <option value="recto">recto (Manila)</option>
      <option value="legarda">legarda (Sampaloc)</option>
      <option value="pureza">pureza (Sta. Mesa)</option>
      <option value="v-mapa">v-mapa (San Juan River)</option>
      <option value="j-ruiz">j-ruiz (San Juan)</option>
      <option value="gilmore">gilmore (New Manila)</option>
      <option value="betty-go">betty-go (Cubao)</option>
      <option value="cubao">cubao (Araneta Center)</option>
      <option value="anonas">anonas (QC)</option>
      <option value="katipunan">katipunan (QC)</option>
      <option value="marikina-pasig">marikina-pasig</option>
      <option value="antipolo">antipolo (Masinag)</option>
    </select>
    <label for="mountCm">Sensor Mount Height from Floor (cm)</label>
    <input id="mountCm" type="number" step="1" min="50" max="450" value="180">
    <div class="row"><button type="submit">Save Cloud Settings</button></div>
    <div class="msg" id="cloudMsg"></div>
  </form>
</section>

<section class="card">
  <h2>3. SMS Alert Recipient (Air780E · Smart SIM)</h2>
  <form onsubmit="saveSms(event)">
    <label for="smsPhone">Recipient Mobile Number (09XXXXXXXXX or +639XXXXXXXXX)</label>
    <input id="smsPhone" required placeholder="09171234567">
    <div class="row">
      <button type="submit">Save SMS Number</button>
      <button type="button" class="sec" id="smsTestBtn" onclick="testSms()">Send Test SMS</button>
    </div>
    <div class="msg" id="smsMsg"></div>
  </form>
</section>

<section class="card">
  <h2>4. Manual Date &amp; Time (DS1302 RTC &amp; LCD)</h2>
  <form onsubmit="setManualTime(event)">
    <label for="manualTime">Set Date &amp; Time (updates DS1302 RTC &amp; 16x2 LCD immediately)</label>
    <input id="manualTime" type="datetime-local" step="1" required>
    <div class="row">
      <button type="submit">Set Manual Time</button>
      <button type="button" class="sec" onclick="useDeviceTime()">Use Phone/PC Time</button>
    </div>
    <div class="msg" id="timeMsg"></div>
  </form>
</section>

<section class="card">
  <h2>5. ESP32 Local Flash Logs (LittleFS Backup)</h2>
  <div style="font-size:13px;color:#475569">Stored size: <strong id="logSize">0.0 KB</strong> (auto-logs every 10s + on alerts)</div>
  <div class="row">
    <a href="/logs.csv" download="esp32_flood_logs.csv"><button type="button">Download logs.csv</button></a>
    <button type="button" class="sec" onclick="clearLogs()">Clear Flash Logs</button>
  </div>
  <div class="msg" id="logMsg"></div>
</section>
</main><script>
const $=id=>document.getElementById(id);let loadedCfg=false;
async function poll(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'});const d=await r.json();
    $('dist').textContent=d.water_depth_cm===null||d.water_depth_cm===undefined?'—':d.water_depth_cm.toFixed(1);
    $('rawDist').textContent=d.distance_cm===null?'':('(Sensor dist: '+d.distance_cm.toFixed(1)+' cm)');
    $('rtc').textContent='RTC: '+(d.rtc_time||'—')+' (Asia/Manila)';
    const b=$('alertBadge');b.textContent=d.status||'ONLINE';
    b.className='badge '+(d.status==='FLOOD_ALERT'?'err':d.status==='WARNING'?'warn':'ok');
    $('wifiSta').textContent=d.wifi_connected?('Connected WiFi ('+d.wifi_ssid+' · '+d.sta_ip+')'):(d.wifi_failed?('Could not connect WiFi ('+d.wifi_ssid+')'):(d.wifi_ssid?('Connecting WiFi '+d.wifi_ssid+'…'):'Not configured'));
    $('ntpState').textContent=d.ntp_synced?'Synced (UTC+8)':'Waiting Wi-Fi';
    $('cloudState').textContent=d.cloud_connected?('Connected to the cloud ('+d.station_id+')'):(d.cloud_configured?(d.cloud_last_code!==0?('Could not connect cloud (HTTP '+d.cloud_last_code+')'):'Connecting to cloud…'):'Not configured');
    $('gsmState').textContent=d.gsm_ready?'Ready':'Standby';
    if(typeof d.log_bytes==='number')$('logSize').textContent=(d.log_bytes/1024).toFixed(1)+' KB';
    if(!loadedCfg){
      loadedCfg=true;
      if(d.wifi_ssid)$('ssid').value=d.wifi_ssid;
      if(d.sb_url)$('sbUrl').value=d.sb_url;
      if(d.station_id)$('stationId').value=d.station_id;
      if(d.sms_phone && !d.sms_phone.includes('X'))$('smsPhone').value=d.sms_phone;
      if(d.mount_cm)$('mountCm').value=d.mount_cm;
    }
  }catch(e){$('alertBadge').textContent='Offline';$('alertBadge').className='badge err';}
  setTimeout(poll,1500);
}
async function scanWifi(){
  $('scanBtn').disabled=true;$('scanMsg').textContent='Scanning 2.4 GHz networks…';$('netList').innerHTML='';
  try{
    const r=await fetch('/api/wifi/scan');const list=await r.json();
    $('scanMsg').textContent=list.length?(list.length+' networks found'):'No networks found';
    list.forEach(n=>{
      const btn=document.createElement('button');btn.type='button';btn.className='net';
      btn.textContent=n.ssid+' ('+n.rssi+' dBm)';
      btn.onclick=()=>{$('ssid').value=n.ssid;$('pass').focus();};
      $('netList').appendChild(btn);
    });
  }catch(e){$('scanMsg').textContent='Scan failed';}
  $('scanBtn').disabled=false;
}
async function saveWifi(e){
  e.preventDefault();$('wifiBtn').disabled=true;$('wifiMsg').textContent='Saving & connecting…';
  try{
    const body=new URLSearchParams({ssid:$('ssid').value,pass:$('pass').value});
    const r=await fetch('/api/wifi/save',{method:'POST',body});const t=await r.text();
    $('wifiMsg').textContent=t;
  }catch(err){$('wifiMsg').textContent='Save failed';}
  $('wifiBtn').disabled=false;
}
async function syncNtp(){
  $('wifiMsg').textContent='Requesting NTP time sync…';
  try{const r=await fetch('/api/ntp/sync',{method:'POST'});$('wifiMsg').textContent=await r.text();}
  catch(e){$('wifiMsg').textContent='Sync request failed';}
}
async function saveCloud(e){
  e.preventDefault();$('cloudMsg').textContent='Saving cloud settings…';
  try{
    const body=new URLSearchParams({url:$('sbUrl').value.trim(),key:$('sbKey').value.trim(),station_id:$('stationId').value,mount_cm:$('mountCm').value});
    const r=await fetch('/api/cloud/save',{method:'POST',body});$('cloudMsg').textContent=await r.text();
  }catch(err){$('cloudMsg').textContent='Save failed';}
}
async function clearLogs(){
  $('logMsg').textContent='Clearing logs…';
  const body=new URLSearchParams({confirm:'1'});
  for(let i=0;i<2;i++){
    try{
      const r=await fetch('/api/logs/clear',{method:'POST',body});
      $('logMsg').textContent=await r.text();
      if(r.ok)$('logSize').textContent='0.1 KB';
      return;
    }catch(e){if(i===1)$('logMsg').textContent='Clear failed (check ESP32 Wi-Fi connection)';}
  }
}
async function saveSms(e){
  e.preventDefault();$('smsMsg').textContent='Saving number…';
  try{
    const body=new URLSearchParams({phone:$('smsPhone').value.trim()});
    const r=await fetch('/api/sms/save',{method:'POST',body});$('smsMsg').textContent=await r.text();
  }catch(err){$('smsMsg').textContent='Save failed';}
}
async function testSms(){
  $('smsTestBtn').disabled=true;$('smsMsg').textContent='Sending test SMS via Smart SIM…';
  try{const r=await fetch('/api/sms/test',{method:'POST'});$('smsMsg').textContent=await r.text();}
  catch(e){$('smsMsg').textContent='Test SMS request failed';}
  $('smsTestBtn').disabled=false;
}
function fmtLocalDt(dt){
  const p=n=>String(n).padStart(2,'0');
  return dt.getFullYear()+'-'+p(dt.getMonth()+1)+'-'+p(dt.getDate())+'T'+p(dt.getHours())+':'+p(dt.getMinutes())+':'+p(dt.getSeconds());
}
async function setManualTime(e){
  e.preventDefault();$('timeMsg').textContent='Updating RTC & LCD…';
  try{
    const body=new URLSearchParams({datetime:$('manualTime').value});
    const r=await fetch('/api/time/set',{method:'POST',body});$('timeMsg').textContent=await r.text();
  }catch(err){$('timeMsg').textContent='Update failed';}
}
async function useDeviceTime(){
  const val=fmtLocalDt(new Date());
  $('manualTime').value=val;
  $('timeMsg').textContent='Syncing phone/PC time to RTC & LCD…';
  try{
    const body=new URLSearchParams({datetime:val});
    const r=await fetch('/api/time/set',{method:'POST',body});$('timeMsg').textContent=await r.text();
  }catch(err){$('timeMsg').textContent='Sync failed';}
}
async function calibrateBase(){
  $('baseMsg').textContent='Calibrating…';
  try{
    const body=new URLSearchParams({confirm:'1'});
    const r=await fetch('/api/baseline/calibrate',{method:'POST',body});
    $('baseMsg').textContent=await r.text();
  }catch(e){$('baseMsg').textContent='Calibrate failed';}
}
$('manualTime').value=fmtLocalDt(new Date());
poll();
</script></body></html>)HTML";
