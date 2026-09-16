/* ===================== Hero pulse-line animation (Canvas 2D — left-to-right sweep, ventilator style) ===================== */
(function initPulse(){
  const canvas = document.getElementById('pulseCanvas');
  const ctx = canvas.getContext('2d');

  let width, height;
  function resize(){
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    sweepX = 0;
    lastY = midY();
  }

  const GREEN = '#39ff6a';
  const GREEN_GLOW = 'rgba(57,255,106,0.55)';

  const BEATS_VISIBLE = 3;
  const SPEED = 140;
  const midY = () => height / 2;
  const amp = () => height * 0.30;

  function beatShape(local){
    if (local > 0.40 && local < 0.45) return (local - 0.40) * 18;
    if (local >= 0.45 && local < 0.51) return (0.51 - local) * 20;
    if (local >= 0.51 && local < 0.56) return -(local - 0.51) * 5;
    if (local >= 0.56 && local < 0.62) return (0.62 - local) * 5;
    return Math.sin(local * Math.PI * 2) * 0.02;
  }

  function yAt(x){
    const period = width / BEATS_VISIBLE;
    const local = (x % period) / period;
    return midY() - beatShape(local) * amp();
  }

  let sweepX = 0;
  let lastY = 0;
  let lastTime = performance.now();

  resize();
  window.addEventListener('resize', resize);

  function draw(now){
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const newSweepX = sweepX + SPEED * dt;

    if (newSweepX >= width){
      ctx.clearRect(0, 0, width, height);
      sweepX = 0;
      lastY = yAt(0);
    } else {
      ctx.lineWidth = 2;
      ctx.strokeStyle = GREEN;
      ctx.shadowColor = GREEN_GLOW;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(sweepX, lastY);
      const y = yAt(newSweepX);
      ctx.lineTo(newSweepX, y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      lastY = y;
      sweepX = newSweepX;

      ctx.beginPath();
      ctx.fillStyle = GREEN;
      ctx.shadowColor = GREEN_GLOW;
      ctx.shadowBlur = 12;
      ctx.arc(sweepX, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();


/* ===================== Date / stats ===================== */
document.getElementById('todayDate').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', month: 'long', day: 'numeric'
});

function formatTime(iso){
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}

/* ===================== Workouts ===================== */
const workoutForm = document.getElementById('workoutForm');
const workoutList = document.getElementById('workoutList');
const statWorkouts = document.getElementById('statWorkouts');

async function loadWorkouts(){
  const res = await fetch('/api/workouts');
  const data = await res.json();
  renderWorkouts(data);
}

function renderWorkouts(data){
  statWorkouts.textContent = data.length;
  if (data.length === 0){
    workoutList.innerHTML = '<p class="empty-state">No workouts logged yet. Add your first set above.</p>';
    return;
  }
  workoutList.innerHTML = data.map(w => {
    if (w.type === 'cardio'){
      const parts = [];
      if (w.duration) parts.push(`${w.duration} min`);
      if (w.distance) parts.push(`${w.distance} km`);
      const mainValue = w.steps ? `${Number(w.steps).toLocaleString()} steps` : (parts[0] || '—');
      return `
        <div class="entry-card">
          <div class="entry-main">
            <span class="entry-name">${escapeHtml(w.exercise)}</span>
            <span class="entry-meta">${parts.join(' · ') || 'cardio'} · ${formatTime(w.timestamp)}</span>
          </div>
          <span class="entry-value">${mainValue}</span>
          <button class="entry-delete" data-id="${w.id}" data-type="workout" title="Delete">✕</button>
        </div>
      `;
    }
    return `
    <div class="entry-card">
      <div class="entry-main">
        <span class="entry-name">${escapeHtml(w.exercise)}</span>
        <span class="entry-meta">${w.sets || 0} sets × ${w.reps || 0} reps · ${formatTime(w.timestamp)}</span>
      </div>
      <span class="entry-value">${w.weight ? w.weight + 'kg' : '—'}</span>
      <button class="entry-delete" data-id="${w.id}" data-type="workout" title="Delete">✕</button>
    </div>
  `;
  }).join('');
}

/* ===================== Strength / Cardio toggle ===================== */
let currentType = 'strength';
const typeButtons = document.querySelectorAll('.type-btn');
const strengthFields = document.getElementById('strengthFields');
const cardioFields = document.getElementById('cardioFields');
const stepCounterBox = document.getElementById('stepCounterBox');

typeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    typeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    const isCardio = currentType === 'cardio';
    strengthFields.style.display = isCardio ? 'none' : 'flex';
    cardioFields.style.display = isCardio ? 'flex' : 'none';
    stepCounterBox.style.display = isCardio ? 'flex' : 'none';
  });
});

workoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = currentType === 'cardio' ? {
    type: 'cardio',
    exercise: document.getElementById('exerciseInput').value,
    duration: document.getElementById('durationInput').value,
    distance: document.getElementById('distanceInput').value,
    steps: document.getElementById('stepsInput').value
  } : {
    type: 'strength',
    exercise: document.getElementById('exerciseInput').value,
    sets: document.getElementById('setsInput').value,
    reps: document.getElementById('repsInput').value,
    weight: document.getElementById('weightInput').value
  };
  const res = await fetch('/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok){
    workoutForm.reset();
    stepCount = 0;
    document.getElementById('liveStepCount').textContent = '0';
    document.getElementById('stepsInput').value = '';
    loadWorkouts();
  }
});

