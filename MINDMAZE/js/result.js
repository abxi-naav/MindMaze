/**
 * MINDMAZE - Results Page Processor
 * TANTRA 2026 | Presented by ENIGMA
 */

document.addEventListener('DOMContentLoaded', () => {
  initResultsPage();
});

function initResultsPage() {
  const resultData = getStorage(STORAGE_KEYS.RESULT);

  if (!resultData) {
    window.location.href = 'index.html';
    return;
  }

  // 1. Participant Name
  const nameEl = document.getElementById('participant-name-display');
  if (nameEl) {
    nameEl.textContent = resultData.participantName || 'PARTICIPANT';
  }

  // 2. Score & Stats Display
  const scoreValEl = document.getElementById('res-score-val');
  const correctValEl = document.getElementById('res-correct-val');
  const wrongValEl = document.getElementById('res-wrong-val');
  const unansweredValEl = document.getElementById('res-unanswered-val');
  const pctValEl = document.getElementById('res-pct-val');
  const timeValEl = document.getElementById('res-time-val');

  if (scoreValEl) scoreValEl.textContent = resultData.score;
  if (correctValEl) correctValEl.textContent = resultData.correct;
  if (wrongValEl) wrongValEl.textContent = resultData.wrong;
  if (unansweredValEl) unansweredValEl.textContent = resultData.unanswered;
  if (pctValEl) pctValEl.textContent = `${resultData.percentage}%`;
  if (timeValEl) timeValEl.textContent = resultData.timeTakenFormatted || formatTime(resultData.timeTakenSeconds || 0);

  // 3. Animate Score Circle SVG
  const circleProgress = document.getElementById('circle-progress-bar');
  if (circleProgress) {
    const totalLength = 502; // 2 * PI * 80
    const ratio = resultData.score / (resultData.totalQuestions || 20);
    const targetOffset = totalLength * (1 - ratio);
    
    setTimeout(() => {
      circleProgress.style.strokeDashoffset = targetOffset;
    }, 200);
  }

  // 4. Performance Banner Tier
  const perfMsgEl = document.getElementById('performance-message-text');
  if (perfMsgEl) {
    perfMsgEl.textContent = getPerformanceTierMessage(resultData.score);
  }
}

function getPerformanceTierMessage(score) {
  if (score >= 18) {
    return '🔥 Excellent! Your mind was in top gear.';
  } else if (score >= 14) {
    return '⚡ Great performance! You solved most of the maze.';
  } else if (score >= 10) {
    return '💡 Good attempt! Keep sharpening your thinking.';
  } else {
    return '🧩 Keep practicing and come back stronger.';
  }
}

function retakeQuizDemo() {
  showModal({
    title: 'ONE ATTEMPT ONLY',
    text: 'MINDMAZE allows only one official attempt per participant. Your official score cannot be reset from the participant website.',
    confirmText: 'VIEW LEADERBOARD'
  });
}
