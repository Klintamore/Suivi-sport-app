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

function addProgramExerciseRow(exercise