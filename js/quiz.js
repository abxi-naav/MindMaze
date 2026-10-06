/**
 * MINDMAZE - Core Interactive Quiz Engine with Supabase RPC Server Evaluation
 * TANTRA 2026 | Presented by ENIGMA
 */

const QUIZ_DURATION = 15 * 60; // 15 Minutes default duration in seconds

let currentQuestionIndex = 0;
let quizQuestions = []; // Shuffled questions array
let userAnswers = {}; // Mapping: { questionId: selectedOptionValueText }
let optionShuffleMap = {}; // Mapping: { questionId: [shuffledOptionsArray] }
let timerInterval = null;
let timeRemaining = QUIZ_DURATION;
let startTimeStamp = null;

// Anti-cheat counters
let tabSwitches = 0;
let fullscreenExits = 0;
let isSubmitted = false;

document.addEventListener('DOMContentLoaded', () => {
  initQuiz();
});

async function initQuiz() {
  // 1. Verify Registration
  const participant = getStorage(STORAGE_KEYS.PARTICIPANT);
  if (!participant || !participant.id || !participant.accessToken) {
    window.location.href = 'register.html';
    return;
  }

  // A completed local result is only a navigation convenience; the official
  // score still lives in Supabase. Avoid reopening a completed attempt.
  const attempt = getStorage(STORAGE_KEYS.ATTEMPT);
  if (attempt) {
    window.location.href = 'result.html';
    return;
  }

  // The official quiz session is controlled by Supabase, not by the browser clock.
  const sessionResult = await startQuizSessionSupabase(participant.id, participant.accessToken);
  if (!sessionResult.success || !sessionResult.data || !sessionResult.data.startedAt) {
    showModal({
      title: 'SECURE SESSION ERROR',
      text: sessionResult.error || 'Unable to start the official quiz session. Please return to registration and try again.',
      confirmText: 'BACK TO REGISTRATION',
      onConfirm: () => { window.location.href = 'register.html'; }
    });
    return;
  }

  const serverStartedAt = new Date(sessionResult.data.startedAt).getTime();
  if (!Number.isFinite(serverStartedAt)) {
    showModal({
      title: 'SESSION ERROR',
      text: 'The official quiz start time could not be verified.',
      confirmText: 'BACK TO REGISTRATION',
      onConfirm: () => { window.location.href = 'register.html'; }
    });
    return;
  }

  // 3. Load or Initialize Quiz State
  const savedState = getStorage(STORAGE_KEYS.QUIZ_STATE);

  if (savedState && savedState.questionsOrder && savedState.questionsOrder.length > 0) {
    // Restore state from refresh
    restoreQuizState(savedState, serverStartedAt);
  } else {
    // Brand new quiz session setup
    createNewQuizSession(serverStartedAt);
  }

  // 4. Set up Anti-Cheat & Event Listeners
  setupMonitoring();
  setupRefreshProtection();
  disableCopyPasteContext();

  // 5. Start Timer & Render Initial UI
  startTimer();
  renderQuestion(currentQuestionIndex);
  renderNavigator();
  updateProgress();
}

function createNewQuizSession(serverStartedAt) {
  // Fisher-Yates shuffle questions
  const shuffledQuestions = shuffleArray(MINDMAZE_QUESTIONS);
  quizQuestions = shuffledQuestions;

  // For each question, shuffle option choices and store mapping
  quizQuestions.forEach(q => {
    optionShuffleMap[q.id] = shuffleArray(q.options);
  });

  userAnswers = {};
  currentQuestionIndex = 0;
  timeRemaining = QUIZ_DURATION;
  startTimeStamp = serverStartedAt;
  tabSwitches = 0;
  fullscreenExits = 0;

  saveQuizState();
}

function restoreQuizState(savedState, serverStartedAt) {
  // Reconstruct quizQuestions from saved IDs order
  quizQuestions = savedState.questionsOrder.map(id => {
    return MINDMAZE_QUESTIONS.find(q => q.id === id);
  }).filter(Boolean);

  optionShuffleMap = savedState.optionShuffleMap || {};
  userAnswers = savedState.userAnswers || {};
  currentQuestionIndex = savedState.currentQuestionIndex || 0;
  tabSwitches = savedState.tabSwitches || 0;
  fullscreenExits = savedState.fullscreenExits || 0;

  // Calculate elapsed time from the server-authoritative start timestamp.
  startTimeStamp = serverStartedAt;
  const elapsedSeconds = Math.floor((Date.now() - startTimeStamp) / 1000);
  timeRemaining = Math.max(0, QUIZ_DURATION - elapsedSeconds);

  if (timeRemaining <= 0) {
    autoSubmitQuiz();
  }
}

function saveQuizState() {
  if (isSubmitted) return;
  const state = {
    questionsOrder: quizQuestions.map(q => q.id),
    optionShuffleMap: optionShuffleMap,
    userAnswers: userAnswers,
    currentQuestionIndex: currentQuestionIndex,
    startTimeStamp: startTimeStamp,
    tabSwitches: tabSwitches,
    fullscreenExits: fullscreenExits
  };
  setStorage(STORAGE_KEYS.QUIZ_STATE, state);
  setStorage(STORAGE_KEYS.ANSWERS, userAnswers);
}

