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
  bodyComp: "ss_body_comp"
};

let weightChart = null;
let bmiChart = null;
let caloriesChart = null;
let volumeChart = null;

const bodyCharts = {};
let weightFatChart = null;

document.addEventListener("DOMContentLoaded", function () {
  initThemeAndPreferences();
  setupNavigation();
  initTodayTab();
  initBodyCompToday();
  initProgramTab();
  initHistoryTab();
  initSettingsTab();
  initWorkoutModal();
});

/* ---------- Helpers généraux ---------- */

function getTodayDateString() {
  var d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateHuman(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function loadArray(key) {
  var raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function loadObject(key) {
  var raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
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
  var prefs = loadObject(STORAGE_KEYS.preferences);
  if (!prefs) {
    prefs = { theme: "dark", reminders: true };
    saveObject(STORAGE_KEYS.preferences, prefs);
  }
  applyTheme(prefs.theme || "dark");
}

/* ---------- Navigation bas ---------- */

function setupNavigation() {
  var navButtons = document.querySelectorAll(".nav-btn");
  var tabs = document.querySelectorAll(".tab-section");

  navButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab");

      navButtons.forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");

      tabs.forEach(function (tab) {
        tab.classList.toggle("active", tab.id === target);
      });
    });
  });

  var todayLabel = document.getElementById("current-date-label");
  var today = getTodayDateString();
  todayLabel.textContent = formatDateHuman(today);
}

/* ---------- IMC / poids / calories : helpers ---------- */

function updateTodayWeightInfo(weightVal) {
  var infoEl = document.getElementById("today-weight-info");
  if (!infoEl) return;

  if (!weightVal) {
    infoEl.textContent = "Aucun poids saisi pour aujourd'hui.";
    return;
  }

  var profile = loadObject(STORAGE_KEYS.profile) || {};
  var text = "Dernier poids saisi : " + weightVal + " kg";

  if (profile && profile.height) {
    var h = profile.height / 100;
    if (h > 0) {
      var bmi = weightVal / (h * h);
      text += " • IMC : " + bmi.toFixed(1);
    }
  }

  infoEl.textContent = text;
}

function updateTodayCaloriesInfo(calVal) {
  var infoEl = document.getElementById("today-calories-info");
  if (!infoEl) return;

  if (!calVal) {
    infoEl.textContent = "Aucune calorie saisie pour aujourd'hui.";
    return;
  }
  infoEl.textContent = "Calories du jour : " + calVal + " kcal (estimation)";
}

/* ---------- Rappels ---------- */

