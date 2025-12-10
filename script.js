// Clés de stockage
const STORAGE_KEYS = {
  weights: "ss_weights",
  meals: "ss_meals",
  program: "ss_program",
  workouts: "ss_workouts",
  profile: "ss_profile",
};

let weightChart = null;
let volumeChart = null;

document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  initTodayTab();
  initProgramTab();
  initHistoryTab();
  initSettingsTab();
  initWorkoutModal();
});

/* ---------- Helpers généraux ---------- */

function getTodayDateString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function loadArray(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function loadObject(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveObject(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

/* ---------- Navigation bas ---------- */

function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-btn");
  const tabs = document.querySelectorAll(".tab-section");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;

      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.id === target);
      });
    });
  });

  const todayLabel = document.getElementById("current-date-label");
  const today = getTodayDateString();
  todayLabel.textContent = formatDateHuman(today);
}

/* ---------- Onglet Aujourd'hui ---------- */

function initTodayTab() {
  const today = getTodayDateString();
  const weightInput = document.getElementById("today-weight-input");
  const weightInfo = document.getElementById("today-weight-info");
  const saveWeightBtn = document.getElementById("save-today-weight-btn");

  const mealsBtns = document.querySelectorAll(".save-meal-btn");

  // Charger poids du jour
  const weights = loadArray(STORAGE_KEYS.weights);
  const todayWeight = weights.find((w) => w.date === today);
  if (todayWeight) {
    weightInput.value = todayWeight.weight;
    weightInfo.textContent = `Dernier poids saisi : ${todayWeight.weight} kg`;
  } else {
    weightInfo.textContent = "Aucun poids saisi pour aujourd'hui.";
  }

  saveWeightBtn.addEventListener("click", () => {
    const val = parseFloat(weightInput.value);
    if (isNaN(val)) {
      alert("Merci de saisir un poids valide.");
      return;
    }
    let list = loadArray(STORAGE_KEYS.weights);
    const existingIndex = list.findIndex((w) => w.date === today);
    const entry = { date: today, weight: val };
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }
    saveArray(STORAGE_KEYS.weights, list);
    weightInfo.textContent = `Dernier poids saisi : ${val} kg`;
  });

  // Charger alimentation du jour
  const meals = loadArray(STORAGE_KEYS.meals);
  const breakfastInput = document.getElementById("meal-breakfast");
  const lunchInput = document.getElementById("meal-lunch");
  const dinnerInput = document.getElementById("meal-dinner");
  const snackInput = document.getElementById("meal-snack");

  function loadMealText(mealType, textarea) {
    const m = meals.find((x) => x.date === today && x.mealType === mealType);
    textarea.value = m ? m.text : "";
  }

  loadMealText("petit-dejeuner", breakfastInput);
  loadMealText("dejeuner", lunchInput);
  loadMealText("diner", dinnerInput);
  loadMealText("collation", snackInput);

  mealsBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mealType = btn.dataset.mealType;
      let textarea;
      if (mealType === "petit-dejeuner") textarea = breakfastInput;
      else if (mealType === "dejeuner") textarea = lunchInput;
      else if (mealType === "diner") textarea = dinnerInput;
      else textarea = snackInput;

      const text = textarea.value.trim();
      let list = loadArray(STORAGE_KEYS.meals);
      const idx = list.findIndex((m) => m.date === today && m.mealType === mealType);
      const entry = { date: today, mealType, text };
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }
      saveArray(STORAGE_KEYS.meals, list);
    });
  });

  // Séance du jour : preview & boutons
  updateTodayWorkoutPreview();

  document
    .getElementById("open-today-workout-btn")
    .addEventListener("click", () => openWorkoutModal(today, false));

  document
    .getElementById("create-free-workout-btn")
    .addEventListener("click", () => openWorkoutModal(today, true));
}