/* ==========================================================================
   Timer Module
   ========================================================================== */
function startTimer() {
  updateTimerDisplay();
  
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      autoSubmitQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const clockEl = document.getElementById('timer-clock');
  const timerBoxEl = document.getElementById('timer-box');

  if (clockEl) {
    clockEl.textContent = formatTime(timeRemaining);
  }

  if (timerBoxEl) {
    if (timeRemaining <= 120) { // Less than 2 minutes
      timerBoxEl.classList.add('timer-warning');
    } else {
      timerBoxEl.classList.remove('timer-warning');
    }
  }
}

/* ==========================================================================
   Question Rendering Engine
   ========================================================================== */
function renderQuestion(index) {
  if (index < 0 || index >= quizQuestions.length) return;

  currentQuestionIndex = index;
  const question = quizQuestions[index];
  const shuffledOptions = optionShuffleMap[question.id] || question.options;

  // Update Top Badges
  const counterEl = document.getElementById('question-counter');
  if (counterEl) {
    counterEl.textContent = `QUESTION ${(index + 1).toString().padStart(2, '0')} / ${quizQuestions.length}`;
  }

  const categoryEl = document.getElementById('question-category');
  if (categoryEl) {
    categoryEl.textContent = question.category;
  }

  // Update Question Text
  const questionTextEl = document.getElementById('question-text');
  if (questionTextEl) {
    questionTextEl.innerText = question.question;
  }

  // Render 4 Option Cards (A, B, C, D)
  const optionsGridEl = document.getElementById('options-grid');
  if (optionsGridEl) {
    optionsGridEl.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    shuffledOptions.forEach((optValue, i) => {
      const optionCard = document.createElement('div');
      optionCard.className = 'option-card';
      
      const isSelected = userAnswers[question.id] === optValue;
      if (isSelected) {
        optionCard.classList.add('selected');
      }

      optionCard.setAttribute('role', 'radio');
      optionCard.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      optionCard.setAttribute('tabindex', '0');

      optionCard.innerHTML = `
        <div class="option-badge">${letters[i]}</div>
        <div class="option-content">${escapeHTML(optValue)}</div>
      `;

      optionCard.onclick = () => selectAnswer(question.id, optValue);
      optionCard.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectAnswer(question.id, optValue);
        }
      };

      optionsGridEl.appendChild(optionCard);
    });
  }

  // Update Navigation Buttons
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');

  if (prevBtn) {
    prevBtn.disabled = (index === 0);
  }

  if (nextBtn) {
    if (index === quizQuestions.length - 1) {
      nextBtn.textContent = 'SUBMIT QUIZ';
      nextBtn.classList.remove('btn-outline');
      nextBtn.classList.add('btn-primary');
    } else {
      nextBtn.textContent = 'NEXT →';
      nextBtn.classList.remove('btn-primary');
      nextBtn.classList.add('btn-outline');
    }
  }

  renderNavigator();
  updateProgress();
  saveQuizState();
}

function selectAnswer(questionId, selectedValueText) {
  userAnswers[questionId] = selectedValueText;
  renderQuestion(currentQuestionIndex);
}

function nextQuestion() {
  if (currentQuestionIndex < quizQuestions.length - 1) {
    renderQuestion(currentQuestionIndex + 1);
  } else {
    confirmSubmission();
  }
}

function previousQuestion() {
  if (currentQuestionIndex > 0) {
    renderQuestion(currentQuestionIndex - 1);
  }
}

function goToQuestion(index) {
  renderQuestion(index);
}

/* ==========================================================================
   Navigator Grid & Progress Bar
   ========================================================================== */
function renderNavigator() {
  const navGridEl = document.getElementById('navigator-grid');
  if (!navGridEl) return;

  navGridEl.innerHTML = '';

  quizQuestions.forEach((q, idx) => {
    const navItem = document.createElement('button');
    navItem.type = 'button';
    navItem.className = 'nav-item';

    if (idx === currentQuestionIndex) {
      navItem.classList.add('current');
    } else if (userAnswers[q.id] !== undefined) {
      navItem.classList.add('answered');
    }

    navItem.textContent = (idx + 1).toString().padStart(2, '0');
    navItem.onclick = () => goToQuestion(idx);
    navGridEl.appendChild(navItem);
  });
}

function updateProgress() {
  const answeredCount = Object.keys(userAnswers).length;
  const percentage = Math.round((answeredCount / quizQuestions.length) * 100);

  const fillEl = document.getElementById('progress-bar-fill');
  const textEl = document.getElementById('progress-text');

  if (fillEl) fillEl.style.width = `${percentage}%`;
  if (textEl) textEl.textContent = `${percentage}% COMPLETED (${answeredCount}/${quizQuestions.length})`;
}