function updateReminderBanner() {
  var banner = document.getElementById("reminder-banner");
  if (!banner) return;

  var prefs = loadObject(STORAGE_KEYS.preferences) || {};
  var remindersOn = prefs.reminders !== false;
  if (!remindersOn) {
    banner.classList.add("hidden");
    return;
  }

  var today = getTodayDateString();
  var messages = [];

  var weights = loadArray(STORAGE_KEYS.weights);
  var todayWeight = weights.find(function (w) { return w.date === today; });
  if (!todayWeight) {
    messages.push("Tu n'as pas encore saisi ton poids aujourd'hui.");
  }

  var program = loadArray(STORAGE_KEYS.program);
  var dayProgram = program.find(function (p) {
    return p.date === today && p.exercises && p.exercises.length > 0;
  });

  var workouts = loadArray(STORAGE_KEYS.workouts);
  var dayWorkout = workouts.find(function (w) {
    return w.date === today && w.exercises && w.exercises.length > 0;
  });

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

/* ---------- Contexte calories (global) ---------- */

var foodCalcContext = null;
var pendingUnknownFoods = [];
var currentUnknownFood = null;

/* ---------- Onglet Aujourd'hui ---------- */

function initTodayTab() {
  var today = getTodayDateString();
  var weightInput = document.getElementById("today-weight-input");
  var saveWeightBtn = document.getElementById("save-today-weight-btn");
  var mealsBtns = document.querySelectorAll(".save-meal-btn");
  var autoCalcBtn = document.getElementById("auto-calc-calories-btn");
  var saveCaloriesBtn = document.getElementById("save-today-calories-btn");

  // Poids du jour
  var weights = loadArray(STORAGE_KEYS.weights);
  var todayWeight = weights.find(function (w) { return w.date === today; });
  if (todayWeight) {
    weightInput.value = todayWeight.weight;
    updateTodayWeightInfo(todayWeight.weight);
  } else {
    updateTodayWeightInfo(null);
  }

  saveWeightBtn.addEventListener("click", function () {
    var val = parseFloat(weightInput.value);
    if (isNaN(val)) {
      alert("Merci de saisir un poids valide.");
      return;
    }
    var list = loadArray(STORAGE_KEYS.weights);
    var existingIndex = list.findIndex(function (w) { return w.date === today; });
    var entry = { date: today, weight: val };
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
  var meals = loadArray(STORAGE_KEYS.meals);
  var breakfastInput = document.getElementById("meal-breakfast");
  var lunchInput = document.getElementById("meal-lunch");
  var dinnerInput = document.getElementById("meal-dinner");
  var snackInput = document.getElementById("meal-snack");

  function loadMealText(mealType, textarea) {
    var m = meals.find(function (x) {
      return x.date === today && x.mealType === mealType;
    });
    textarea.value = m ? m.text : "";
  }

  loadMealText("petit-dejeuner", breakfastInput);
  loadMealText("dejeuner", lunchInput);
  loadMealText("diner", dinnerInput);
  loadMealText("collation", snackInput);

  mealsBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mealType = btn.getAttribute("data-meal-type");
      var textarea;
      if (mealType === "petit-dejeuner") textarea = breakfastInput;
      else if (mealType === "dejeuner") textarea = lunchInput;
      else if (mealType === "diner") textarea = dinnerInput;
      else textarea = snackInput;

      var text = textarea.value.trim();
      var list = loadArray(STORAGE_KEYS.meals);
      var idx = list.findIndex(function (m) {
        return m.date === today && m.mealType === mealType;
      });
      var entry = { date: today, mealType: mealType, text: text };
      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }
      saveArray(STORAGE_KEYS.meals, list);
    });
  });

  // Calories du jour
  var caloriesInput = document.getElementById("today-calories-input");
  var caloriesList = loadArray(STORAGE_KEYS.calories);
  var todayCalories = caloriesList.find(function (c) { return c.date === today; });
  if (todayCalories) {
    caloriesInput.value = todayCalories.calories;
    updateTodayCaloriesInfo(todayCalories.calories);
  } else {
    updateTodayCaloriesInfo(null);
  }

  autoCalcBtn.addEventListener("click", function () {
    foodCalcContext = {
      date: today,
      texts: {
        petitDej: breakfastInput.value || "",
        dej: lunchInput.value || "",
        diner: dinnerInput.value || "",
        snack: snackInput.value || ""
      }
    };

    var result = estimateCaloriesFromMeals(foodCalcContext, true);
    var totalCalories = result.totalCalories;
    var unknownFoods = result.unknownFoods;

    if (unknownFoods && unknownFoods.length > 0) {
      pendingUnknownFoods = unknownFoods;
      currentUnknownFood = null;
      openNextFoodModal();
    } else {
      var rounded = Math.round(totalCalories);
      caloriesInput.value = rounded;
      updateTodayCaloriesInfo(rounded);
    }
  });

  saveCaloriesBtn.addEventListener("click", function () {
    var val = parseInt(caloriesInput.value, 10);
    if (isNaN(val)) {
      alert("Merci de saisir un nombre de calories valide (ou utilise le calcul automatique).");
      return;
    }
    var list = loadArray(STORAGE_KEYS.calories);
    var idx = list.findIndex(function (c) { return c.date === today; });
    var entry = { date: today, calories: val };
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

  var openTodayWorkoutBtn = document.getElementById("open-today-workout-btn");
  var createFreeWorkoutBtn = document.getElementById("create-free-workout-btn");

  openTodayWorkoutBtn.addEventListener("click", function () {
    openWorkoutModal(today, false);
  });

  createFreeWorkoutBtn.addEventListener("click", function () {
    openWorkoutModal(today, true);
  });

  // Rappels
  updateReminderBanner();

  // Initialiser la modale aliments
  initFoodModal();
}

/* ---------- Moteur calories A+B ---------- */

// Base interne d'aliments (approximation par portion)
var INTERNAL_FOODS = {
  "banane": 90,
  "bananes": 90,
  "pomme": 80,
  "pommes": 80,
  "clémentine": 35,
  "clémentines": 35,
  "orange": 80,
  "oranges": 80,
  "yaourt": 90,
  "yaourts": 90,
  "fromage_blanc": 100,
  "fromage blanc": 100,
  "flocons d'avoine": 150,
  "flocons": 150,
  "avoine": 150,
  "lait": 120,
  "soupe": 120,
  "soupe légumes": 120,
  "riz": 180,
  "pâtes": 190,
  "poulet": 165,
  "poisson": 150,
  "oeuf": 80,
  "oeufs": 80,
  "pain": 80,
  "tranche de pain": 80,
  "beurre": 50,
  "huile": 90,
  "café": 5,
  "café au lait": 60,
  "thé": 5,
  "biscuit": 70,
  "biscuits": 70
};

function buildFoodsDictionary() {
  var custom = loadObject(STORAGE_KEYS.foodsCustom) || {};
  var dict = {};

  // Copier la base interne
  Object.keys(INTERNAL_FOODS).forEach(function (key) {
    dict[key.toLowerCase()] = INTERNAL_FOODS[key];
  });

  // Ajouter les personnalisés
  Object.keys(custom).forEach(function (name) {
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
  var dict = buildFoodsDictionary();
  var unknownFoodsSet = {};
  var total = 0;

  var texts = context.texts || {};
  var mealStrings = [
    texts.petitDej || "",
    texts.dej || "",
    texts.diner || "",
    texts.snack || ""
  ];

  mealStrings.forEach(function (txt) {
    if (!txt.trim()) return;

    var segments = txt
      .split(/\n+/)
      .map(function (l) { return l.split(/[+•\-]/); })
      .reduce(function (acc, arr) { return acc.concat(arr); }, [])
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });

    segments.forEach(function (segment) {
      var norm = normalizeSegment(segment);
      if (!norm || norm.length < 3) return;

      var match = matchFoodInSegment(norm, dict);
      var matchedFood = match.matchedFood;
      var quantity = match.quantity;

      if (matchedFood) {
        var calPerPortion = dict[matchedFood] || 0;
        total += calPerPortion * quantity;
      } else if (allowUnknownPrompt) {
        unknownFoodsSet[norm] = true;
      }
    });
  });

  var unknownFoods = [];
  if (allowUnknownPrompt) {
    Object.keys(unknownFoodsSet).forEach(function (k) {
      unknownFoods.push(k);
    });
    if (unknownFoods.length > 5) {
      unknownFoods = unknownFoods.slice(0, 5);
    }
  }

  return { totalCalories: total, unknownFoods: unknownFoods };
}

function matchFoodInSegment(normSegment, dict) {
  var quantity = 1;
  var qtyMatch = normSegment.match(/^(\d+)\s*(x|\*)?\s*(.+)$/);
  var core = normSegment;

  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10) || 1;
    core = qtyMatch[3].trim();
  } else {
    var halfMatch = normSegment.match(/1\/2|demi/);
    if (halfMatch) {
      quantity = 0.5;
    }
  }

  var keys = Object.keys(dict);
  var bestMatch = null;
  var bestLength = 0;

  keys.forEach(function (key) {
    if (normSegment.indexOf(key) !== -1) {
      if (key.length > bestLength) {
        bestMatch = key;
        bestLength = key.length;
      }
    }
  });

  return { matchedFood: bestMatch, quantity: quantity };
}

