// Clés de stockage
const STORAGE_KEYS = {
  weights: "ss_weights",
  meals: "ss_meals",
  program: "ss_program",
  workouts: "ss_workouts",
  profile: "ss_profile",
  preferences: "ss_preferences",
  calories: "ss_calories",
  foodsCustom: "ss_foods_custom",
};

let weightChart = null;
let bmiChart = null;
let caloriesChart = null;
let volumeChart = null;

document.addEventListener("DOMContentLoaded", () => {
  initThemeAndPreferences();
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

/* ---------- Thème & préférences ---------- */

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
}

function initThemeAndPreferences() {
  let prefs = loadObject(STORAGE_KEYS.preferences);
  if (!prefs) {
    prefs = { theme: "dark", reminders: true };
    saveObject(STORAGE_KEYS.preferences, prefs);
  }
  applyTheme(prefs.theme || "dark");
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

/* ---------- IMC / poids / calories : helpers ---------- */

function updateTodayWeightInfo(weightVal) {
  const infoEl = document.getElementById("today-weight-info");
  if (!infoEl) return;

  if (!weightVal) {
    infoEl.textContent = "Aucun poids saisi pour aujourd'hui.";
    return;
  }

  const profile = loadObject(STORAGE_KEYS.profile) || {};
  let text = `Dernier poids saisi : ${weightVal} kg`;

  if (profile && profile.height) {
    const h = profile.height / 100;
    if (h > 0) {
      const bmi = weightVal / (h * h);
      text += ` • IMC : ${bmi.toFixed(1)}`;
    }
  }

  infoEl.textContent = text;
}

function updateTodayCaloriesInfo(calVal) {
  const infoEl = document.getElementById("today-calories-info");
  if (!infoEl) return;

  if (!calVal) {
    infoEl.textContent = "Aucune calorie saisie pour aujourd'hui.";
    return;
  }
  infoEl.textContent = `Calories du jour : ${calVal} kcal (estimation)`;
}

/* ---------- Rappels ---------- */

function updateReminderBanner() {
  const banner = document.getElementById("reminder-banner");
  if (!banner) return;

  const prefs = loadObject(STORAGE_KEYS.preferences) || {};
  const remindersOn = prefs.reminders !== false; // par défaut ON
  if (!remindersOn) {
    banner.classList.add("hidden");
    return;
  }

  const today = getTodayDateString();
  const messages = [];

  const weights = loadArray(STORAGE_KEYS.weights);
  const todayWeight = weights.find((w) => w.date === today);
  if (!todayWeight) {
    messages.push("Tu n'as pas encore saisi ton poids aujourd'hui.");
  }

  const program = loadArray(STORAGE_KEYS.program);
  const dayProgram = program.find(
    (p) => p.date === today && p.exercises && p.exercises.length > 0
  );

  const workouts = loadArray(STORAGE_KEYS.workouts);
  const dayWorkout = workouts.find(
    (w) => w.date === today && w.exercises && w.exercises.length > 0
  );

  if (dayProgram && !dayWorkout) {
    messages.push("Tu as une séance prévue aujourd'hui 💪.");
  }

  if (messages.length === 0) {
    banner.classList.add("hidden");
    banner.textContent = "";
  } else {
    banner.classList.remove("hidden");
    banner.textContent = messages.join(" ");
  }
}

/* ---------- Onglet Aujourd'hui ---------- */

// Contexte global pour le calcul des calories + aliments inconnus
let foodCalcContext = null; // { date, texts: {petitDej, dej, diner, snack} }
let pendingUnknownFoods = [];
let currentUnknownFood = null;

function initTodayTab() {
  const today = getTodayDateString();
  const weightInput = document.getElementById("today-weight-input");
  const saveWeightBtn = document.getElementById("save-today-weight-btn");
  const mealsBtns = document.querySelectorAll(".save-meal-btn");
  const autoCalcBtn = document.getElementById("auto-calc-calories-btn");
  const saveCaloriesBtn = document.getElementById("save-today-calories-btn");

  // Poids du jour
  const weights = loadArray(STORAGE_KEYS.weights);
  const todayWeight = weights.find((w) => w.date === today);
  if (todayWeight) {
    weightInput.value = todayWeight.weight;
    updateTodayWeightInfo(todayWeight.weight);
  } else {
    updateTodayWeightInfo(null);
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
    updateTodayWeightInfo(val);
    updateReminderBanner();
  });

  // Alimentation du jour
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

  // Calories du jour
  const caloriesInput = document.getElementById("today-calories-input");
  const caloriesList = loadArray(STORAGE_KEYS.calories);
  const todayCalories = caloriesList.find((c) => c.date === today);
  if (todayCalories) {
    caloriesInput.value = todayCalories.calories;
    updateTodayCaloriesInfo(todayCalories.calories);
  } else {
    updateTodayCaloriesInfo(null);
  }

  autoCalcBtn.addEventListener("click", () => {
    // Préparer le contexte
    foodCalcContext = {
      date: today,
      texts: {
        petitDej: breakfastInput.value || "",
        dej: lunchInput.value || "",
        diner: dinnerInput.value || "",
        snack: snackInput.value || "",
      },
    };

    const { totalCalories, unknownFoods } = estimateCaloriesFromMeals(
      foodCalcContext,
      true
    );

    if (unknownFoods && unknownFoods.length > 0) {
      // On ouvre la modale pour le premier aliment inconnu
      pendingUnknownFoods = unknownFoods;
      currentUnknownFood = null;
      openNextFoodModal();
    } else {
      // Aucun aliment inconnu, on applique directement
      const rounded = Math.round(totalCalories);
      caloriesInput.value = rounded;
      updateTodayCaloriesInfo(rounded);
    }
  });

  saveCaloriesBtn.addEventListener("click", () => {
    const val = parseInt(caloriesInput.value);
    if (isNaN(val)) {
      alert("Merci de saisir un nombre de calories valide (ou utilise le calcul automatique).");
      return;
    }
    let list = loadArray(STORAGE_KEYS.calories);
    const idx = list.findIndex((c) => c.date === today);
    const entry = { date: today, calories: val };
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    saveArray(STORAGE_KEYS.calories, list);
    updateTodayCaloriesInfo(val);
  });

  // Séance du jour : preview & boutons
  updateTodayWorkoutPreview();

  document
    .getElementById("open-today-workout-btn")
    .addEventListener("click", () => openWorkoutModal(today, false));

  document
    .getElementById("create-free-workout-btn")
    .addEventListener("click", () => openWorkoutModal(today, true));

  // Rappels
  updateReminderBanner();

  // Initialiser la modale aliments
  initFoodModal();
}

/* ---------- Moteur calories A+B ---------- */

// Base interne d'aliments (approximation par portion)
const INTERNAL_FOODS = {
  banane: 90,
  bananes: 90,
  pomme: 80,
  pommes: 80,
  clémentine: 35,
  clémentines: 35,
  orange: 80,
  oranges: 80,
  yaourt: 90,
  yaourts: 90,
  fromage_blanc: 100,
  "fromage blanc": 100,
  "flocons d'avoine": 150,
  flocons: 150,
  avoine: 150,
  lait: 120,
  soupe: 120,
  "soupe légumes": 120,
  riz: 180,
  pâtes: 190,
  poulet: 165,
  poisson: 150,
  oeuf: 80,
  oeufs: 80,
  "pain": 80,
  "tranche de pain": 80,
  "beurre": 50,
  "huile": 90,
  "café": 5,
  "café au lait": 60,
  "thé": 5,
  "biscuit": 70,
  biscuits: 70,
};

function buildFoodsDictionary() {
  const custom = loadObject(STORAGE_KEYS.foodsCustom) || {};
  const dict = { ...INTERNAL_FOODS };

  Object.keys(custom).forEach((name) => {
    dict[name.toLowerCase()] = custom[name];
  });

  return dict;
}

function normalizeSegment(text) {
  return text
    .toLowerCase()
    .replace(/[.,;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateCaloriesFromMeals(context, allowUnknownPrompt) {
  const dict = buildFoodsDictionary();
  const unknownFoodsSet = new Set();
  let total = 0;

  const texts = context.texts || {};
  const mealStrings = [
    texts.petitDej || "",
    texts.dej || "",
    texts.diner || "",
    texts.snack || "",
  ];

  mealStrings.forEach((txt) => {
    if (!txt.trim()) return;

    // On découpe par lignes + séparateurs classiques
    const segments = txt
      .split(/\n+/)
      .map((l) => l.split(/[+•\-]/))
      .flat()
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    segments.forEach((segment) => {
      const norm = normalizeSegment(segment);
      if (!norm || norm.length < 3) return;

      const { matchedFood, quantity } = matchFoodInSegment(norm, dict);

      if (matchedFood) {
        const calPerPortion = dict[matchedFood] || 0;
        total += calPerPortion * quantity;
      } else if (allowUnknownPrompt) {
        // Aliment inconnu : on le stocke pour interrogation
        unknownFoodsSet.add(norm);
      }
    });
  });

  const unknownFoods = allowUnknownPrompt
    ? Array.from(unknownFoodsSet).slice(0, 5) // pour éviter une rafale énorme
    : [];

  return { totalCalories: total, unknownFoods };
}

function matchFoodInSegment(normSegment, dict) {
  // Essayer de détecter une quantité au début : "2 bananes", "3x banane", etc.
  let quantity = 1;
  const qtyMatch = normSegment.match(/^(\d+)\s*(x|\*)?\s*(.+)$/);
  let core = normSegment;
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1]) || 1;
    core = qtyMatch[3].trim();
  }

  // Si on voit "1/2", "1 demi", etc. : on peut approximativement mettre 0.5
  const halfMatch = normSegment.match(/1\/2|demi/);
  if (!qtyMatch && halfMatch) {
    quantity = 0.5;
  }

  // On cherche un aliment connu dans le texte
  const keys = Object.keys(dict);
  let bestMatch = null;
  let bestLength = 0;

  keys.forEach((key) => {
    if (normSegment.includes(key)) {
      if (key.length > bestLength) {
        bestMatch = key;
        bestLength = key.length;
      }
    }
  });

  return { matchedFood: bestMatch, quantity };
}

/* ---------- Modale nouvel aliment ---------- */

function initFoodModal() {
  const modal = document.getElementById("food-modal");
  if (!modal) return;

  const cancelBtn = document.getElementById("food-cancel-btn");
  const saveBtn = document.getElementById("food-save-btn");

  cancelBtn.addEventListener("click", () => {
    closeFoodModal();
    // On annule toute la procédure pour cette fois
    pendingUnknownFoods = [];
    currentUnknownFood = null;
    foodCalcContext = null;
  });

  saveBtn.addEventListener("click", () => {
    const input = document.getElementById("food-calories-input");
    const val = parseInt(input.value);
    if (isNaN(val) || val <= 0) {
      alert("Merci de saisir un nombre de calories positif.");
      return;
    }
    if (!currentUnknownFood) {
      closeFoodModal();
      return;
    }

    let foodsCustom = loadObject(STORAGE_KEYS.foodsCustom) || {};
    foodsCustom[currentUnknownFood.toLowerCase()] = val;
    saveObject(STORAGE_KEYS.foodsCustom, foodsCustom);

    // Passer au suivant
    const index = pendingUnknownFoods.indexOf(currentUnknownFood);
    if (index >= 0) {
      pendingUnknownFoods.splice(index, 1);
    }

    currentUnknownFood = null;
    closeFoodModal();

    if (pendingUnknownFoods.length > 0) {
      openNextFoodModal();
    } else if (foodCalcContext) {
      // Recalcul sans redemander les inconnus
      const { totalCalories } = estimateCaloriesFromMeals(foodCalcContext, false);
      const caloriesInput = document.getElementById("today-calories-input");
      const rounded = Math.round(totalCalories);
      caloriesInput.value = rounded;
      updateTodayCaloriesInfo(rounded);

      // Nettoyage du contexte
      foodCalcContext = null;
      pendingUnknownFoods = [];
      currentUnknownFood = null;
    }
  });
}

function openNextFoodModal() {
  if (!pendingUnknownFoods.length) return;

  const modal = document.getElementById("food-modal");
  const question = document.getElementById("food-modal-question");
  const input = document.getElementById("food-calories-input");

  currentUnknownFood = pendingUnknownFoods[0]; // on prend le premier
  question.textContent = `Je ne connais pas encore « ${currentUnknownFood} ». Combien de calories pour 1 portion ?`;
  input.value = "";

  modal.classList.remove("hidden");
}

function closeFoodModal() {
  const modal = document.getElementById("food-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

/* ---------- Séance du jour : aperçu ---------- */

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

  document
    .getElementById("duplicate-week-btn")
    .addEventListener("click", () => duplicateWeek());

  const suggestBtn = document.getElementById("suggest-exercises-btn");
  suggestBtn.addEventListener("click", showExerciseSuggestions);

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
    updateReminderBanner();
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
    updateReminderBanner();
  }
}

function duplicateWeek() {
  const base = new Date(selectedProgramDate + "T00:00:00");
  const dayOfWeek = base.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);

  let program = loadArray(STORAGE_KEYS.program);

  // Vérifier si la semaine suivante contient déjà des données
  let destHas = false;
  for (let i = 0; i < 7; i++) {
    const dest = new Date(monday);
    dest.setDate(monday.getDate() + 7 + i);
    const destIso = dest.toISOString().slice(0, 10);
    if (program.some((p) => p.date === destIso && p.exercises && p.exercises.length > 0)) {
      destHas = true;
      break;
    }
  }

  if (destHas) {
    const ok = confirm(
      "La semaine suivante contient déjà un programme. Veux-tu l'écraser ?"
    );
    if (!ok) return;
  }

  for (let i = 0; i < 7; i++) {
    const srcDate = new Date(monday);
    srcDate.setDate(monday.getDate() + i);
    const srcIso = srcDate.toISOString().slice(0, 10);

    const destDate = new Date(monday);
    destDate.setDate(monday.getDate() + 7 + i);
    const destIso = destDate.toISOString().slice(0, 10);

    const srcProg = program.find((p) => p.date === srcIso);
    if (!srcProg || !srcProg.exercises || srcProg.exercises.length === 0) continue;

    const cloned = {
      date: destIso,
      exercises: srcProg.exercises.map((e) => ({ ...e })),
    };

    const destIdx = program.findIndex((p) => p.date === destIso);
    if (destIdx >= 0) program[destIdx] = cloned;
    else program.push(cloned);
  }

  saveArray(STORAGE_KEYS.program, program);
  buildWeekView();
  alert("Semaine dupliquée vers la suivante.");
}