function updateTodayWorkoutPreview() {
  const today = getTodayDateString();
  const preview = document.getElementById("today-workout-preview");
  const program = loadArray(STORAGE_KEYS.program);
  const dayProgram = program.find((p) => p.date === today);

  if (!dayProgram || !dayProgram.exercises || dayProgram.exercises.length === 0) {
    preview.textContent = "Aucune séance programmée aujourd'hui.";
    return;
  }

  const ul = document.createElement("ul");
  ul.style.paddingLeft = "1.2rem";

  dayProgram.exercises.forEach((ex) => {
    const li = document.createElement("li");
    li.textContent = `${ex.name} – ${ex.targetSets} × ${ex.targetReps} à ${ex.targetWeight} kg`;
    ul.appendChild(li);
  });

  preview.innerHTML = "";
  preview.appendChild(ul);
}

/* ---------- Onglet Programme ---------- */

let selectedProgramDate = getTodayDateString();

function initProgramTab() {
  const datePicker = document.getElementById("program-date-picker");
  datePicker.value = selectedProgramDate;
  datePicker.addEventListener("change", () => {
    selectedProgramDate = datePicker.value || getTodayDateString();
    refreshProgramEditor();
    highlightWeekFromSelectedDate();
  });

  document
    .getElementById("add-program-exercise-btn")
    .addEventListener("click", () => addProgramExerciseRow());

  document
    .getElementById("save-program-day-btn")
    .addEventListener("click", () => saveProgramDay());

  document
    .getElementById("duplicate-day-btn")
    .addEventListener("click", () => duplicateProgramDay());

  buildWeekView();
  refreshProgramEditor();
}

function buildWeekView() {
  const container = document.getElementById("week-days-container");
  container.innerHTML = "";
  const today = new Date(selectedProgramDate + "T00:00:00");
  const dayOfWeek = today.getDay(); // 0=dimanche
  const mondayOffset = (dayOfWeek + 6) % 7; // décalage pour lundi

  const program = loadArray(STORAGE_KEYS.program);

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - mondayOffset + i);
    const iso = d.toISOString().slice(0, 10);

    const pill = document.createElement("button");
    pill.className = "week-day-pill";
    pill.textContent = d
      .toLocaleDateString("fr-FR", { weekday: "short" })
      .replace(".", "");
    pill.title = iso;
    if (iso === selectedProgramDate) {
      pill.classList.add("active");
    }

    const dayProg = program.find((p) => p.date === iso);
    if (dayProg && dayProg.exercises && dayProg.exercises.length > 0) {
      pill.textContent += " •";
    }

    pill.addEventListener("click", () => {
      selectedProgramDate = iso;
      document.getElementById("program-date-picker").value = iso;
      refreshProgramEditor();
      highlightWeekFromSelectedDate();
    });

    container.appendChild(pill);
  }
}

function highlightWeekFromSelectedDate() {
  buildWeekView();
}

function refreshProgramEditor() {
  const title = document.getElementById("program-editor-title");
  title.textContent = `Programme du ${formatDateHuman(selectedProgramDate)}`;

  const container = document.getElementById("program-exercises-container");
  container.innerHTML = "";

  const program = loadArray(STORAGE_KEYS.program);
  const dayProgram = program.find((p) => p.date === selectedProgramDate);

  const exercises = dayProgram ? dayProgram.exercises : [];

  exercises.forEach((ex) => {
    addProgramExerciseRow(ex);
  });
}