/* ---------- Modale nouvel aliment ---------- */

function initFoodModal() {
  var modal = document.getElementById("food-modal");
  if (!modal) return;

  var cancelBtn = document.getElementById("food-cancel-btn");
  var saveBtn = document.getElementById("food-save-btn");

  cancelBtn.addEventListener("click", function () {
    closeFoodModal();
    pendingUnknownFoods = [];
    currentUnknownFood = null;
    foodCalcContext = null;
  });

  saveBtn.addEventListener("click", function () {
    var input = document.getElementById("food-calories-input");
    var val = parseInt(input.value, 10);
    if (isNaN(val) || val <= 0) {
      alert("Merci de saisir un nombre de calories positif.");
      return;
    }
    if (!currentUnknownFood) {
      closeFoodModal();
      return;
    }

    var foodsCustom = loadObject(STORAGE_KEYS.foodsCustom) || {};
    foodsCustom[currentUnknownFood.toLowerCase()] = val;
    saveObject(STORAGE_KEYS.foodsCustom, foodsCustom);

    var index = pendingUnknownFoods.indexOf(currentUnknownFood);
    if (index >= 0) {
      pendingUnknownFoods.splice(index, 1);
    }

    currentUnknownFood = null;
    closeFoodModal();

    if (pendingUnknownFoods.length > 0) {
      openNextFoodModal();
    } else if (foodCalcContext) {
      var result = estimateCaloriesFromMeals(foodCalcContext, false);
      var totalCalories = result.totalCalories;
      var caloriesInput = document.getElementById("today-calories-input");
      var rounded = Math.round(totalCalories);
      caloriesInput.value = rounded;
      updateTodayCaloriesInfo(rounded);

      foodCalcContext = null;
      pendingUnknownFoods = [];
      currentUnknownFood = null;
    }
  });
}

function openNextFoodModal() {
  if (!pendingUnknownFoods.length) return;

  var modal = document.getElementById("food-modal");
  var question = document.getElementById("food-modal-question");
  var input = document.getElementById("food-calories-input");

  currentUnknownFood = pendingUnknownFoods[0];
  question.textContent =
    "Je ne connais pas encore « " +
    currentUnknownFood +
    " ». Combien de calories pour 1 portion ?";
  input.value = "";

  modal.classList.remove("hidden");
}

function closeFoodModal() {
  var modal = document.getElementById("food-modal");
  if (!modal) return;
  modal.classList.add("hidden");
}

/* ---------- Séance du jour : aperçu ---------- */

function updateTodayWorkoutPreview() {
  var today = getTodayDateString();
  var preview = document.getElementById("today-workout-preview");
  var program = loadArray(STORAGE_KEYS.program);
  var dayProgram = program.find(function (p) {
    return p.date === today && p.exercises && p.exercises.length > 0;
  });

  if (!dayProgram) {
    preview.textContent = "Aucune séance programmée aujourd'hui.";
    return;
  }

  var ul = document.createElement("ul");
  ul.style.paddingLeft = "1.2rem";

  dayProgram.exercises.forEach(function (ex) {
    var li = document.createElement("li");
    li.textContent =
      ex.name +
      " – " +
      ex.targetSets +
      " × " +
      ex.targetReps +
      " à " +
      ex.targetWeight +
      " kg";
    ul.appendChild(li);
  });

  preview.innerHTML = "";
  preview.appendChild(ul);
}