function showExerciseSuggestions() {
  const msg =
    "Idées d'exercices :\n\n" +
    "Pectoraux : développé couché, développé incliné, écartés haltères.\n" +
    "Dos : tirage vertical, rowing barre, rowing haltères.\n" +
    "Jambes : squat, presse à cuisses, fentes.\n" +
    "Épaules : développé militaire, élévations latérales.\n" +
    "Bras : curl biceps, extension triceps à la poulie.\n" +
    "Abdos : crunch, gainage, relevé de jambes.";
  alert(msg);
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
        restSeconds: 0,
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

  const restInput = document.createElement("input");
  restInput.type = "number";
  restInput.placeholder = "Repos entre séries (sec)";
  restInput.value = ex?.restSeconds || "";

  const notesInput = document.createElement("textarea");
  notesInput.rows = 2;
  notesInput.placeholder = "Notes (facultatif)";
  notesInput.value = ex?.notes || "";

  row.appendChild(header);
  row.appendChild(nameInput);
  row.appendChild(setsInput);
  row.appendChild(repsInput);
  row.appendChild(weightInput);
  row.appendChild(restInput);
  row.appendChild(notesInput);

  container.appendChild(row);
}

function saveWorkoutLog() {
  const rows = document.querySelectorAll("#workout-exercises-container .exercise-row");
  const exercises = [];

  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input, textarea");
    const [nameI, setsI, repsI, weightI, restI, notesI] = inputs;
    const name = nameI.value.trim();
    if (!name) return;
    exercises.push({
      name,
      setsDone: parseInt(setsI.value) || 0,
      repsPerSet: repsI.value.trim(),
      weightUsed: parseFloat(weightI.value) || 0,
      restSeconds: parseInt(restI.value) || 0,
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
  if (currentWorkoutDate === getTodayDateString()) {
    updateReminderBanner();
  }
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
  document
    .getElementById("print-history-btn")
    .addEventListener("click", () => window.print());

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
  const calories = loadArray(STORAGE_KEYS.calories).filter(
    (c) => c.date >= start && c.date <= end
  );

  // Résumé
  const summary = document.getElementById("summary-text");
  summary.textContent = `Séances réalisées : ${workouts.length} • Jours avec poids saisi : ${weights.length} • Jours avec calories saisies : ${calories.length}`;

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
  const profile = loadObject(STORAGE_KEYS.profile) || {};
  renderBmiChart(weights, profile);
  renderCaloriesChart(calories);
  renderVolumeChart(workouts);
  renderRecords(workouts);
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

function renderBmiChart(weights, profile) {
  const ctx = document.getElementById("bmi-chart").getContext("2d");
  if (bmiChart) {
    bmiChart.destroy();
  }
  if (!weights.length || !profile || !profile.height) {
    bmiChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] },
    });
    return;
  }

  const h = profile.height / 100;
  if (!h) {
    bmiChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] },
    });
    return;
  }

  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const labels = sorted.map((w) => w.date);
  const data = sorted.map((w) => +(w.weight / (h * h)).toFixed(1));

  bmiChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "IMC",
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