/* ==========================================================================
   Anti-Cheat Monitoring & Event Protection
   ========================================================================== */
function setupMonitoring() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      tabSwitches++;
      updateCounterChips();
      showWarningAlert('Warning: Leaving the quiz window has been detected.');
      saveQuizState();
    }
  });

  window.addEventListener('blur', () => {
    tabSwitches++;
    updateCounterChips();
    saveQuizState();
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      fullscreenExits++;
      updateCounterChips();
      showWarningAlert('Warning: Exited fullscreen mode.');
      saveQuizState();
    }
  });

  updateCounterChips();
}

function updateCounterChips() {
  const tabChip = document.getElementById('chip-tab-switches');
  const fsChip = document.getElementById('chip-fs-exits');

  if (tabChip) tabChip.textContent = `TAB SWITCHES: ${tabSwitches}`;
  if (fsChip) fsChip.textContent = `FULLSCREEN EXITS: ${fullscreenExits}`;
}

function showWarningAlert(message) {
  const alertEl = document.getElementById('floating-warning-alert');
  const alertMsgEl = document.getElementById('warning-alert-msg');
  if (alertEl && alertMsgEl) {
    alertMsgEl.textContent = message;
    alertEl.classList.add('visible');

    setTimeout(() => {
      alertEl.classList.remove('visible');
    }, 4000);
  }
}

function toggleFullscreenMode() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Fullscreen API error:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function setupRefreshProtection() {
  window.addEventListener('beforeunload', (e) => {
    if (!isSubmitted) {
      saveQuizState();
      e.preventDefault();
      e.returnValue = 'Your quiz progress is saved, but leaving may submit your attempt.';
      return e.returnValue;
    }
  });
}

function disableCopyPasteContext() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('copy', e => e.preventDefault());
  document.addEventListener('cut', e => e.preventDefault());
  document.addEventListener('paste', e => e.preventDefault());
  document.addEventListener('selectstart', e => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
}

/* ==========================================================================
   Quiz Submission & Supabase RPC Server Evaluation
   ========================================================================== */
function confirmSubmission() {
  const answeredCount = Object.keys(userAnswers).length;
  const unansweredCount = quizQuestions.length - answeredCount;

  let msg = `You have answered ${answeredCount} out of ${quizQuestions.length} questions.`;
  if (unansweredCount > 0) {
    msg += ` You still have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`;
  } else {
    msg += ` Do you want to submit your answers now?`;
  }

  showModal({
    title: 'SUBMIT QUIZ',
    text: msg,
    confirmText: 'SUBMIT NOW',
    cancelText: 'CONTINUE QUIZ',
    onConfirm: submitQuiz
  });
}

function autoSubmitQuiz() {
  showWarningAlert('Time expired! Submitting quiz automatically...');
  setTimeout(() => {
    submitQuiz();
  }, 1000);
}

async function submitQuiz() {
  if (isSubmitted) return;
  isSubmitted = true;

  if (timerInterval) clearInterval(timerInterval);

  const participant = getStorage(STORAGE_KEYS.PARTICIPANT, { id: null, name: 'Anonymous Participant', college: 'Unknown' });
  const timeTakenSeconds = Math.max(1, QUIZ_DURATION - timeRemaining);

  // 1. Submit raw answers to Supabase RPC for secure server-side score calculation
  const supabaseResult = await submitQuizAttemptSupabase(participant.id, participant.accessToken, userAnswers);

  let resultData;

  if (!supabaseResult.success || !supabaseResult.result) {
    // Never calculate an official result locally. A local fallback would make
    // the competition score forgeable. Allow the participant to retry the
    // secure server submission instead.
    isSubmitted = false;
    if (timeRemaining > 0) {
      startTimer();
    }

    showModal({
      title: 'SUBMISSION FAILED',
      text: supabaseResult.error || 'The official server could not verify your submission. Your score has NOT been recorded. Please retry.',
      confirmText: 'RETRY SUBMISSION',
      cancelText: 'KEEP QUIZ OPEN',
      onConfirm: submitQuiz
    });
    return;
  }

  // Official result returned by the secure Supabase Stored Procedure.
  const res = supabaseResult.result;
  resultData = {
    participantName: participant.name,
    participantCollege: participant.college,
    score: res.score,
    totalQuestions: res.totalQuestions,
    correct: res.correct,
    wrong: res.wrong,
    unanswered: res.unanswered,
    percentage: res.accuracy,
    timeTakenSeconds: res.timeTakenSeconds,
    timeTakenFormatted: formatTime(res.timeTakenSeconds),
    tabSwitches: tabSwitches,
    fullscreenExits: fullscreenExits,
    submittedAt: new Date().toISOString()
  };

  // 2. Save Result & Attempt locally
  setStorage(STORAGE_KEYS.RESULT, resultData);
  setStorage(STORAGE_KEYS.ATTEMPT, true);

  // 3. Clear Temporary Quiz State
  removeStorage(STORAGE_KEYS.QUIZ_STATE);

  // 4. Redirect to Result Page
  window.location.href = 'result.html';
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