/* ---------- Onglet Programme ---------- */

var selectedProgramDate = getTodayDateString();

function initProgramTab() {
  var datePicker = document.getElementById("program-date-picker");
  datePicker.value = selectedProgramDate;
  datePicker.addEventListener("change", function () {
    selectedProgramDate = datePicker.value || getTodayDateString();
    refreshProgramEditor();
    highlightWeekFromSelectedDate();
  });

  document
    .getElementById("add-program-exercise-btn")
    .addEventListener("click", function () {
      addProgramExerciseRow();
    });

  document
    .getElementById("save-program-day-btn")
    .addEventListener("click", function () {
      saveProgramDay();
    });

  document
    .getElementById("duplicate-day-btn")
    .addEventListener("click", function () {
      duplicateProgramDay();
    });

  document
    .getElementById("duplicate-week-btn")
    .addEventListener("click", function () {
      duplicateWeek();
    });

  var suggestBtn = document.getElementById("suggest-exercises-btn");
  suggestBtn.addEventListener("click", function () {
    showExerciseSuggestions();
  });

  buildWeekView();
  refreshProgramEditor();
}

function buildWeekView() {
  var container = document.getElementById("week-days-container");
  container.innerHTML = "";
  var today = new Date(selectedProgramDate + "T00:00:00");
  var dayOfWeek = today.getDay();
  var mondayOffset = (dayOfWeek + 6) % 7;

  var program = loadArray(STORAGE_KEYS.program);

  for (var i = 0; i < 7; i++) {
    var d = new Date(today);
    d.setDate(d.getDate() - mondayOffset + i);
    var iso = d.toISOString().slice(0, 10);

    var pill = document.createElement("button");
    pill.className = "week-day-pill";
    pill.textContent = d
      .toLocaleDateString("fr-FR", { weekday: "short" })
      .replace(".", "");
    pill.title = iso;
    if (iso === selectedProgramDate) {
      pill.classList.add("active");
    }

    var dayProg = program.find(function (p) {
      return p.date === iso && p.exercises && p.exercises.length > 0;
    });
    if (dayProg) {
      pill.textContent += " •";
    }

    (function (isoDate) {
      pill.addEventListener("click", function () {
        selectedProgramDate = isoDate;
        document.getElementById("program-date-picker").value = isoDate;
        refreshProgramEditor();
        highlightWeekFromSelectedDate();
      });
    })(iso);

    container.appendChild(pill);
  }
}

function highlightWeekFromSelectedDate() {
  buildWeekView();
}

function refreshProgramEditor() {
  var title = document.getElementById("program-editor-title");
  title.textContent = "Programme du " + formatDateHuman(selectedProgramDate);

  var container = document.getElementById("program-exercises-container");
  container.innerHTML = "";

  var program = loadArray(STORAGE_KEYS.program);
  var dayProgram = program.find(function (p) {
    return p.date === selectedProgramDate;
  });

  var exercises = dayProgram ? dayProgram.exercises : [];

  exercises.forEach(function (ex) {
    addProgramExerciseRow(ex);
  });
}

function addProgramExerciseRow(exercise) {
  var container = document.getElementById("program-exercises-container");
  var row = document.createElement("div");
  row.className = "exercise-row";

  var header = document.createElement("div");
  header.className = "exercise-row-header";

  var title = document.createElement("strong");
  title.textContent = (exercise && exercise.name) || "Nouvel exercice";

  var deleteBtn = document.createElement("button");
  deleteBtn.className = "link-btn";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", function () {
    row.remove();
  });

  header.appendChild(title);
  header.appendChild(deleteBtn);

  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nom de l'exercice (ex : Développé couché)";
  nameInput.value = (exercise && exercise.name) || "";
  nameInput.addEventListener("input", function () {
    title.textContent = nameInput.value || "Nouvel exercice";
  });

  var setsInput = document.createElement("input");
  setsInput.type = "number";
  setsInput.placeholder = "Séries (ex : 4)";
  setsInput.value = (exercise && exercise.targetSets) || "";

  var repsInput = document.createElement("input");
  repsInput.type = "number";
  repsInput.placeholder = "Répétitions (ex : 10)";
  repsInput.value = (exercise && exercise.targetReps) || "";

  var weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.placeholder = "Poids cible (kg)";
  weightInput.step = "0.5";
  weightInput.value = (exercise && exercise.targetWeight) || "";

  row.appendChild(header);
  row.appendChild(nameInput);
  row.appendChild(setsInput);
  row.appendChild(repsInput);
  row.appendChild(weightInput);

  container.appendChild(row);
}

