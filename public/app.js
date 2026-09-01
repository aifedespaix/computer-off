// ===================== Constantes =====================
const HOLD_DURATION = 1200; // ms pour confirmer l'extinction immédiate
const RING_R = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const SMALL_RING_R = 30;
const SMALL_RING_CIRCUMFERENCE = 2 * Math.PI * SMALL_RING_R;
const DEFAULT_DURATIONS = [30, 60, 90, 120, 180]; // minutes
const HISTORY_KEY = "pc-control:duration-history";
const TIME_HISTORY_KEY = "pc-control:time-history";
const MAX_CHIPS = 5;

// ===================== Éléments =====================
const clockEl = document.getElementById("clock");

const viewIdle = document.getElementById("view-idle");
const viewActive = document.getElementById("view-active");

const durationChipsEl = document.getElementById("duration-chips");

const timeInput = document.getElementById("time-input");
const timeConfirmBtn = document.getElementById("time-confirm");

const customToggle = document.getElementById("custom-toggle");
const customBlock = document.getElementById("custom-block");
const customMinutesInput = document.getElementById("custom-minutes");
const customConfirmBtn = document.getElementById("custom-confirm");

const countdownTimeEl = document.getElementById("countdown-time");
const countdownTargetEl = document.getElementById("countdown-target");
const progressCircle = document.querySelector(".progress-ring__circle");
const adjustButtons = document.querySelectorAll("[data-adjust]");
const cancelBtn = document.getElementById("cancel-btn");

const nowToggle = document.getElementById("now-toggle");
const nowConfirmRow = document.getElementById("now-confirm-row");
const shutdownBtn = document.getElementById("shutdown-btn");
const smallCircle = document.querySelector(".progress-ring-small__circle");

const feedbackMsg = document.getElementById("feedback-message");

// ===================== État =====================
let scheduleState = { active: false, targetTime: null, originalDurationMs: null };
let countdownInterval = null;

// ===================== Horloge =====================
function tickClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
tickClock();
setInterval(tickClock, 15000);

