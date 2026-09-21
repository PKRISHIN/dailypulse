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

  const GREEN_RGB = [57, 255, 106];
  const RED_RGB = [255, 59, 59];

  function colorAt(xNorm, alpha){
    const t = Math.max(0, Math.min(1, (xNorm - 0.5) / 0.5)); // stays green until halfway, then shifts to red
    const r = Math.round(GREEN_RGB[0] + (RED_RGB[0] - GREEN_RGB[0]) * t);
    const g = Math.round(GREEN_RGB[1] + (RED_RGB[1] - GREEN_RGB[1]) * t);
    const b = Math.round(GREEN_RGB[2] + (RED_RGB[2] - GREEN_RGB[2]) * t);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  let BEATS_VISIBLE = 6;         // randomized each pass — see resetPass()
  const SPEED = 140;             // px per second the sweep travels
  const midY = () => height / 2;
  const amp = () => height * 0.30;

  function randomBeatCount(){
    return Math.floor(Math.random() * 4) + 5; // 5..8
  }

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
      // sweep finished — clear, pick a new random beat count, start fresh pass
      ctx.clearRect(0, 0, width, height);
      BEATS_VISIBLE = randomBeatCount();
      sweepX = 0;
      lastY = yAt(0);
    } else {
      const xNorm = newSweepX / width;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = colorAt(xNorm, 1);
      ctx.shadowColor = colorAt(xNorm, 0.3);
      ctx.shadowBlur = 2;

      ctx.beginPath();
      ctx.moveTo(sweepX, lastY);
      const y = yAt(newSweepX);
      ctx.lineTo(newSweepX, y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      lastY = y;
      sweepX = newSweepX;
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

function resolveMessage(raw){
  if (raw === '__todaysplit__') return getTodaySplitSpeech();
  return raw;
}

function startReminders(){
  const minutes = parseInt(intervalSelect.value, 10);
  speak('Reminders started. ' + resolveMessage(messageSelect.value));
  reminderTimer = setInterval(() => speak(resolveMessage(messageSelect.value)), minutes * 60 * 1000);
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

/* ===================== Weekly Workout Split ===================== */
// Each muscle has 4 exercise variations (A-D). One is picked automatically
// based on the current week number, so the plan changes every week and
// cycles back after 4 weeks. met/mins are used only for the calorie estimate.
function muscle(name, variations){ return { name, variations }; }
function ex(name, sets, reps, met, mins){ return { name, sets, reps, met, mins }; }

const WORKOUT_SPLIT = {
  0: { label: 'Rest Day', muscles: [] }, // Sunday
  1: { label: 'Chest / Shoulder / Triceps', muscles: [
        muscle('Chest', [
          [ ex('Barbell Bench Press','3','8-10',6.0,12), ex('Incline Dumbbell Press','3','10-12',5.0,10), ex('Chest Fly (Pec Deck)','3','12-15',4.0,8) ],
          [ ex('Machine Chest Press','3','10-12',5.0,10), ex('Decline Bench Press','3','8-10',6.0,12), ex('Cable Crossover','3','12-15',4.0,8) ],
          [ ex('Dumbbell Bench Press','3','8-10',5.5,11), ex('Incline Barbell Press','3','8-10',6.0,12), ex('Dumbbell Pullover','3','12-15',4.0,8) ],
          [ ex('Smith Machine Bench Press','3','8-10',5.5,11), ex('Incline Cable Fly','3','12-15',4.0,8), ex('Chest Dips','3','8-12',5.0,9) ]
        ]),
        muscle('Shoulder', [
          [ ex('Overhead Shoulder Press','3','8-10',6.0,10), ex('Lateral Raise','3','12-15',3.5,8), ex('Front Raise','3','12-15',3.5,8) ],
          [ ex('Arnold Press','3','8-10',6.0,10), ex('Cable Lateral Raise','3','12-15',3.5,8), ex('Rear Delt Fly','3','12-15',3.5,8) ],
          [ ex('Dumbbell Shoulder Press','3','8-10',5.5,10), ex('Upright Row','3','10-12',4.0,8), ex('Face Pull','3','15-20',3.5,8) ],
          [ ex('Machine Shoulder Press','3','10-12',5.0,10), ex('Cable Front Raise','3','12-15',3.5,8), ex('Reverse Pec Deck','3','12-15',3.5,8) ]
        ]),
        muscle('Triceps', [
          [ ex('Triceps Rope Pushdown','3','12-15',4.0,8), ex('Skull Crushers','3','10-12',4.0,9), ex('Overhead Triceps Extension','3','12-15',3.5,8) ],
          [ ex('Close-Grip Bench Press','3','8-10',5.5,10), ex('Triceps Dips','3','8-12',5.0,9), ex('Single-Arm Cable Extension','3','12-15',3.5,7) ],
          [ ex('Diamond Push-Ups','3','10-15',4.0,7), ex('EZ-Bar Skull Crushers','3','10-12',4.0,9), ex('Cable Kickback','3','12-15',3.0,7) ],
          [ ex('Triceps Dip Machine','3','10-12',4.5,8), ex('Overhead Dumbbell Extension','3','12-15',3.5,8), ex('V-Bar Pushdown','3','12-15',3.5,7) ]
        ])
      ]},
  2: { label: 'Back / Biceps / Forearm', muscles: [
        muscle('Back', [
          [ ex('Pull-Ups / Lat Pulldown','3','8-10',6.0,12), ex('Barbell Bent-Over Row','3','8-10',6.0,10), ex('Seated Cable Row','3','10-12',5.0,9) ],
          [ ex('Deadlift','3','6-8',6.5,14), ex('T-Bar Row','3','8-10',6.0,10), ex('Single-Arm Dumbbell Row','3','10-12',5.0,9) ],
          [ ex('Wide-Grip Lat Pulldown','3','10-12',5.0,10), ex('Chest-Supported Row','3','10-12',5.0,9), ex('Straight-Arm Pulldown','3','12-15',4.0,7) ],
          [ ex('Chin-Ups','3','6-10',6.0,11), ex('Pendlay Row','3','8-10',6.0,10), ex('Face Pull','3','15-20',3.5,7) ]
        ]),
        muscle('Biceps', [
          [ ex('Dumbbell Bicep Curl','3','10-12',3.5,8), ex('Barbell Curl','3','8-10',3.5,8), ex('Concentration Curl','3','12-15',3.0,7) ],
          [ ex('Preacher Curl','3','10-12',3.5,8), ex('Cable Curl','3','12-15',3.0,7), ex('Incline Dumbbell Curl','3','10-12',3.5,8) ],
          [ ex('Hammer Curl','3','10-12',3.5,8), ex('EZ-Bar Curl','3','8-10',3.5,8), ex('Spider Curl','3','12-15',3.0,7) ],
          [ ex('Cable Rope Curl','3','12-15',3.0,7), ex('Zottman Curl','3','10-12',3.5,8), ex('Drag Curl','3','10-12',3.0,7) ]
        ]),
        muscle('Forearm', [
          [ ex('Hammer Curl','3','12-15',3.5,8), ex('Wrist Curl','3','15-20',3.0,6), ex('Reverse Curl','3','12-15',3.0,7) ],
          [ ex("Farmer's Carry",'3','30-40 sec',4.0,8), ex('Reverse Wrist Curl','3','15-20',3.0,6), ex('Plate Pinch Hold','3','20-30 sec',3.0,6) ],
          [ ex('Behind-the-Back Wrist Curl','3','15-20',3.0,6), ex('Dead Hang','3','20-30 sec',3.0,6), ex('Wrist Roller','3','2-3 reps',3.5,7) ],
          [ ex('Reverse Barbell Curl','3','10-12',3.5,8), ex('Grip Squeeze','3','15-20',3.0,6), ex('Finger Extensions','3','15-20',2.5,5) ]
        ])
      ]},
  3: { label: 'Legs / Abs / Cardio', muscles: [
        muscle('Legs', [
          [ ex('Barbell Squat','3','8-10',6.0,14), ex('Walking Lunges','3','12 each leg',5.0,10), ex('Leg Press','3','10-12',5.5,10) ],
          [ ex('Romanian Deadlift','3','8-10',6.0,12), ex('Bulgarian Split Squat','3','10-12 each',5.5,10), ex('Leg Extension','3','12-15',4.0,8) ],
          [ ex('Front Squat','3','6-8',6.5,13), ex('Step-Ups','3','10-12 each',5.0,9), ex('Leg Curl','3','12-15',4.0,8) ],
          [ ex('Hack Squat','3','8-10',6.0,12), ex('Goblet Squat','3','10-12',5.0,9), ex('Calf Raise','3','15-20',3.5,7) ]
        ]),
        muscle('Abs', [
          [ ex('Hanging Leg Raise','3','15',4.0,8), ex('Plank','3','45-60 sec',3.5,6), ex('Cable Crunch','3','15-20',3.5,7) ],
          [ ex('Bicycle Crunch','3','20',3.5,7), ex('Russian Twist','3','20',3.5,7), ex('Mountain Climbers','3','30 sec',5.0,6) ],
          [ ex('Sit-Ups','3','15-20',3.5,7), ex('Side Plank','3','30-45 sec each',3.5,6), ex('Toe Touches','3','15-20',3.0,6) ],
          [ ex('V-Ups','3','12-15',3.5,7), ex('Ab Wheel Rollout','3','8-10',4.0,8), ex('Flutter Kicks','3','30 sec',3.5,6) ]
        ]),
        muscle('Cardio', [
          [ ex('Treadmill Running','1','15-20 min',8.0,18), ex('Cycling','1','15-20 min',7.5,18), ex('Jump Rope','1','10 min',9.0,10) ],
          [ ex('Stair Climber','1','15 min',8.0,15), ex('Rowing Machine','1','15-20 min',7.0,18), ex('Elliptical','1','15-20 min',6.5,18) ],
          [ ex('Sprint Intervals','1','10-12 min',9.5,12), ex('Swimming','1','20 min',7.0,20), ex('Jump Squats','3','15',6.0,6) ],
          [ ex('Incline Brisk Walk','1','20 min',6.0,20), ex('Battle Ropes','3','30 sec',8.0,6), ex('Burpees','3','12-15',8.5,8) ]
        ])
      ]},
  4: null, // filled below (same as Monday)
  5: null, // filled below (same as Tuesday)
  6: null, // filled below (same as Wednesday)
};
WORKOUT_SPLIT[4] = WORKOUT_SPLIT[1];
WORKOUT_SPLIT[5] = WORKOUT_SPLIT[2];
WORKOUT_SPLIT[6] = WORKOUT_SPLIT[3];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekIndex(){
  // ISO-ish week number, cycles through 4 variations, changes every week
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return week % 4;
}

function getTodaySplit(){
  return WORKOUT_SPLIT[new Date().getDay()];
}

function todaysExercisesFor(muscleObj){
  return muscleObj.variations[getWeekIndex()];
}

function exerciseCalories(exObj, weightKg){
  // calories = MET * weight(kg) * time(hours)
  return exObj.met * weightKg * (exObj.mins / 60);
}

/* ---- Simple illustrative body silhouette (not anatomically precise) ---- */
const BODY_REGION_MAP = {
  'Chest':   { view: 'front', regions: ['chest'] },
  'Shoulder':{ view: 'front', regions: ['shoulders'] },
  'Triceps': { view: 'back',  regions: ['arms'] },
  'Back':    { view: 'back',  regions: ['upperback'] },
  'Biceps':  { view: 'front', regions: ['arms'] },
  'Forearm': { view: 'front', regions: ['forearm'] },
  'Legs':    { view: 'front', regions: ['legs'] },
  'Abs':     { view: 'front', regions: ['abs'] },
  'Cardio':  { view: 'front', regions: ['legs', 'chest'] }
};

function bodyDiagram(muscleName){
  const map = BODY_REGION_MAP[muscleName] || { view: 'front', regions: [] };
  const on = (key) => map.regions.includes(key) ? 'var(--pulse)' : '#2a3532';
  const torsoFill = on(map.view === 'back' ? 'upperback' : 'chest');
  return `
    <svg viewBox="0 0 60 130" class="body-diagram" aria-hidden="true">
      <circle cx="30" cy="12" r="9" fill="#3a4744"/>
      <rect x="12" y="24" width="9" height="11" rx="3" fill="${on('shoulders')}"/>
      <rect x="39" y="24" width="9" height="11" rx="3" fill="${on('shoulders')}"/>
      <rect x="20" y="22" width="20" height="36" rx="4" fill="${torsoFill}"/>
      <rect x="9" y="34" width="8" height="24" rx="3" fill="${on('arms')}"/>
      <rect x="43" y="34" width="8" height="24" rx="3" fill="${on('arms')}"/>
      <rect x="9" y="58" width="8" height="16" rx="3" fill="${on('forearm')}"/>
      <rect x="43" y="58" width="8" height="16" rx="3" fill="${on('forearm')}"/>
      <rect x="21" y="56" width="18" height="18" rx="3" fill="${on('abs')}"/>
      <rect x="20" y="76" width="8" height="42" rx="3" fill="${on('legs')}"/>
      <rect x="32" y="76" width="8" height="42" rx="3" fill="${on('legs')}"/>
    </svg>
    <span class="body-diagram-label">${map.view === 'back' ? 'Back view' : 'Front view'} \u00b7 illustrative</span>
  `;
}

function renderSplitWeek(){
  const container = document.getElementById('splitWeek');
  const today = new Date().getDay();
  container.innerHTML = DAY_NAMES.map((name, i) => {
    const isRest = WORKOUT_SPLIT[i].muscles.length === 0;
    const isToday = i === today;
    return `<div class="day-chip ${isToday ? 'is-today' : ''} ${isRest ? 'is-rest' : ''}">
      <span class="day-chip-name">${name}</span>
      <span class="day-chip-tag">${isRest ? 'Rest' : 'Training'}</span>
    </div>`;
  }).join('');
}

function renderTodaySplit(){
  const split = getTodaySplit();
  const container = document.getElementById('splitToday');

  if (split.muscles.length === 0){
    container.innerHTML = `
      <div class="split-rest">
        <h3>Rest Day</h3>
        <p>No training scheduled today \u2014 recovery is part of the plan.</p>
      </div>`;
    return;
  }

  const weight = parseFloat(document.getElementById('bodyWeightInput').value) || null;
  const weekNum = getWeekIndex() + 1;

  container.innerHTML = `
    <h3>${split.label} <span class="week-tag">Week variation ${weekNum} of 4</span></h3>
    ${split.muscles.map(m => {
      const exercises = todaysExercisesFor(m);
      return `
      <div class="muscle-group">
        <div class="muscle-group-head">
          ${bodyDiagram(m.name)}
          <p class="muscle-group-name">${m.name}</p>
        </div>
        <div class="exercise-list">
          ${exercises.map(exItem => {
            const cal = weight ? Math.round(exerciseCalories(exItem, weight)) : null;
            return `
            <div class="exercise-item">
              <div class="exercise-main">
                <span class="exercise-name">${exItem.name}</span>
                <span class="exercise-goal">${exItem.sets} sets \u00d7 ${exItem.reps}</span>
              </div>
              <span class="exercise-cal">${cal !== null ? cal + ' kcal' : '\u2014'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
    }).join('')}
  `;
  updateCalorieTotal();
}

function allTodayExercises(split){
  return split.muscles.flatMap(m => todaysExercisesFor(m));
}

function updateCalorieTotal(){
  const split = getTodaySplit();
  const resultEl = document.getElementById('calorieResult');
  const weight = parseFloat(document.getElementById('bodyWeightInput').value);

  if (split.muscles.length === 0){
    resultEl.textContent = 'Rest day \u2014 no session to estimate.';
    return;
  }
  if (!weight){
    resultEl.textContent = 'Enter your weight to see an estimated calorie burn for each exercise today.';
    return;
  }
  const total = allTodayExercises(split).reduce((sum, exItem) => sum + exerciseCalories(exItem, weight), 0);
  resultEl.innerHTML = `Estimated total for today's session: <strong>${Math.round(total)} kcal</strong>`;
}

function getTodaySplitSpeech(){
  const split = getTodaySplit();
  if (split.muscles.length === 0){
    return "Today is a rest day. No training scheduled.";
  }
  const parts = split.muscles.map(m => {
    const exercises = todaysExercisesFor(m);
    const list = exercises.map(exItem => `${exItem.name}, ${exItem.sets} sets of ${exItem.reps}`).join('. ');
    return `For ${m.name}: ${list}`;
  }).join('. ');
  return `Today's split is ${split.label}. ${parts}.`;
}

document.getElementById('bodyWeightInput').addEventListener('input', () => {
  renderTodaySplit();
});

let isAnnouncing = false;
const announceBtn = document.getElementById('announceSplitBtn');
const ANNOUNCE_DEFAULT_LABEL = "\ud83d\udd0a Announce today's workout";

announceBtn.addEventListener('click', () => {
  if (isAnnouncing){
    window.speechSynthesis.cancel();
    isAnnouncing = false;
    announceBtn.textContent = ANNOUNCE_DEFAULT_LABEL;
    return;
  }
  window.speechSynthesis.cancel(); // clear any stuck/queued speech first
  const utterance = new SpeechSynthesisUtterance(getTodaySplitSpeech());
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onend = () => {
    isAnnouncing = false;
    announceBtn.textContent = ANNOUNCE_DEFAULT_LABEL;
  };
  utterance.onerror = () => {
    isAnnouncing = false;
    announceBtn.textContent = ANNOUNCE_DEFAULT_LABEL;
  };
  isAnnouncing = true;
  announceBtn.textContent = "\u23f9 Stop announcement";
  window.speechSynthesis.speak(utterance);
});

renderSplitWeek();
renderTodaySplit();

/* ===================== Init ===================== */
loadWorkouts();
loadReadings();