function saveProgramDay() {
  var rows = document.querySelectorAll("#program-exercises-container .exercise-row");
  var exercises = [];

  rows.forEach(function (row) {
    var inputs = row.querySelectorAll("input");
    var nameI = inputs[0];
    var setsI = inputs[1];
    var repsI = inputs[2];
    var weightI = inputs[3];

    var name = nameI.value.trim();
    if (!name) return;
    exercises.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: name,
      targetSets: parseInt(setsI.value, 10) || 0,
      targetReps: parseInt(repsI.value, 10) || 0,
      targetWeight: parseFloat(weightI.value) || 0
    });
  });

  var program = loadArray(STORAGE_KEYS.program);
  var idx = program.findIndex(function (p) {
    return p.date === selectedProgramDate;
  });
  var entry = { date: selectedProgramDate, exercises: exercises };

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
  var sourceDate = prompt(
    "Dupliquer depuis quel jour ?\nFormat : AAAA-MM-JJ (ex : 2025-12-10)"
  );
  if (!sourceDate) return;
  var program = loadArray(STORAGE_KEYS.program);
  var src = program.find(function (p) {
    return p.date === sourceDate.trim();
  });
  if (!src) {
    alert("Aucun programme trouvé pour cette date.");
    return;
  }
  var clonedExercises = src.exercises.map(function (e) {
    return { ...e };
  });
  var idx = program.findIndex(function (p) {
    return p.date === selectedProgramDate;
  });
  var entry = { date: selectedProgramDate, exercises: clonedExercises };
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
  var base = new Date(selectedProgramDate + "T00:00:00");
  var dayOfWeek = base.getDay();
  var mondayOffset = (dayOfWeek + 6) % 7;
  var monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);

  var program = loadArray(STORAGE_KEYS.program);

  var destHas = false;
  for (var i = 0; i < 7; i++) {
    var dest = new Date(monday);
    dest.setDate(monday.getDate() + 7 + i);
    var destIso = dest.toISOString().slice(0, 10);
    var exists = program.some(function (p) {
      return p.date === destIso && p.exercises && p.exercises.length > 0;
    });
    if (exists) {
      destHas = true;
      break;
    }
  }

  if (destHas) {
    var ok = confirm(
      "La semaine suivante contient déjà un programme. Veux-tu l'écraser ?"
    );
    if (!ok) return;
  }

  for (var j = 0; j < 7; j++) {
    var srcDate = new Date(monday);
    srcDate.setDate(monday.getDate() + j);
    var srcIso = srcDate.toISOString().slice(0, 10);

    var destDate = new Date(monday);
    destDate.setDate(monday.getDate() + 7 + j);
    var destIso2 = destDate.toISOString().slice(0, 10);

    var srcProg = program.find(function (p) {
      return p.date === srcIso && p.exercises && p.exercises.length > 0;
    });
    if (!srcProg) continue;

    var cloned = {
      date: destIso2,
      exercises: srcProg.exercises.map(function (e) {
        return { ...e };
      })
    };

    var destIdx = program.findIndex(function (p) {
      return p.date === destIso2;
    });
    if (destIdx >= 0) program[destIdx] = cloned;
    else program.push(cloned);
  }

  saveArray(STORAGE_KEYS.program, program);
  buildWeekView();
  alert("Semaine dupliquée vers la suivante.");
}

function showExerciseSuggestions() {
  var msg =
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
  var closeBtn = document.getElementById("close-workout-modal-btn");
  closeBtn.addEventListener("click", function () {
    closeWorkoutModal();
  });

  document
    .getElementById("add-workout-exercise-btn")
    .addEventListener("click", function () {
      addWorkoutExerciseRow();
    });

  document.getElementById("save-workout-btn").addEventListener("click", function () {
    saveWorkoutLog();
  });
}

var currentWorkoutDate = getTodayDateString();

function openWorkoutModal(dateStr, freeMode) {
  currentWorkoutDate = dateStr;
  document.getElementById("workout-modal-date").textContent =
    formatDateHuman(currentWorkoutDate);

  var container = document.getElementById("workout-exercises-container");
  container.innerHTML = "";

  var workouts = loadArray(STORAGE_KEYS.workouts);
  var existing = workouts.find(function (w) {
    return w.date === currentWorkoutDate;
  });
  var program = loadArray(STORAGE_KEYS.program);
  var dayProgram = program.find(function (p) {
    return p.date === currentWorkoutDate;
  });

  if (existing && existing.exercises.length > 0) {
    existing.exercises.forEach(function (ex) {
      addWorkoutExerciseRow(ex);
    });
  } else if (!freeMode && dayProgram && dayProgram.exercises.length > 0) {
    dayProgram.exercises.forEach(function (ex) {
      addWorkoutExerciseRow({
        name: ex.name,
        setsDone: ex.targetSets,
        repsPerSet: ex.targetReps ? String(ex.targetReps) : "",
        weightUsed: ex.targetWeight,
        restSeconds: 0,
        notes: ""
      });
    });
  } else {
    addWorkoutExerciseRow();
  }

  document.getElementById("workout-modal").classList.remove("hidden");
}

function closeWorkoutModal() {
  document.getElementById("workout-modal").classList.add("hidden");
}