function addProgramExerciseRow(exercise) {
  const container = document.getElementById("program-exercises-container");
  const row = document.createElement("div");
  row.className = "exercise-row";

  const header = document.createElement("div");
  header.className = "exercise-row-header";

  const title = document.createElement("strong");
  title.textContent = exercise?.name || "Nouvel exercice";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "link-btn";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", () => row.remove());

  header.appendChild(title);
  header.appendChild(deleteBtn);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nom de l'exercice (ex : Développé couché)";
  nameInput.value = exercise?.name || "";
  nameInput.addEventListener("input", () => {
    title.textContent = nameInput.value || "Nouvel exercice";
  });

  const setsInput = document.createElement("input");
  setsInput.type = "number";
  setsInput.placeholder = "Séries (ex : 4)";
  setsInput.value = exercise?.targetSets || "";

  const repsInput = document.createElement("input");
  repsInput.type = "number";
  repsInput.placeholder = "Répétitions (ex : 10)";
  repsInput.value = exercise?.targetReps || "";

  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.placeholder = "Poids cible (kg)";
  weightInput.step = "0.5";
  weightInput.value = exercise?.targetWeight || "";

  row.appendChild(header);
  row.appendChild(nameInput);
  row.appendChild(setsInput);
  row.appendChild(repsInput);
  row.appendChild(weightInput);

  container.appendChild(row);
}

function saveProgramDay() {
  const rows = document.querySelectorAll("#program-exercises-container .exercise-row");
  const exercises = [];

  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const [nameI, setsI, repsI, weightI] = inputs;
    const name = nameI.value.trim();
    if (!name) return;
    exercises.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name,
      targetSets: parseInt(setsI.value) || 0,
      targetReps: parseInt(repsI.value) || 0,
      targetWeight: parseFloat(weightI.value) || 0,
    });
  });

  let program = loadArray(STORAGE_KEYS.program);
  const idx = program.findIndex((p) => p.date === selectedProgramDate);
  const entry = { date: selectedProgramDate, exercises };

  if (idx >= 0) {
    program[idx] = entry;
  } else {
    program.push(entry);
  }
  saveArray(STORAGE_KEYS.program, program);
  buildWeekView();
  if (selectedProgramDate === getTodayDateString()) {
    updateTodayWorkoutPreview();
  }
}

function duplicateProgramDay() {
  const sourceDate = prompt(
    "Dupliquer depuis quel jour ?\nFormat : AAAA-MM-JJ (ex : 2025-12-10)"
  );
  if (!sourceDate) return;
  const program = loadArray(STORAGE_KEYS.program);
  const src = program.find((p) => p.date === sourceDate.trim());
  if (!src) {
    alert("Aucun programme trouvé pour cette date.");
    return;
  }
  const clonedExercises = src.exercises.map((e) => ({ ...e }));
  let idx = program.findIndex((p) => p.date === selectedProgramDate);
  const entry = { date: selectedProgramDate, exercises: clonedExercises };
  if (idx >= 0) program[idx] = entry;
  else program.push(entry);
  saveArray(STORAGE_KEYS.program, program);
  refreshProgramEditor();
  buildWeekView();
  if (selectedProgramDate === getTodayDateString()) {
    updateTodayWorkoutPreview();
  }
}

/* ---------- Modal séance du jour (Workout) ---------- */

function initWorkoutModal() {
  const closeBtn = document.getElementById("close-workout-modal-btn");
  closeBtn.addEventListener("click", closeWorkoutModal);

  document
    .getElementById("add-workout-exercise-btn")
    .addEventListener("click", () => addWorkoutExerciseRow());

  document.getElementById("save-workout-btn").addEventListener("click", saveWorkoutLog);
}

let currentWorkoutDate = getTodayDateString();

function openWorkoutModal(dateStr, freeMode = false) {
  currentWorkoutDate = dateStr;
  document.getElementById("workout-modal-date").textContent =
    formatDateHuman(currentWorkoutDate);

  const container = document.getElementById("workout-exercises-container");
  container.innerHTML = "";

  const workouts = loadArray(STORAGE_KEYS.workouts);
  const existing = workouts.find((w) => w.date === currentWorkoutDate);
  const program = loadArray(STORAGE_KEYS.program);
  const dayProgram = program.find((p) => p.date === currentWorkoutDate);

  if (existing && existing.exercises.length > 0) {
    existing.exercises.forEach((ex) => addWorkoutExerciseRow(ex));
  } else if (!freeMode && dayProgram && dayProgram.exercises.length > 0) {
    dayProgram.exercises.forEach((ex) =>
      addWorkoutExerciseRow({
        name: ex.name,
        setsDone: ex.targetSets,
        repsPerSet: ex.targetReps ? `${ex.targetReps}` : "",
        weightUsed: ex.targetWeight,
        notes: "",
      })
    );
  } else {
    addWorkoutExerciseRow();
  }

  document.getElementById("workout-modal").classList.remove("hidden");
}

