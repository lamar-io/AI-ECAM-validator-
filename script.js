// ── NAVIGATION ──
function showSection(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('section-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='simulation') initCharts();
}

// ── PIPELINE NODE DATA ──
const nodeData={
  sensor:{col1:{h:'What It Is',body:'The physical sensors distributed throughout the aircraft. These include EGT (exhaust gas temperature) probes, hydraulic pressure transducers, fuel flow meters, N1/N2 engine speed sensors, and more. They continuously output readings that feed into the ECAM processing chain.'},col2:{h:'The Problem',list:['Sensors can produce inaccurate readings due to physical wear, EMI interference, or calibration drift','Readings may be technically within hardware limits but inconsistent with current aircraft state','These erroneous values are indistinguishable from genuine faults at the raw data level','ECAM has no native layer to validate contextual plausibility of readings']},col3:{h:'Sensor Types Monitored',list:['EGT — Exhaust Gas Temperature (°C)','N1/N2 — Engine fan/core speed (%RPM)','FOHE — Fuel Oil Heat Exchanger pressure','Hydraulic pressure (Green/Blue/Yellow circuits)','Cabin differential pressure (PSI)','FADEC — Full Authority Digital Engine Control outputs']}},
  arinc:{col1:{h:'What ARINC 429 Is',body:'The standard avionics communication protocol used on Airbus A320, A330, and A340 aircraft. It is a unidirectional, point-to-point serial data bus where one transmitter communicates with up to 20 receivers via a twisted wire pair. Each data word is 32 bits, transmitted at 12.5 or 100 kbit/s.'},col2:{h:'How It Is Used Here',list:['The AI pipeline passively taps the ARINC 429 bus between sensors and the SDACs (System Data Acquisition Concentrators)','Intercepted data words are decoded and passed to the AI filtering stages','After processing, validated data is re-injected via a parallel ARINC 429 bus output','Rejected readings are logged to a maintenance data store for post-flight review','The SDAC and FWC receive only the filtered, validated stream']},col3:{h:'Technical Specs',list:['32-bit word format: Label (8b) + SDI (2b) + Data (19b) + SSM (2b) + Parity (1b)','Sign/Status Matrix field indicates data validity natively','Low speed (12.5 kbit/s) for most sensor data — low latency overhead','Unidirectional design makes passive tapping non-disruptive to original bus','Used on: A310, A320, A330, A340, B737, B747, B757, B767, MD-11']}},
  kalman:{col1:{h:'What It Does',body:'The Kalman filter is the first processing stage. It takes the raw, noisy sensor readings from the ARINC 429 tap and produces a smoothed, statistically optimal estimate of the true sensor value. It combines the current reading with predictions from a physical model of how the sensor should behave.'},col2:{h:'Why It Is Stage 1',list:['Noise must be removed before ML models can accurately assess anomalies','Kalman filtering is deterministic and extremely lightweight — no GPU needed','It operates in real time with no buffering, adding near-zero latency','Provides stable input that dramatically improves LSTM and Isolation Forest accuracy','If Kalman-smoothed value diverges sharply from raw, it is itself an anomaly signal']},col3:{h:'Technical Notes',list:['State vector includes sensor value + rate of change','Measurement noise covariance tuned per sensor type','Process noise model derived from known aircraft dynamics','Extended Kalman Filter (EKF) variant used for non-linear sensor models (e.g., EGT)','Runs independently per sensor channel — fully parallelizable on edge processor']}},
  lstm:{col1:{h:'What It Does',body:'The LSTM (Long Short-Term Memory) network analyzes sequences of sensor readings over time. It has been trained on historical normal flight data and learns the expected temporal patterns for each sensor in each flight phase. When a reading does not fit the expected pattern, it receives a high anomaly score.'},col2:{h:'Why LSTM Specifically',list:['Sensors follow time-dependent patterns — simple threshold checks miss gradual drift','LSTMs have memory cells that retain context across hundreds of time steps','Can detect anomalies that only become visible in temporal context (e.g., temperature rising too fast)','Trained per flight phase so thresholds adapt to operational context','Outputs a continuous anomaly probability, not a binary flag — allows tunable sensitivity']},col3:{h:'Training Details',list:['Input: sliding window of 50 timesteps per sensor channel','Output: anomaly probability score in [0, 1]','Architecture: 2 LSTM layers (64 units each) + dense output layer','Training data: simulated + historical normal flight sequences','Loss: Binary cross-entropy on labeled fault/no-fault windows']}},
  iso:{col1:{h:'What They Do',body:'Two complementary unsupervised anomaly detectors run in parallel. The Isolation Forest partitions the sensor feature space randomly — anomalous readings are isolated in fewer steps. The Autoencoder reconstructs normal readings and flags inputs with high reconstruction error as anomalies.'},col2:{h:'Why Both Together',list:['Isolation Forest excels at sudden spike outliers (fast but shallow)','Autoencoder excels at detecting slow sensor drift and gradual degradation','Ensemble of both scores reduces both false positives and false negatives','Neither requires labeled fault data — trained on normal data only','Complementary failure modes: one compensates for the other\'s blind spots']},col3:{h:'Technical Notes',list:['Isolation Forest: 200 trees, contamination parameter = 0.05','Autoencoder: encoder (32→16→8) + decoder (8→16→32), trained on MSE','Ensemble score: 0.4 × IsoForest + 0.6 × Autoencoder reconstruction error','Threshold for rejection tuned per flight phase via validation set','Scores logged alongside readings for explainability audit trail']}},
  rf:{col1:{h:'What It Does',body:'The final AI stage classifies the current flight phase from the combined multi-sensor state. This ensures each sensor reading is evaluated against the correct, context-appropriate thresholds rather than a single global limit.'},col2:{h:'Why Flight Phase Matters',list:['EGT limits differ significantly between ground idle and full takeoff thrust','Hydraulic pressure normal ranges depend on flight control surface loads','Cabin pressure differential only becomes relevant above ~8,000 ft','N1/N2 speed profiles are fundamentally different in each phase','Without phase context, a correctly functioning engine during takeoff would trigger false alerts']},col3:{h:'Classification Details',list:['Classes: Taxi / Takeoff / Climb / Cruise / Descent / Landing','Features: airspeed, altitude, N1, N2, thrust lever angle, gear status','100-tree ensemble, max depth 12, trained on full flight cycle data','Prediction confidence threshold: >0.85 required to apply phase thresholds','Outputs phase label + confidence to all upstream scoring stages']}},
  edge:{col1:{h:'What It Is',body:'All AI pipeline stages run on a dedicated onboard edge computing unit. This ensures the filtering happens in real time — before sensor data reaches the ECAM SDACs and FWCs. The processor handles data decoding, all four AI stages, and re-injection onto the validated ARINC 429 bus output.'},col2:{h:'Why Onboard Edge',list:['Cloud or ground-based processing would introduce unacceptable latency','End-to-end pipeline must complete within one ARINC 429 update cycle (~10ms)','Onboard processing eliminates connectivity dependency','Dedicated processor ensures ECAM pipeline is not affected by other avionics load','Prototype target: NVIDIA Jetson Nano or ARM Cortex-A72 (Raspberry Pi CM4)']},col3:{h:'Resource Estimates (Prototype)',list:['Kalman Filter: < 0.1ms CPU per channel','LSTM inference (TensorRT optimized): ~1.5ms','Isolation Forest + Autoencoder: ~1.2ms','Random Forest: ~0.3ms','Total estimated latency: 3–5ms per reading cycle','Target CPU utilization: < 40% on ARM Cortex-A72 @ 1.5GHz']}},
  ecam:{col1:{h:'What ECAM Receives',body:'After the full pipeline, only sensor readings that passed all four validation stages are re-injected onto the ARINC 429 bus and forwarded to the ECAM SDACs and FWCs. The ECAM operates exactly as it normally would — it is unaware of the filtering layer upstream.'},col2:{h:'Expected Outcomes',list:['Significant reduction in nuisance warnings reaching pilots','Pilot alarm fatigue reduced — real alerts receive full attention','Rejected readings stored in maintenance log for ground crew review','Possible faults revealed in rejection logs before they become actual failures','No modification to certified ECAM firmware or display logic required']},col3:{h:'ECAM System Context',list:['ECAM uses two SDACs (System Data Acquisition Concentrators)','Two FWCs (Flight Warning Computers) generate the alert logic','Three DMCs (Display Management Computers) drive the cockpit screens','E/WD (Engine Warning Display) and SD (System Display) are pilot-facing outputs','Alert levels: Red Warning (immediate action) / Amber Caution / Advisory']}}
};

function selectNode(id,el){
  document.querySelectorAll('.pnode').forEach(n=>n.classList.remove('selected'));
  el.classList.add('selected');
  const d=nodeData[id];
  const detail=document.getElementById('node-detail');
  const col=(c)=>`<div><div class="detail-heading">${c.h}</div>${c.body?`<div class="detail-body">${c.body}</div>`:''}${c.list?`<ul class="detail-list">${c.list.map(i=>`<li>${i}</li>`).join('')}</ul>`:''}</div>`;
  detail.innerHTML=col(d.col1)+col(d.col2)+col(d.col3);
  detail.classList.add('open');
  detail.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── SIMULATION ──
let simInterval=null,simRunning=false;
let data1={raw:[],kalman:[],ai:[]};
let data2={raw:[],kalman:[],ai:[]};
let params={noise:20,fault:10,sens:75};
let currentPhase='TAXI';
let suppressCount=0,passCount=0,totalReadings=0,simTime=0;
const MAX_POINTS=80;

const phaseBaselines={
  TAXI:{t1:180,h1:3000},TAKEOFF:{t1:820,h1:3000},CLIMB:{t1:720,h1:2800},
  CRUISE:{t1:650,h1:3000},DESCENT:{t1:580,h1:2900},LANDING:{t1:480,h1:3000}
};

function setPhase(p,btn){
  currentPhase=p;
  document.querySelectorAll('.phase-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('phaseDisplay').textContent=p;
}

function updateParam(k,v){
  params[k]=parseInt(v);
  document.getElementById(k+'Val').textContent=v+'%';
}

function noise(scale){return(Math.random()-0.5)*2*scale;}

function kalmanFilter(prev,raw){
  const k=0.1/(0.1+0.1);
  return prev+k*(raw-prev);
}

let k1=null,k2=null;
let chartsInited=false;

function initCharts(){
  if(chartsInited) return;
  chartsInited=true;
  drawChart('chart1',data1,0,1000,'°C');
  drawChart('chart2',data2,2600,3400,'PSI');
}

function drawChart(id,dataset,yMin,yMax,unit){
  const canvas=document.getElementById(id);
  if(!canvas) return;
  const W=canvas.offsetWidth||canvas.parentElement.offsetWidth||600;
  const H=canvas.height||150;
  canvas.width=W;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(0,170,255,0.06)';
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=H*i/4;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
    const val=yMax-(yMax-yMin)*i/4;
    ctx.fillStyle='rgba(221,238,255,0.25)';
    ctx.font='9px IBM Plex Mono,monospace';
    ctx.fillText(Math.round(val)+unit,4,y>8?y-3:10);
  }
  const drawLine=(data,color,alpha)=>{
    if(data.length<2) return;
    ctx.beginPath();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=1.5;
    data.forEach((v,i)=>{
      const x=W*(i/(MAX_POINTS-1));
      const y=H-(H*(v-yMin)/(yMax-yMin));
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke();ctx.globalAlpha=1;
  };
  drawLine(dataset.raw,'#ff4444',0.5);
  drawLine(dataset.kalman,'#00aaff',0.8);
  drawLine(dataset.ai,'#00ff88',1);
}

function addAlert(type,msg){
  const feed=document.getElementById('alertFeed');
  const m=String(Math.floor(simTime/60)).padStart(2,'0');
  const s=String(simTime%60).padStart(2,'0');
  const item=document.createElement('div');
  item.className='alert-item';
  item.innerHTML=`<div class="alert-time">${m}:${s}</div><div class="alert-status ${type}">${type.toUpperCase()}</div><div class="alert-msg">${msg}</div>`;
  feed.insertBefore(item,feed.firstChild);
  if(feed.children.length>30) feed.removeChild(feed.lastChild);
}

function updatePipelineDots(active){
  ['kalman','lstm','iso','rf','edge'].forEach(s=>{
    document.getElementById('dot-'+s).className='ps-dot '+(active?'active':'idle');
  });
}

function startSim(){
  if(simRunning){
    clearInterval(simInterval);simRunning=false;
    document.getElementById('startBtn').textContent='▶ START';
    document.getElementById('pipeStatus').textContent='IDLE';
    document.getElementById('pipeStatus').className='mr-val good';
    updatePipelineDots(false);
    ['kalman','lstm','iso','rf','edge'].forEach(s=>document.getElementById('stat-'+s).textContent='—');
    return;
  }
  simRunning=true;k1=null;k2=null;
  document.getElementById('startBtn').textContent='⏸ PAUSE';
  document.getElementById('pipeStatus').textContent='ACTIVE';
  updatePipelineDots(true);
  document.getElementById('latDisplay').textContent='~3.8ms';

  simInterval=setInterval(()=>{
    simTime++;totalReadings++;
    const bl=phaseBaselines[currentPhase];
    const nScale=params.noise*2;
    const faultChance=params.fault/100;
    const sens=params.sens/100;

    let r1=bl.t1+noise(nScale);
    let r2=bl.h1+noise(nScale*0.5);
    const isFault=Math.random()<faultChance;
    if(isFault){r1+=noise(nScale*8);r2+=noise(nScale*6);}

    if(k1===null){k1=r1;k2=r2;}
    const sm1=kalmanFilter(k1,r1);
    const sm2=kalmanFilter(k2,r2);
    k1=sm1;k2=sm2;

    const anomalyThreshold=(1-sens)*50+10;
    const isAnomaly=Math.abs(r1-bl.t1)>anomalyThreshold||Math.abs(r2-bl.h1)>(anomalyThreshold*0.5);
    const v1=isAnomaly?bl.t1+noise(5):sm1;
    const v2=isAnomaly?bl.h1+noise(3):sm2;

    const push=(arr,v)=>{arr.push(v);if(arr.length>MAX_POINTS)arr.shift();};
    push(data1.raw,r1);push(data1.kalman,sm1);push(data1.ai,v1);
    push(data2.raw,r2);push(data2.kalman,sm2);push(data2.ai,v2);

    if(isFault&&isAnomaly){
      suppressCount++;
      document.getElementById('suppressCount').textContent=suppressCount;
      if(Math.random()<0.4) addAlert('filter',`ENG TEMP spike suppressed — ${Math.round(r1)}°C vs expected ${bl.t1}°C`);
    } else if(!isFault){
      passCount++;
      document.getElementById('passCount').textContent=passCount;
    } else if(isFault&&!isAnomaly){
      addAlert('warn',`Fault passed filter — ENG TEMP: ${Math.round(r1)}°C`);
    }

    document.getElementById('rpsDisplay').textContent='~5';
    document.getElementById('stat-kalman').textContent=`σ=${Math.abs(r1-sm1).toFixed(1)}`;
    document.getElementById('stat-lstm').textContent=isFault?'ANOMALY':'NORMAL';
    document.getElementById('stat-iso').textContent=`score=${(Math.random()*0.3+(isFault?0.6:0)).toFixed(2)}`;
    document.getElementById('stat-rf').textContent=currentPhase;
    document.getElementById('stat-edge').textContent=`${(3+Math.random()*1.5).toFixed(1)}ms`;

    const fr=totalReadings>0?((suppressCount/totalReadings)*100).toFixed(1):0;
    document.getElementById('filterRate').textContent=fr+'%';
    document.getElementById('filterRate').className='mr-val neutral';

    drawChart('chart1',data1,0,1000,'°C');
    drawChart('chart2',data2,2600,Math.max(3400,bl.h1+300),'PSI');
  },180);
}

function injectFault(){
  if(!simRunning){addAlert('warn','Start simulation first');return;}
  params.fault=Math.min(params.fault+30,90);
  document.getElementById('faultSlider').value=params.fault;
  document.getElementById('faultVal').textContent=params.fault+'%';
  addAlert('warn',`FAULT INJECTION ACTIVE — fault rate elevated to ${params.fault}%`);
  setTimeout(()=>{
    params.fault=Math.max(params.fault-30,10);
    document.getElementById('faultSlider').value=params.fault;
    document.getElementById('faultVal').textContent=params.fault+'%';
    addAlert('ok','Fault injection ended — rates normalized');
  },4000);
}

function resetSim(){
  clearInterval(simInterval);simRunning=false;
  data1={raw:[],kalman:[],ai:[]};data2={raw:[],kalman:[],ai:[]};
  suppressCount=0;passCount=0;totalReadings=0;simTime=0;k1=null;k2=null;
  document.getElementById('startBtn').textContent='▶ START';
  document.getElementById('pipeStatus').textContent='IDLE';
  document.getElementById('suppressCount').textContent='0';
  document.getElementById('passCount').textContent='0';
  document.getElementById('filterRate').textContent='—';
  document.getElementById('rpsDisplay').textContent='—';
  document.getElementById('latDisplay').textContent='—';
  document.getElementById('alertFeed').innerHTML='<div class="alert-item"><div class="alert-time">00:00</div><div class="alert-status ok">SYS</div><div class="alert-msg">System reset. Ready to start.</div></div>';
  updatePipelineDots(false);
  ['kalman','lstm','iso','rf','edge'].forEach(s=>document.getElementById('stat-'+s).textContent='—');
  drawChart('chart1',data1,0,1000,'°C');
  drawChart('chart2',data2,2600,3400,'PSI');
}

// ── TESTING ──
const testState={};
function runTest(id){
  if(testState[id]==='running') return;
  const el=document.getElementById(id);
  el.className='test-scenario running';
  el.querySelector('.ts-icon').textContent='◌';
  el.querySelector('.ts-badge').textContent='RUNNING';
  testState[id]='running';
  const phaseMap={ts1:'p1',ts2:'p1',ts3:'p1',ts4:'p2',ts5:'p2',ts6:'p2',ts7:'p3',ts8:'p3',ts9:'p3'};
  setTimeout(()=>{
    const passed=Math.random()>0.15;
    el.className='test-scenario '+(passed?'passed':'failed');
    el.querySelector('.ts-icon').textContent=passed?'✓':'✗';
    el.querySelector('.ts-badge').textContent=passed?'PASSED':'FAILED';
    testState[id]=passed?'passed':'failed';
    const phase=phaseMap[id];
    const tests={p1:['ts1','ts2','ts3'],p2:['ts4','ts5','ts6'],p3:['ts7','ts8','ts9']}[phase];
    const done=tests.filter(t=>testState[t]==='passed').length;
    const pct=Math.round((done/tests.length)*100);
    document.getElementById(phase+'pct').textContent=pct+'%';
    document.getElementById(phase+'bar').style.width=pct+'%';
  },1200+Math.random()*1000);
}

// ── TECH ──
function toggleTech(el){
  const was=el.classList.contains('expanded');
  document.querySelectorAll('.tech-card').forEach(c=>c.classList.remove('expanded'));
  if(!was) el.classList.add('expanded');
}

// redraw charts on resize
window.addEventListener('resize',()=>{
  if(document.getElementById('section-simulation').classList.contains('active')){
    drawChart('chart1',data1,0,1000,'°C');
    drawChart('chart2',data2,2600,3400,'PSI');
  }
});