function addWorkoutExerciseRow(ex) {
  var container = document.getElementById("workout-exercises-container");
  var row = document.createElement("div");
  row.className = "exercise-row";

  var header = document.createElement("div");
  header.className = "exercise-row-header";

  var title = document.createElement("strong");
  title.textContent = (ex && ex.name) || "Exercice";

  var deleteBtn = document.createElement("button");
  deleteBtn.className = "link-btn";
  deleteBtn.textContent = "Supprimer";
  deleteBtn.addEventListener("click", function () {
    row.remove();
  });

  header.appendChild(title);
  header.appendChild(deleteBtn);

  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nom de l'exercice";
  nameInput.value = (ex && ex.name) || "";
  nameInput.addEventListener("input", function () {
    title.textContent = nameInput.value || "Exercice";
  });

  var setsInput = document.createElement("input");
  setsInput.type = "number";
  setsInput.placeholder = "Séries effectuées";
  setsInput.value = (ex && ex.setsDone) || "";

  var repsInput = document.createElement("input");
  repsInput.type = "text";
  repsInput.placeholder = "Répétitions par série (ex : 10/10/8)";
  repsInput.value = (ex && ex.repsPerSet) || "";

  var weightInput = document.createElement("input");
  weightInput.type = "number";
  weightInput.placeholder = "Poids utilisé (kg)";
  weightInput.step = "0.5";
  weightInput.value = (ex && ex.weightUsed) || "";

  var restInput = document.createElement("input");
  restInput.type = "number";
  restInput.placeholder = "Repos entre séries (sec)";
  restInput.value = (ex && ex.restSeconds) || "";

  var notesInput = document.createElement("textarea");
  notesInput.rows = 2;
  notesInput.placeholder = "Notes (facultatif)";
  notesInput.value = (ex && ex.notes) || "";

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
  var rows = document.querySelectorAll("#workout-exercises-container .exercise-row");
  var exercises = [];

  rows.forEach(function (row) {
    var inputs = row.querySelectorAll("input, textarea");
    var nameI = inputs[0];
    var setsI = inputs[1];
    var repsI = inputs[2];
    var weightI = inputs[3];
    var restI = inputs[4];
    var notesI = inputs[5];

    var name = nameI.value.trim();
    if (!name) return;
    exercises.push({
      name: name,
      setsDone: parseInt(setsI.value, 10) || 0,
      repsPerSet: repsI.value.trim(),
      weightUsed: parseFloat(weightI.value) || 0,
      restSeconds: parseInt(restI.value, 10) || 0,
      notes: notesI.value.trim()
    });
  });

  var workouts = loadArray(STORAGE_KEYS.workouts);
  var idx = workouts.findIndex(function (w) {
    return w.date === currentWorkoutDate;
  });
  var entry = { date: currentWorkoutDate, exercises: exercises };

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
  var today = getTodayDateString();
  document.getElementById("history-start-date").value = today;
  document.getElementById("history-end-date").value = today;

  document
    .getElementById("set-this-week-btn")
    .addEventListener("click", function () {
      setHistoryThisWeek();
    });
  document
    .getElementById("set-this-month-btn")
    .addEventListener("click", function () {
      setHistoryThisMonth();
    });
  document
    .getElementById("apply-history-filter-btn")
    .addEventListener("click", function () {
      applyHistoryFilter();
    });
  document
    .getElementById("print-history-btn")
    .addEventListener("click", function () {
      window.print();
    });

  applyHistoryFilter();
}

function setHistoryThisWeek() {
  var today = new Date();
  var dayOfWeek = today.getDay();
  var mondayOffset = (dayOfWeek + 6) % 7;
  var monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  document.getElementById("history-start-date").value =
    monday.toISOString().slice(0, 10);
  document.getElementById("history-end-date").value =
    sunday.toISOString().slice(0, 10);
}

function setHistoryThisMonth() {
  var today = new Date();
  var first = new Date(today.getFullYear(), today.getMonth(), 1);
  var last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  document.getElementById("history-start-date").value =
    first.toISOString().slice(0, 10);
  document.getElementById("history-end-date").value =
    last.toISOString().slice(0, 10);
}

function applyHistoryFilter() {
  var start = document.getElementById("history-start-date").value;
  var end = document.getElementById("history-end-date").value;
  if (!start || !end) return;

  var weights = loadArray(STORAGE_KEYS.weights).filter(function (w) {
    return w.date >= start && w.date <= end;
  });
  var workouts = loadArray(STORAGE_KEYS.workouts).filter(function (w) {
    return w.date >= start && w.date <= end;
  });
  var calories = loadArray(STORAGE_KEYS.calories).filter(function (c) {
    return c.date >= start && c.date <= end;
  });

  var summary = document.getElementById("summary-text");
  summary.textContent =
    "Séances réalisées : " +
    workouts.length +
    " • Jours avec poids saisi : " +
    weights.length +
    " • Jours avec calories saisies : " +
    calories.length;

  var list = document.getElementById("history-workouts-list");
  list.innerHTML = "";
  workouts
    .sort(function (a, b) {
      return a.date < b.date ? -1 : 1;
    })
    .forEach(function (w) {
      var div = document.createElement("div");
      div.className = "history-workout-item";
      var exNames = w.exercises.map(function (e) {
        return e.name;
      }).join(", ");
      div.textContent =
        formatDateHuman(w.date) + " : " + (exNames || "Aucun détail");
      list.appendChild(div);
    });

const body = loadArray(STORAGE_KEYS.bodyComp).filter(b => b.date >= start && b.date <= end);

renderBodyChart(body, "fat-chart", "Masse grasse (%)", "fat");
renderBodyChart(body, "muscle-chart", "Masse musculaire (%)", "muscle");
renderBodyChart(body, "water-chart", "Eau (%)", "water");
renderBodyChart(body, "bone-chart", "Masse osseuse (kg)", "bone");

renderWeightFatChart(weights, body);

  renderWeightChart(weights);
  var profile = loadObject(STORAGE_KEYS.profile) || {};
  renderBmiChart(weights, profile);
  renderCaloriesChart(calories);
  renderVolumeChart(workouts);
  renderRecords(workouts);
}