function closeWorkoutModal() {
  document.getElementById("workout-modal").classList.add("hidden");
}

function addWorkoutExerciseRow(ex) {
  const container = document.getElementById("workout-exercises-container");
  const row = document.createElement("div");
  row.className = "exercise-row";

  const header = document.createElement("div");
  header.className = "exercise-row-header";

  const title = document.createElement("strong");
  title.textContent = ex?.name || "Exercice";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "link-btn";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", () => row.remove());

  header.appendChild(title);
  header.appendChild(deleteBtn);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nom de l'exercice";
  nameInput.value = ex?.name || "";
  nameInput.addEventListener("input", () => {
    title.textContent = nameInput.value || "Exercice";
  });

  const setsInput = document.createElement("input");
  setsInput.type = "number";
  setsInput.placeholder = "Séries effectuées";
  setsInput.value = ex?.setsDone || "";

  const repsInput = document.createElement("input");
  repsInput.type = "text";
  repsInput.placeholder = "Répétitions par série (ex : 10/10/8)";
  repsInput.value = ex?.repsPerSet || "";

  const weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.placeholder = "Poids utilisé (kg)";
  weightInput.step = "0.5";
  weightInput.value = ex?.weightUsed || "";

  const notesInput = document.createElement("textarea");
  notesInput.rows = 2;
  notesInput.placeholder = "Notes (facultatif)";
  notesInput.value = ex?.notes || "";

  row.appendChild(header);
  row.appendChild(nameInput);
  row.appendChild(setsInput);
  row.appendChild(repsInput);
  row.appendChild(weightInput);
  row.appendChild(notesInput);

  container.appendChild(row);
}

function saveWorkoutLog() {
  const rows = document.querySelectorAll("#workout-exercises-container .exercise-row");
  const exercises = [];

  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input, textarea");
    const [nameI, setsI, repsI, weightI, notesI] = inputs;
    const name = nameI.value.trim();
    if (!name) return;
    exercises.push({
      name,
      setsDone: parseInt(setsI.value) || 0,
      repsPerSet: repsI.value.trim(),
      weightUsed: parseFloat(weightI.value) || 0,
      notes: notesI.value.trim(),
    });
  });

  let workouts = loadArray(STORAGE_KEYS.workouts);
  const idx = workouts.findIndex((w) => w.date === currentWorkoutDate);
  const entry = { date: currentWorkoutDate, exercises };

  if (idx >= 0) workouts[idx] = entry;
  else workouts.push(entry);

  saveArray(STORAGE_KEYS.workouts, workouts);
  closeWorkoutModal();
}

/* ---------- Onglet Historique & Stats ---------- */

function initHistoryTab() {
  const today = getTodayDateString();
  document.getElementById("history-start-date").value = today;
  document.getElementById("history-end-date").value = today;

  document
    .getElementById("set-this-week-btn")
    .addEventListener("click", () => setHistoryThisWeek());
  document
    .getElementById("set-this-month-btn")
    .addEventListener("click", () => setHistoryThisMonth());
  document
    .getElementById("apply-history-filter-btn")
    .addEventListener("click", () => applyHistoryFilter());

  applyHistoryFilter(); // première vue
}

function setHistoryThisWeek() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  document.getElementById("history-start-date").value =
    monday.toISOString().slice(0, 10);
  document.getElementById("history-end-date").value =
    sunday.toISOString().slice(0, 10);
}

function setHistoryThisMonth() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  document.getElementById("history-start-date").value =
    first.toISOString().slice(0, 10);
  document.getElementById("history-end-date").value =
    last.toISOString().slice(0, 10);
}