function renderCaloriesChart(entries) {
  const ctx = document.getElementById("calories-chart").getContext("2d");
  if (caloriesChart) {
    caloriesChart.destroy();
  }
  if (!entries.length) {
    caloriesChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] },
    });
    return;
  }

  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const labels = sorted.map((e) => e.date);
  const data = sorted.map((e) => e.calories);

  caloriesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Calories (kcal)",
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

function renderRecords(workouts) {
  const container = document.getElementById("records-list");
  if (!container) return;
  container.innerHTML = "";

  const records = {};
  workouts.forEach((w) => {
    w.exercises.forEach((e) => {
      if (!e.name) return;
      const weight = e.weightUsed || 0;
      if (weight <= 0) return;
      if (!records[e.name] || weight > records[e.name]) {
        records[e.name] = weight;
      }
    });
  });

  const names = Object.keys(records).sort();
  if (!names.length) {
    container.textContent = "Aucun record pour cette période.";
    return;
  }

  const ul = document.createElement("ul");
  ul.style.paddingLeft = "1.2rem";
  names.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = `${name} : ${records[name]} kg`;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

/* ---------- Onglet Paramètres ---------- */

function initSettingsTab() {
  const profile = loadObject(STORAGE_KEYS.profile) || {};
  const prefs = loadObject(STORAGE_KEYS.preferences) || {
    theme: "dark",
    reminders: true,
  };

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

    // Mettre à jour l'IMC affiché si un poids existe déjà aujourd'hui
    const todayWeightInput = document.getElementById("today-weight-input");
    if (todayWeightInput && todayWeightInput.value) {
      updateTodayWeightInfo(parseFloat(todayWeightInput.value));
    }
  });

  // Thème
  const themeSelect = document.getElementById("theme-select");
  themeSelect.value = prefs.theme || "dark";
  themeSelect.addEventListener("change", () => {
    const newPrefs = loadObject(STORAGE_KEYS.preferences) || {};
    newPrefs.theme = themeSelect.value;
    saveObject(STORAGE_KEYS.preferences, newPrefs);
    applyTheme(newPrefs.theme);
  });

  // Rappels
  const remindersToggle = document.getElementById("reminders-toggle");
  remindersToggle.checked = prefs.reminders !== false;
  remindersToggle.addEventListener("change", () => {
    const newPrefs = loadObject(STORAGE_KEYS.preferences) || {};
    newPrefs.reminders = remindersToggle.checked;
    saveObject(STORAGE_KEYS.preferences, newPrefs);
    updateReminderBanner();
  });

  // Export JSON
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
    preferences: loadObject(STORAGE_KEYS.preferences),
    calories: loadArray(STORAGE_KEYS.calories),
    foodsCustom: loadObject(STORAGE_KEYS.foodsCustom),
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