function renderWeightChart(weights) {
  var ctx = document.getElementById("weight-chart").getContext("2d");
  if (weightChart) {
    weightChart.destroy();
  }
  if (!weights.length) {
    weightChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    });
    return;
  }

  var sorted = weights.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : 1;
  });
  var labels = sorted.map(function (w) { return w.date; });
  var data = sorted.map(function (w) { return w.weight; });

  weightChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Poids (kg)",
          data: data
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}

function renderBmiChart(weights, profile) {
  var ctx = document.getElementById("bmi-chart").getContext("2d");
  if (bmiChart) {
    bmiChart.destroy();
  }
  if (!weights.length || !profile || !profile.height) {
    bmiChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    });
    return;
  }

  var h = profile.height / 100;
  if (!h) {
    bmiChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    });
    return;
  }

  var sorted = weights.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : 1;
  });
  var labels = sorted.map(function (w) { return w.date; });
  var data = sorted.map(function (w) {
    return +(w.weight / (h * h)).toFixed(1);
  });

  bmiChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "IMC",
          data: data
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}

function renderCaloriesChart(entries) {
  var ctx = document.getElementById("calories-chart").getContext("2d");
  if (caloriesChart) {
    caloriesChart.destroy();
  }
  if (!entries.length) {
    caloriesChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] }
    });
    return;
  }

  var sorted = entries.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : 1;
  });
  var labels = sorted.map(function (e) { return e.date; });
  var data = sorted.map(function (e) { return e.calories; });

  caloriesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Calories (kcal)",
          data: data
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}

function estimateVolumeForWorkout(workout) {
  var total = 0;
  workout.exercises.forEach(function (ex) {
    var sets = ex.setsDone || 0;
    var repsAvg = 0;
    var numbers = (ex.repsPerSet || "").match(/\d+/g);
    if (numbers && numbers.length > 0) {
      var sum = numbers
        .map(function (n) { return parseInt(n, 10); })
        .reduce(function (a, b) { return a + b; }, 0);
      repsAvg = sum / numbers.length;
    }
    var weight = ex.weightUsed || 0;
    total += sets * repsAvg * weight;
  });
  return total;
}

function renderVolumeChart(workouts) {
  var ctx = document.getElementById("volume-chart").getContext("2d");
  if (volumeChart) {
    volumeChart.destroy();
  }
  if (!workouts.length) {
    volumeChart = new Chart(ctx, {
      type: "bar",
      data: { labels: [], datasets: [{ data: [] }] }
    });
    return;
  }

  var sorted = workouts.slice().sort(function (a, b) {
    return a.date < b.date ? -1 : 1;
  });
  var labels = sorted.map(function (w) { return w.date; });
  var data = sorted.map(function (w) { return estimateVolumeForWorkout(w); });

  volumeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Volume (séries × reps × kg)",
          data: data
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}