function applyHistoryFilter() {
  const start = document.getElementById("history-start-date").value;
  const end = document.getElementById("history-end-date").value;
  if (!start || !end) return;

  const weights = loadArray(STORAGE_KEYS.weights).filter(
    (w) => w.date >= start && w.date <= end
  );
  const workouts = loadArray(STORAGE_KEYS.workouts).filter(
    (w) => w.date >= start && w.date <= end
  );

  // Résumé
  const summary = document.getElementById("summary-text");
  summary.textContent = `Séances réalisées : ${workouts.length} • Jours avec poids saisi : ${weights.length}`;

  // Liste des séances
  const list = document.getElementById("history-workouts-list");
  list.innerHTML = "";
  workouts
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((w) => {
      const div = document.createElement("div");
      div.className = "history-workout-item";
      const exNames = w.exercises.map((e) => e.name).join(", ");
      div.textContent = `${formatDateHuman(w.date)} : ${exNames || "Aucun détail"}`;
      list.appendChild(div);
    });

  renderWeightChart(weights);
  renderVolumeChart(workouts);
}

function renderWeightChart(weights) {
  const ctx = document.getElementById("weight-chart").getContext("2d");
  if (weightChart) {
    weightChart.destroy();
  }
  if (!weights.length) {
    weightChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] },
    });
    return;
  }

  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const labels = sorted.map((w) => w.date);
  const data = sorted.map((w) => w.weight);

  weightChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Poids (kg)",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        x: { display: true },
        y: { display: true },
      },
    },
  });
}

function estimateVolumeForWorkout(workout) {
  let total = 0;
  workout.exercises.forEach((ex) => {
    const sets = ex.setsDone || 0;
    let repsAvg = 0;
    const numbers = (ex.repsPerSet || "").match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const sum = numbers.map((n) => parseInt(n)).reduce((a, b) => a + b, 0);
      repsAvg = sum / numbers.length;
    }
    const weight = ex.weightUsed || 0;
    total += sets * repsAvg * weight;
  });
  return total;
}

function renderVolumeChart(workouts) {
  const ctx = document.getElementById("volume-chart").getContext("2d");
  if (volumeChart) {
    volumeChart.destroy();
  }
  if (!workouts.length) {
    volumeChart = new Chart(ctx, {
      type: "bar",
      data: { labels: [], datasets: [{ data: [] }] },
    });
    return;
  }

  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1));
  const labels = sorted.map((w) => w.date);
  const data = sorted.map((w) => estimateVolumeForWorkout(w));

  volumeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Volume (séries × reps × kg)",
          data,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
      },
      scales: {
        x: { display: true },
        y: { display: true },
      },
    },
  });
}

/* ---------- Onglet Paramètres ---------- */

function initSettingsTab() {
  const profile = loadObject(STORAGE_KEYS.profile) || {};
  const heightInput = document.getElementById("profile-height");
  const targetWeightInput = document.getElementById("profile-target-weight");
  const info = document.getElementById("profile-info");

  if (profile.height) heightInput.value = profile.height;
  if (profile.targetWeight) targetWeightInput.value = profile.targetWeight;

  document.getElementById("save-profile-btn").addEventListener("click", () => {
    const height = parseInt(heightInput.value) || null;
    const targetWeight = parseFloat(targetWeightInput.value) || null;
    const p = { height, targetWeight };
    saveObject(STORAGE_KEYS.profile, p);
    info.textContent = "Profil enregistré.";
  });

  document.getElementById("export-data-btn").addEventListener("click", () => {
    exportAllData();
  });
}

function exportAllData() {
  const data = {
    weights: loadArray(STORAGE_KEYS.weights),
    meals: loadArray(STORAGE_KEYS.meals),
    program: loadArray(STORAGE_KEYS.program),
    workouts: loadArray(STORAGE_KEYS.workouts),
    profile: loadObject(STORAGE_KEYS.profile),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "suivi-sport-donnees.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}