// ===================== Historique (localStorage) =====================
function readHistory(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeHistory(key, entries) {
    try {
        localStorage.setItem(key, JSON.stringify(entries.slice(0, 30)));
    } catch {
        // localStorage indisponible : on ignore silencieusement
    }
}

function recordDurationUsage(minutes) {
    const history = readHistory(HISTORY_KEY);
    history.unshift({ minutes, ts: Date.now() });
    writeHistory(HISTORY_KEY, history);
}

function recordTimeUsage(hhmm) {
    const history = readHistory(TIME_HISTORY_KEY);
    history.unshift({ hhmm, ts: Date.now() });
    writeHistory(TIME_HISTORY_KEY, history);
}

// Construit la liste des durées suggérées : les plus utilisées récemment
// d'abord, complétées par les valeurs par défaut. Objectif : le choix
// habituel du soir est déjà là, un seul tap suffit la plupart du temps.
function getSuggestedDurations() {
    const history = readHistory(HISTORY_KEY);
    const scoreByMinutes = new Map();

    history.forEach((entry, index) => {
        // Poids décroissant : les usages récents comptent plus que les anciens.
        const weight = Math.max(1, 20 - index);
        scoreByMinutes.set(entry.minutes, (scoreByMinutes.get(entry.minutes) || 0) + weight);
    });

    const ranked = [...scoreByMinutes.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([minutes]) => minutes);

    const merged = [...ranked];
    for (const d of DEFAULT_DURATIONS) {
        if (!merged.includes(d)) merged.push(d);
    }

    return merged.slice(0, MAX_CHIPS);
}

function formatDuration(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function getLastUsedTime() {
    const history = readHistory(TIME_HISTORY_KEY);
    return history.length > 0 ? history[0].hhmm : null;
}

// ===================== Rendu des chips de durée =====================
function renderDurationChips() {
    const durations = getSuggestedDurations();
    durationChipsEl.innerHTML = "";
    durations.forEach((minutes) => {
        const btn = document.createElement("button");
        btn.className = "chip";
        btn.textContent = formatDuration(minutes);
        btn.addEventListener("click", () => scheduleInMinutes(minutes));
        durationChipsEl.appendChild(btn);
    });
}

// Pré-remplit le sélecteur d'heure avec la dernière heure utilisée,
// sinon une heure par défaut raisonnable pour un coucher.
function prefillTimeInput() {
    timeInput.value = getLastUsedTime() || "23:30";
}

// ===================== Vue : idle vs active =====================
function showIdleView() {
    viewActive.classList.add("hidden");
    viewIdle.classList.remove("hidden");
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function showActiveView() {
    viewIdle.classList.add("hidden");
    viewActive.classList.remove("hidden");
}

// ===================== Appels API =====================
async function apiSchedule(targetTime) {
    const res = await fetch("/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTime }),
    });
    if (!res.ok) throw new Error("Échec de la programmation");
    return res.json();
}

async function apiCancelSchedule() {
    const res = await fetch("/schedule", { method: "DELETE" });
    if (!res.ok) throw new Error("Échec de l'annulation");
    return res.json();
}

async function apiGetScheduleStatus() {
    const res = await fetch("/schedule");
    if (!res.ok) throw new Error("Statut indisponible");
    return res.json();
}

// ===================== Programmer une extinction =====================
async function scheduleAt(targetDate, { rememberDuration = null, rememberTime = null } = {}) {
    const targetTime = targetDate.getTime();
    try {
        await apiSchedule(targetTime);
        if (rememberDuration !== null) recordDurationUsage(rememberDuration);
        if (rememberTime !== null) recordTimeUsage(rememberTime);
        applySchedule(targetTime, Date.now());
        showFeedback(`Extinction programmée à ${formatClock(targetTime)}.`);
    } catch (err) {
        showFeedback("Impossible de programmer l'extinction. Serveur injoignable ?", true);
    }
}

function scheduleInMinutes(minutes) {
    const target = new Date(Date.now() + minutes * 60 * 1000);
    scheduleAt(target, { rememberDuration: minutes });
}

function scheduleAtClockTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const target = new Date();
    target.setSeconds(0, 0);
    target.setHours(h, m);
    // Si l'heure est déjà passée aujourd'hui, on programme pour demain.
    if (target.getTime() <= Date.now()) {
        target.setDate(target.getDate() + 1);
    }
    scheduleAt(target, { rememberTime: hhmm });
}

function applySchedule(targetTime, startTime) {
    scheduleState = {
        active: true,
        targetTime,
        originalDurationMs: targetTime - startTime,
    };
    showActiveView();
    renderCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(renderCountdown, 1000);
}

function formatClock(timestamp) {
    return new Date(timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ===================== Rendu du compte à rebours =====================
function renderCountdown() {
    const remainingMs = scheduleState.targetTime - Date.now();

    if (remainingMs <= 0) {
        countdownTimeEl.textContent = "00:00";
        setProgress(1);
        return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    countdownTimeEl.textContent =
        h > 0
            ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
            : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    countdownTargetEl.textContent = `à ${formatClock(scheduleState.targetTime)}`;

    const elapsedRatio = scheduleState.originalDurationMs
        ? 1 - remainingMs / scheduleState.originalDurationMs
        : 0;
    setProgress(Math.min(Math.max(elapsedRatio, 0), 1));
}

function setProgress(ratio) {
    const offset = RING_CIRCUMFERENCE * ratio;
    progressCircle.style.strokeDashoffset = offset;
}

// ===================== Ajustement de la programmation =====================
adjustButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
        if (!scheduleState.active) return;
        const deltaMinutes = Number(btn.dataset.adjust);
        const newTarget = scheduleState.targetTime + deltaMinutes * 60 * 1000;
        if (newTarget <= Date.now()) return; // ignore si ça tomberait dans le passé
        await scheduleAt(new Date(newTarget));
    });
});

// ===================== Annulation =====================
cancelBtn.addEventListener("click", async () => {
    try {
        await apiCancelSchedule();
        scheduleState = { active: false, targetTime: null, originalDurationMs: null };
        showIdleView();
        renderDurationChips();
        prefillTimeInput();
        showFeedback("Programmation annulée.");
    } catch {
        showFeedback("Impossible d'annuler. Serveur injoignable ?", true);
    }
});