function renderRecords(workouts) {
  var container = document.getElementById("records-list");
  if (!container) return;
  container.innerHTML = "";

  var records = {};
  workouts.forEach(function (w) {
    w.exercises.forEach(function (e) {
      if (!e.name) return;
      var weight = e.weightUsed || 0;
      if (weight <= 0) return;
      if (!records[e.name] || weight > records[e.name]) {
        records[e.name] = weight;
      }
    });
  });

  var names = Object.keys(records).sort();
  if (!names.length) {
    container.textContent = "Aucun record pour cette période.";
    return;
  }

  var ul = document.createElement("ul");
  ul.style.paddingLeft = "1.2rem";
  names.forEach(function (name) {
    var li = document.createElement("li");
    li.textContent = name + " : " + records[name] + " kg";
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

/* ---------- Onglet Paramètres ---------- */

function initSettingsTab() {
  var profile = loadObject(STORAGE_KEYS.profile) || {};
  var prefs = loadObject(STORAGE_KEYS.preferences) || {
    theme: "dark",
    reminders: true
  };

  var heightInput = document.getElementById("profile-height");
  var targetWeightInput = document.getElementById("profile-target-weight");
  var info = document.getElementById("profile-info");

  if (profile.height) heightInput.value = profile.height;
  if (profile.targetWeight) targetWeightInput.value = profile.targetWeight;

  document.getElementById("save-profile-btn").addEventListener("click", function () {
    var height = parseInt(heightInput.value, 10) || null;
    var targetWeight = parseFloat(targetWeightInput.value) || null;
    var p = { height: height, targetWeight: targetWeight };
    saveObject(STORAGE_KEYS.profile, p);
    info.textContent = "Profil enregistré.";

    var todayWeightInput = document.getElementById("today-weight-input");
    if (todayWeightInput && todayWeightInput.value) {
      updateTodayWeightInfo(parseFloat(todayWeightInput.value));
    }
  });

  var themeSelect = document.getElementById("theme-select");
  themeSelect.value = prefs.theme || "dark";
  themeSelect.addEventListener("change", function () {
    var newPrefs = loadObject(STORAGE_KEYS.preferences) || {};
    newPrefs.theme = themeSelect.value;
    saveObject(STORAGE_KEYS.preferences, newPrefs);
    applyTheme(newPrefs.theme);
  });

  var remindersToggle = document.getElementById("reminders-toggle");
  remindersToggle.checked = prefs.reminders !== false;
  remindersToggle.addEventListener("change", function () {
    var newPrefs = loadObject(STORAGE_KEYS.preferences) || {};
    newPrefs.reminders = remindersToggle.checked;
    saveObject(STORAGE_KEYS.preferences, newPrefs);
    updateReminderBanner();
  });

  document.getElementById("export-data-btn").addEventListener("click", function () {
    exportAllData();
  });
}

function exportAllData() {
  var data = {
    weights: loadArray(STORAGE_KEYS.weights),
    meals: loadArray(STORAGE_KEYS.meals),
    program: loadArray(STORAGE_KEYS.program),
    workouts: loadArray(STORAGE_KEYS.workouts),
    profile: loadObject(STORAGE_KEYS.profile),
    preferences: loadObject(STORAGE_KEYS.preferences),
    calories: loadArray(STORAGE_KEYS.calories),
    foodsCustom: loadObject(STORAGE_KEYS.foodsCustom)
  };

  var blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "suivi-sport-donnees.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function initBodyCompToday() {
  const today = getTodayDateString();

  const fatI = document.getElementById("today-fat-input");
  const musI = document.getElementById("today-muscle-input");
  const watI = document.getElementById("today-water-input");
  const bonI = document.getElementById("today-bone-input");
  const info = document.getElementById("today-bodycomp-info");
  const saveBtn = document.getElementById("save-today-bodycomp-btn");

  // Si le HTML n’est pas encore intégré, on sort sans planter l’appli
  if (!fatI || !saveBtn || !info) return;

  // Charger si déjà saisi
  const list = loadArray(STORAGE_KEYS.bodyComp);
  const entry = list.find(e => e.date === today);

  if (entry) {
    if (entry.fat != null) fatI.value = entry.fat;
    if (entry.muscle != null) musI.value = entry.muscle;
    if (entry.water != null) watI.value = entry.water;
    if (entry.bone != null) bonI.value = entry.bone;
    info.textContent = bodyCompSummary(entry);
  } else {
    info.textContent = "Aucune composition saisie pour aujourd'hui.";
  }

  saveBtn.addEventListener("click", () => {
    const fat = parseFloat(fatI.value);
    const muscle = parseFloat(musI.value);
    const water = parseFloat(watI.value);
    const bone = parseFloat(bonI.value);

    const any =
      !Number.isNaN(fat) || !Number.isNaN(muscle) || !Number.isNaN(water) || !Number.isNaN(bone);

    if (!any) {
      alert("Saisis au moins une valeur (graisse, muscle, eau ou os).");
      return;
    }

    // Contrôles simples (évite les fautes de frappe)
    if (!Number.isNaN(fat) && (fat < 0 || fat > 70)) { alert("Graisse (%) incohérente."); return; }
    if (!Number.isNaN(muscle) && (muscle < 0 || muscle > 70)) { alert("Muscle (%) incohérent."); return; }
    if (!Number.isNaN(water) && (water < 0 || water > 80)) { alert("Eau (%) incohérente."); return; }
    if (!Number.isNaN(bone) && (bone < 0 || bone > 10)) { alert("Os (kg) incohérent."); return; }

    const obj = {
      date: today,
      fat: Number.isNaN(fat) ? null : fat,
      muscle: Number.isNaN(muscle) ? null : muscle,
      water: Number.isNaN(water) ? null : water,
      bone: Number.isNaN(bone) ? null : bone
    };

    const arr = loadArray(STORAGE_KEYS.bodyComp);
    const idx = arr.findIndex(e => e.date === today);
    if (idx >= 0) arr[idx] = obj;
    else arr.push(obj);

    saveArray(STORAGE_KEYS.bodyComp, arr);
    info.textContent = bodyCompSummary(obj);
  });
}

function bodyCompSummary(e) {
  const parts = [];
  if (e.fat != null) parts.push(`Graisse : ${e.fat}%`);
  if (e.muscle != null) parts.push(`Muscle : ${e.muscle}%`);
  if (e.water != null) parts.push(`Eau : ${e.water}%`);
  if (e.bone != null) parts.push(`Os : ${e.bone} kg`);
  return parts.length ? parts.join(" • ") : "Aucune composition saisie.";
}