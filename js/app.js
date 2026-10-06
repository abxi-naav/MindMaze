/**
 * MINDMAZE - Common Application Logic & Supabase Integration Helpers
 * TANTRA 2026 | Presented by ENIGMA
 */

const STORAGE_KEYS = {
  PARTICIPANT: 'mindmaze_participant',
  QUESTIONS: 'mindmaze_questions',
  ANSWERS: 'mindmaze_answers',
  QUIZ_STATE: 'mindmaze_quiz_state',
  RESULT: 'mindmaze_result',
  LEADERBOARD: 'mindmaze_leaderboard',
  ATTEMPT: 'mindmaze_attempt'
};

// LocalStorage Utilities
function getStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (err) {
    console.error(`Error reading key "${key}" from localStorage:`, err);
    return defaultValue;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Error saving key "${key}" to localStorage:`, err);
    return false;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`Error removing key "${key}" from localStorage:`, err);
  }
}

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Time Formatter (seconds to MM:SS)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Universal Modal Controller
function showModal({ title, text, confirmText = 'OK', cancelText = null, onConfirm, onCancel }) {
  let modalOverlay = document.getElementById('app-modal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'app-modal';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal-box">
        <h2 class="modal-title" id="modal-title"></h2>
        <p class="modal-text" id="modal-text"></p>
        <div class="modal-actions" id="modal-actions"></div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').textContent = text;
  const actionsContainer = document.getElementById('modal-actions');
  actionsContainer.innerHTML = '';

  if (cancelText) {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-outline';
    cancelBtn.textContent = cancelText;
    cancelBtn.onclick = () => {
      closeModal();
      if (onCancel) onCancel();
    };
    actionsContainer.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = confirmText;
  confirmBtn.onclick = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  actionsContainer.appendChild(confirmBtn);

  modalOverlay.classList.add('active');
}

function closeModal() {
  const modalOverlay = document.getElementById('app-modal');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
  }
}

/* ==========================================================================
   Supabase Database Service Helpers
   ========================================================================== */

/**
 * Register a participant through the secure database RPC.
 * No direct public SELECT/INSERT access to the participants table is needed.
 */
async function registerParticipantSupabase(name, college, phone) {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient) {
    return {
      success: false,
      error: 'MINDMAZE is not connected to the competition database yet. Please try again later.'
    };
  }

  try {
    const { data, error } = await supabaseClient.rpc('register_participant', {
      p_name: name,
      p_college: college,
      p_phone: phone
    });

    if (error) {
      console.error('Supabase registration error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Supabase registration exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Start or resume the official server-side quiz clock.
 */
async function startQuizSessionSupabase(participantId, accessToken) {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient || !participantId || !accessToken) {
    return { success: false, error: 'Secure participant session is unavailable.' };
  }

  try {
    const { data, error } = await supabaseClient.rpc('start_quiz_session', {
      p_participant_id: participantId,
      p_access_token: accessToken
    });

    if (error) {
      console.error('Supabase quiz session error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Supabase quiz session exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submit raw answers securely via the server-side RPC.
 * The database calculates both the score and official elapsed time.
 */
async function submitQuizAttemptSupabase(participantId, accessToken, userAnswers) {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient || !participantId || !accessToken) {
    return { success: false, error: 'Secure participant session is unavailable.' };
  }

  try {
    const { data, error } = await supabaseClient.rpc('submit_quiz_attempt', {
      p_participant_id: participantId,
      p_access_token: accessToken,
      p_user_answers: userAnswers
    });

    if (error) {
      console.error('Supabase RPC evaluation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, result: data };
  } catch (err) {
    console.error('Supabase RPC exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch the live shared leaderboard. There is intentionally NO localStorage
 * fallback because the official leaderboard must always come from the server.
 */
async function fetchLeaderboardSupabase() {
  const supabaseClient = getSupabaseClient();

  if (!supabaseClient) {
    return null;
  }

  try {
    const { data, error } = await supabaseClient
      .from('leaderboard_view')
      .select('*')
      .order('rank', { ascending: true });

    if (error) {
      console.error('Leaderboard query error:', error);
      return null;
    }

    return data || [];
  } catch (err) {
    console.error('Leaderboard fetch exception:', err);
    return null;
  }
}

// Global App Init Helper
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    }
  });
});
