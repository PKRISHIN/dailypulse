/* ======================== Hero pulse-line animation (Canvas 2D — left-to-right sweep, ventilator style) ===================== */
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
// met = standard MET value (Compendium of Physical Activities, moderate-vigorous effort)
// mins = typical time to complete that exercise including rest, used only for the calorie estimate
const WORKOUT_SPLIT = {
  0: { label: 'Rest Day', muscles: [] }, // Sunday
  1: { label: 'Chest / Shoulder / Triceps', muscles: [
        { name: 'Chest', exercises: [
            { name: 'Barbell Bench Press', sets: '3', reps: '8-10', met: 6.0, mins: 12 },
            { name: 'Incline Dumbbell Press', sets: '3', reps: '10-12', met: 5.0, mins: 10 },
            { name: 'Chest Fly (Pec Deck)', sets: '3', reps: '12-15', met: 4.0, mins: 8 }
        ]},
        { name: 'Shoulder', exercises: [
            { name: 'Overhead Shoulder Press', sets: '3', reps: '8-10', met: 6.0, mins: 10 },
            { name: 'Lateral Raise', sets: '3', reps: '12-15', met: 3.5, mins: 8 },
            { name: 'Front Raise', sets: '3', reps: '12-15', met: 3.5, mins: 8 }
        ]},
        { name: 'Triceps', exercises: [
            { name: 'Triceps Rope Pushdown', sets: '3', reps: '12-15', met: 4.0, mins: 8 },
            { name: 'Skull Crushers', sets: '3', reps: '10-12', met: 4.0, mins: 9 },
            { name: 'Overhead Triceps Extension', sets: '3', reps: '12-15', met: 3.5, mins: 8 }
        ]}
      ]},
  2: { label: 'Back / Biceps / Forearm', muscles: [
        { name: 'Back', exercises: [
            { name: 'Pull-Ups / Lat Pulldown', sets: '3', reps: '8-10', met: 6.0, mins: 12 },
            { name: 'Barbell Bent-Over Row', sets: '3', reps: '8-10', met: 6.0, mins: 10 },
            { name: 'Seated Cable Row', sets: '3', reps: '10-12', met: 5.0, mins: 9 }
        ]},
        { name: 'Biceps', exercises: [
            { name: 'Dumbbell Bicep Curl', sets: '3', reps: '10-12', met: 3.5, mins: 8 },
            { name: 'Barbell Curl', sets: '3', reps: '8-10', met: 3.5, mins: 8 },
            { name: 'Concentration Curl', sets: '3', reps: '12-15', met: 3.0, mins: 7 }
        ]},
        { name: 'Forearm', exercises: [
            { name: 'Hammer Curl', sets: '3', reps: '12-15', met: 3.5, mins: 8 },
            { name: 'Wrist Curl', sets: '3', reps: '15-20', met: 3.0, mins: 6 },
            { name: 'Reverse Curl', sets: '3', reps: '12-15', met: 3.0, mins: 7 }
        ]}
      ]},
  3: { label: 'Legs / Abs / Cardio', muscles: [
        { name: 'Legs', exercises: [
            { name: 'Barbell Squat', sets: '3', reps: '8-10', met: 6.0, mins: 14 },
            { name: 'Walking Lunges', sets: '3', reps: '12 each leg', met: 5.0, mins: 10 },
            { name: 'Leg Press', sets: '3', reps: '10-12', met: 5.5, mins: 10 }
        ]},
        { name: 'Abs', exercises: [
            { name: 'Hanging Leg Raise', sets: '3', reps: '15', met: 4.0, mins: 8 },
            { name: 'Plank', sets: '3', reps: '45-60 sec', met: 3.5, mins: 6 },
            { name: 'Cable Crunch', sets: '3', reps: '15-20', met: 3.5, mins: 7 }
        ]},
        { name: 'Cardio', exercises: [
            { name: 'Treadmill Running', sets: '1', reps: '15-20 min', met: 8.0, mins: 18 },
            { name: 'Cycling', sets: '1', reps: '15-20 min', met: 7.5, mins: 18 },
            { name: 'Jump Rope', sets: '1', reps: '10 min', met: 9.0, mins: 10 }
        ]}
      ]},
  4: null, // filled below (same as Monday)
  5: null, // filled below (same as Tuesday)
  6: null, // filled below (same as Wednesday)
};
WORKOUT_SPLIT[4] = WORKOUT_SPLIT[1];
WORKOUT_SPLIT[5] = WORKOUT_SPLIT[2];
WORKOUT_SPLIT[6] = WORKOUT_SPLIT[3];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTodaySplit(){
  return WORKOUT_SPLIT[new Date().getDay()];
}

function exerciseCalories(ex, weightKg){
  // calories = MET * weight(kg) * time(hours)
  return ex.met * weightKg * (ex.mins / 60);
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
        <p>No training scheduled today — recovery is part of the plan.</p>
      </div>`;
    return;
  }

  const weight = parseFloat(document.getElementById('bodyWeightInput').value) || null;

  container.innerHTML = `
    <h3>${split.label}</h3>
    ${split.muscles.map(muscle => `
      <div class="muscle-group">
        <p class="muscle-group-name">${muscle.name}</p>
        <div class="exercise-list">
          ${muscle.exercises.map(ex => {
            const cal = weight ? Math.round(exerciseCalories(ex, weight)) : null;
            return `
            <div class="exercise-item">
              <div class="exercise-main">
                <span class="exercise-name">${ex.name}</span>
                <span class="exercise-goal">${ex.sets} sets × ${ex.reps}</span>
              </div>
              <span class="exercise-cal">${cal !== null ? cal + ' kcal' : '—'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('')}
  `;
  updateCalorieTotal();
}

function allTodayExercises(split){
  return split.muscles.flatMap(m => m.exercises);
}

function updateCalorieTotal(){
  const split = getTodaySplit();
  const resultEl = document.getElementById('calorieResult');
  const weight = parseFloat(document.getElementById('bodyWeightInput').value);

  if (split.muscles.length === 0){
    resultEl.textContent = 'Rest day — no session to estimate.';
    return;
  }
  if (!weight){
    resultEl.textContent = 'Enter your weight to see an estimated calorie burn for each exercise today.';
    return;
  }
  const total = allTodayExercises(split).reduce((sum, ex) => sum + exerciseCalories(ex, weight), 0);
  resultEl.innerHTML = `Estimated total for today's session: <strong>${Math.round(total)} kcal</strong>`;
}

function getTodaySplitSpeech(){
  const split = getTodaySplit();
  if (split.muscles.length === 0){
    return "Today is a rest day. No training scheduled.";
  }
  const parts = split.muscles.map(muscle => {
    const list = muscle.exercises.map(ex => `${ex.name}, ${ex.sets} sets of ${ex.reps}`).join('. ');
    return `For ${muscle.name}: ${list}`;
  }).join('. ');
  return `Today's split is ${split.label}. ${parts}.`;
}

document.getElementById('bodyWeightInput').addEventListener('input', () => {
  renderTodaySplit();
});

let isAnnouncing = false;
const announceBtn = document.getElementById('announceSplitBtn');
const ANNOUNCE_DEFAULT_LABEL = "🔊 Announce today's workout";

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
  announceBtn.textContent = "⏹ Stop announcement";
  window.speechSynthesis.speak(utterance);
});

renderSplitWeek();
renderTodaySplit();

/* ===================== Init ===================== */
loadWorkouts();
loadReadings();