/* ===================== Auto step counter (device motion) ===================== */
let stepCount = 0;
let lastStepTime = 0;
let lastMagnitude = 0;
let risingEdge = false;
let motionActive = false;

const STEP_THRESHOLD = 1.15;      // acceleration delta needed to register a step
const MIN_STEP_INTERVAL = 300;    // ms — avoids double counting on one footfall

function handleMotion(event){
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  const magnitude = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
  const delta = magnitude - lastMagnitude;
  lastMagnitude = magnitude;

  const now = Date.now();
  if (delta > STEP_THRESHOLD && !risingEdge && (now - lastStepTime) > MIN_STEP_INTERVAL){
    risingEdge = true;
    lastStepTime = now;
    stepCount++;
    document.getElementById('liveStepCount').textContent = stepCount;
    document.getElementById('stepsInput').value = stepCount;
  } else if (delta < 0){
    risingEdge = false;
  }
}

const stepCounterToggle = document.getElementById('stepCounterToggle');

stepCounterToggle.addEventListener('click', async () => {
  if (motionActive){
    window.removeEventListener('devicemotion', handleMotion);
    motionActive = false;
    stepCounterToggle.textContent = 'Start auto step count';
    stepCounterToggle.classList.remove('active');
    return;
  }

  // iOS 13+ requires explicit permission
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'){
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted'){
        alert('Motion access denied — auto step counting needs it to detect steps.');
        return;
      }
    } catch (err){
      alert('Could not access motion sensors on this device/browser.');
      return;
    }
  }

  if (!('DeviceMotionEvent' in window)){
    alert('This browser does not support motion sensors, so steps can\'t be auto-counted. Enter them manually instead.');
    return;
  }

  window.addEventListener('devicemotion', handleMotion);
  motionActive = true;
  stepCounterToggle.textContent = 'Stop counting';
  stepCounterToggle.classList.add('active');
});

/* ===================== Readings ===================== */
const readingForm = document.getElementById('readingForm');
const readingList = document.getElementById('readingList');
const statReadings = document.getElementById('statReadings');

async function loadReadings(){
  const res = await fetch('/api/readings');
  const data = await res.json();
  renderReadings(data);
}

function renderReadings(data){
  statReadings.textContent = data.length;
  if (data.length === 0){
    readingList.innerHTML = '<p class="empty-state">No readings logged yet. Add your first one above.</p>';
    return;
  }
  readingList.innerHTML = data.map(r => `
    <div class="entry-card">
      <div class="entry-main">
        <span class="entry-name">${escapeHtml(r.label)}</span>
        <span class="entry-meta">${r.note ? escapeHtml(r.note) + ' · ' : ''}${formatTime(r.timestamp)}</span>
      </div>
      <span class="entry-value">${r.value}${r.unit ? ' ' + escapeHtml(r.unit) : ''}</span>
      <button class="entry-delete" data-id="${r.id}" data-type="reading" title="Delete">✕</button>
    </div>
  `).join('');
}

readingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    label: document.getElementById('labelInput').value,
    value: document.getElementById('valueInput').value,
    unit: document.getElementById('unitInput').value,
    note: document.getElementById('noteInput').value
  };
  const res = await fetch('/api/readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok){
    readingForm.reset();
    loadReadings();
  }
});

/* ===================== Delete (event delegation) ===================== */
document.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('entry-delete')) return;
  const id = e.target.dataset.id;
  const type = e.target.dataset.type;
  const endpoint = type === 'workout' ? `/api/workouts/${id}` : `/api/readings/${id}`;
  await fetch(endpoint, { method: 'DELETE' });
  if (type === 'workout') loadWorkouts(); else loadReadings();
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ===================== Voice reminders ===================== */
let reminderTimer = null;
const reminderToggle = document.getElementById('reminderToggle');
const reminderStatus = document.getElementById('reminderStatus');
const intervalSelect = document.getElementById('intervalSelect');
const messageSelect = document.getElementById('messageSelect');

function speak(text){
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function startReminders(){
  const minutes = parseInt(intervalSelect.value, 10);
  const message = messageSelect.value;
  speak('Reminders started. ' + message);
  reminderTimer = setInterval(() => speak(message), minutes * 60 * 1000);
  reminderToggle.textContent = 'Stop reminders';
  reminderToggle.classList.add('active');
  reminderStatus.textContent = `On · every ${intervalSelect.selectedOptions[0].textContent}`;
}

function stopReminders(){
  clearInterval(reminderTimer);
  reminderTimer = null;
  reminderToggle.textContent = 'Start reminders';
  reminderToggle.classList.remove('active');
  reminderStatus.textContent = 'Off';
}

reminderToggle.addEventListener('click', () => {
  if (reminderTimer) stopReminders();
  else startReminders();
});

/* ===================== Init ===================== */
loadWorkouts();
loadReadings();