// ===================== Heure précise =====================
timeConfirmBtn.addEventListener("click", () => {
    if (!timeInput.value) return;
    scheduleAtClockTime(timeInput.value);
});

// ===================== Durée personnalisée =====================
customToggle.addEventListener("click", () => {
    customBlock.classList.toggle("hidden");
    if (!customBlock.classList.contains("hidden")) {
        customMinutesInput.focus();
    }
});

customConfirmBtn.addEventListener("click", () => {
    const minutes = parseInt(customMinutesInput.value, 10);
    if (!minutes || minutes <= 0) return;
    scheduleInMinutes(minutes);
    customMinutesInput.value = "";
});

// ===================== Extinction immédiate (maintenir pour confirmer) =====================
let holdStart = 0;
let holdTimer = null;
let isHolding = false;
let isSuccess = false;

nowToggle.addEventListener("click", () => {
    nowConfirmRow.classList.toggle("hidden");
});

function setSmallProgress(percent) {
    const offset = SMALL_RING_CIRCUMFERENCE - (percent / 100) * SMALL_RING_CIRCUMFERENCE;
    smallCircle.style.strokeDashoffset = offset;
}

function resetHold() {
    if (isSuccess) return;
    isHolding = false;
    smallCircle.style.transition = "stroke-dashoffset 0.3s ease-out";
    setSmallProgress(0);
    shutdownBtn.classList.remove("holding");
    if (holdTimer) {
        cancelAnimationFrame(holdTimer);
        holdTimer = null;
    }
}

function startHold(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    if (isSuccess) return;
    e.preventDefault();
    isHolding = true;
    holdStart = Date.now();
    shutdownBtn.classList.add("holding");
    smallCircle.style.transition = "none";
    tickHold();
}

function tickHold() {
    if (!isHolding || isSuccess) return;
    const elapsed = Date.now() - holdStart;
    const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
    setSmallProgress(progress);
    if (elapsed >= HOLD_DURATION) {
        triggerImmediateShutdown();
    } else {
        holdTimer = requestAnimationFrame(tickHold);
    }
}

async function triggerImmediateShutdown() {
    isSuccess = true;
    isHolding = false;
    cancelAnimationFrame(holdTimer);
    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    shutdownBtn.classList.remove("holding");
    shutdownBtn.classList.add("success");

    try {
        const res = await fetch("/shutdown", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
            showFeedback("Extinction immédiate en cours...");
        } else {
            throw new Error(data.message || "Erreur inconnue");
        }
    } catch (err) {
        showFeedback("Serveur injoignable ou erreur.", true);
        if (navigator.vibrate) navigator.vibrate(200);
        shutdownBtn.classList.remove("success");
        isSuccess = false;
        resetHold();
    }
}

shutdownBtn.addEventListener("touchstart", startHold, { passive: false });
shutdownBtn.addEventListener("touchend", resetHold);
shutdownBtn.addEventListener("touchcancel", resetHold);
shutdownBtn.addEventListener("mousedown", startHold);
shutdownBtn.addEventListener("mouseup", resetHold);
shutdownBtn.addEventListener("mouseleave", resetHold);
shutdownBtn.addEventListener("contextmenu", (e) => e.preventDefault());

// ===================== Feedback =====================
let feedbackTimeout = null;
function showFeedback(text, isError = false) {
    feedbackMsg.textContent = text;
    feedbackMsg.classList.remove("hidden");
    feedbackMsg.classList.toggle("error-text", isError);
    if (feedbackTimeout) clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => feedbackMsg.classList.add("hidden"), 4000);
}

// ===================== Initialisation =====================
async function init() {
    renderDurationChips();
    prefillTimeInput();
    setProgress(0);

    try {
        const status = await apiGetScheduleStatus();
        if (status.active && status.targetTime) {
            // On ne connaît pas l'heure de départ exacte après un rechargement de page ;
            // on prend l'instant présent comme référence pour l'anneau de progression.
            applySchedule(status.targetTime, Date.now());
        }
    } catch {
        // Le serveur peut être temporairement injoignable au chargement : on reste sur la vue idle.
    }
}

init();
