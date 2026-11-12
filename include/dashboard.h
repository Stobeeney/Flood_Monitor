#pragma once
#include <Arduino.h>

const char DASHBOARD_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flood Monitor</title><style>
:root{font-family:system-ui,sans-serif;color:#e5efff;background:#0c1524;color-scheme:dark}body{margin:0;padding:32px 20px}main{max-width:820px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:20px}h1{font-size:28px}p{color:#a9bad1;line-height:1.6}.badge{padding:8px 12px;border:1px solid #405776;border-radius:20px;font-size:14px}.card{background:#142238;border:1px solid #293e5c;border-radius:18px;padding:24px;margin:24px 0}.value{font-size:clamp(48px,12vw,88px);font-weight:650;letter-spacing:-3px}.unit{font-size:24px;letter-spacing:0;color:#a9bad1}svg{width:100%;height:150px;display:block;margin-top:24px}footer{color:#a9bad1;font-size:14px}#status{min-height:24px}@media(max-width:460px){header{align-items:flex-start;flex-direction:column;gap:0}}
</style></head><body><main>
<header><h1>Flood Monitor</h1><span class="badge" id="connection" role="status">Connecting…</span></header>
<p>Live ultrasonic readings · ESP32</p>
<section class="card" aria-label="Distance reading"><p>Distance to water surface</p>
<div class="value"><span id="distance">—</span> <span class="unit">cm</span></div>
<p id="status" role="status">Waiting for the sensor…</p>
<svg viewBox="0 0 720 150" preserveAspectRatio="none" role="img" aria-label="Recent distance readings; gaps indicate missing echoes"><path d="M0 149H720" stroke="#405776"/><path id="trend" fill="none" stroke="#55d9ce" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>
<p>Recent readings · last 60 samples · automatic scale</p></section>
<footer><p id="network"></p><p>Updates every second. A smaller distance means the water is closer to the sensor. Water depth and flood alert thresholds require site calibration.</p></footer>
</main><script>
const samples=[];const el=id=>document.getElementById(id);
function chart(){const values=samples.filter(v=>v!==null);if(!values.length){el('trend').setAttribute('d','');return;}const min=Math.min(...values)-1,max=Math.max(...values)+1;let pen=false;const path=samples.map((v,i)=>{if(v===null){pen=false;return '';}const point=`${i*720/59},${140-(v-min)/(max-min)*130}`;const segment=(pen?'L':'M')+point;pen=true;return segment;}).join(' ');el('trend').setAttribute('d',path);}
async function refresh(){try{const response=await fetch('/api/status',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Request failed');const data=await response.json();el('connection').textContent='Device online';el('distance').textContent=data.distance_cm===null?'—':data.distance_cm.toFixed(1);el('status').textContent=data.distance_cm===null?'No echo received. Check sensor wiring and range.':'Reading received just now';el('network').textContent='Connected directly to ESP32 · '+data.ap_ip;samples.push(data.distance_cm);}catch(error){el('connection').textContent='Device offline';el('distance').textContent='—';el('status').textContent='Cannot reach the ESP32. Check your Wi-Fi connection.';samples.push(null);}if(samples.length>60)samples.shift();chart();setTimeout(refresh,1000);}refresh();
</script></body></html>)HTML";
