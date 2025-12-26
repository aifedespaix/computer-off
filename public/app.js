// Constants
const HOLD_DURATION = 1500; // ms to trigger action
const RING_CIRCUMFERENCE = 2 * Math.PI * 90; // r=90 defined in SVG

// Elements
const btn = document.getElementById('shutdown-btn');
const circle = document.querySelector('.progress-ring__circle');
const statusText = document.getElementById('status-text');
const feedbackMsg = document.getElementById('feedback-message');

// State
let holdStart = 0;
let holdTimer = null;
let isHolding = false;
let isSuccess = false;

// Initial Setup
function setProgress(percent) {
    const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
    circle.style.strokeDashoffset = offset;
}

// Reset UI
function reset() {
    if (isSuccess) return; // Don't reset if we already succeeded
    isHolding = false;
    circle.style.transition = 'stroke-dashoffset 0.3s ease-out';
    setProgress(0);
    document.body.classList.remove('holding');
    statusText.textContent = "Maintenir pour éteindre";
    statusText.style.color = "var(--text-secondary)";

    if (holdTimer) {
        cancelAnimationFrame(holdTimer);
        holdTimer = null;
    }
}

// Start Holding
function startHold(e) {
    if (e.type === 'mousedown' && e.button !== 0) return; // Only left click
    if (isSuccess) return;

    e.preventDefault(); // Prevent text selection, etc.
    isHolding = true;
    holdStart = Date.now();
    document.body.classList.add('holding');
    statusText.textContent = "Maintenez...";
    statusText.style.color = "var(--text-primary)";

    // Switch to linear for smooth filling
    circle.style.transition = 'none';

    tick();
}

// Animation Loop
function tick() {
    if (!isHolding || isSuccess) return;

    const elapsed = Date.now() - holdStart;
    const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);

    setProgress(progress);

    if (elapsed >= HOLD_DURATION) {
        triggerAction();
    } else {
        holdTimer = requestAnimationFrame(tick);
    }
}

// Trigger Shutdown
async function triggerAction() {
    isSuccess = true;
    isHolding = false;
    cancelAnimationFrame(holdTimer);

    // Haptic Feedback
    if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]); // Buzz buzz buzz
    }

    // UI Updates
    document.body.classList.remove('holding');
    document.body.classList.add('success');
    statusText.textContent = "Extinction en cours...";
    statusText.style.color = "var(--success-color)";
    setProgress(0);

    // API Call
    try {
        const res = await fetch('/shutdown', { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            feedbackMsg.textContent = "Commande envoyée avec succès.";
            feedbackMsg.classList.remove('hidden');
        } else {
            throw new Error(data.message || 'Erreur inconnue');
        }
    } catch (err) {
        handleError(err);
    }
}

function handleError(err) {
    isSuccess = false;
    document.body.classList.remove('success');
    document.body.classList.add('error');
    statusText.textContent = "Erreur !";
    feedbackMsg.textContent = "Serveur injoignable ou erreur.";
    feedbackMsg.classList.remove('hidden');

    if (navigator.vibrate) navigator.vibrate(200);

    // Reset after a delay
    setTimeout(() => {
        document.body.classList.remove('error');
        feedbackMsg.classList.add('hidden');
        reset();
    }, 3000);
}

// Event Listeners
// Touch
btn.addEventListener('touchstart', startHold, { passive: false });
btn.addEventListener('touchend', reset);
btn.addEventListener('touchcancel', reset);

// Mouse
btn.addEventListener('mousedown', startHold);
btn.addEventListener('mouseup', reset);
btn.addEventListener('mouseleave', reset);

// Prevent context menu on long press
btn.addEventListener('contextmenu', e => e.preventDefault());
