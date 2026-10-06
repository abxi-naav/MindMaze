/**
 * MINDMAZE - Live Central Leaderboard Processor
 * TANTRA 2026 | Presented by ENIGMA
 */

document.addEventListener('DOMContentLoaded', () => {
  renderLeaderboard();
});

async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list-container');
  const statusEl = document.getElementById('leaderboard-status-msg');
  if (!container) return;

  container.innerHTML = '<div class="empty-leaderboard-card"><h3 class="empty-title">LOADING LEADERBOARD...</h3></div>';

  // The official leaderboard is ALWAYS fetched from the central Supabase view.
  // There is intentionally no localStorage fallback because participants must
  // never see a private/browser-only leaderboard that can be manipulated.
  const onlineData = await fetchLeaderboardSupabase();
  if (onlineData === null) {
    if (statusEl) statusEl.textContent = '⚠️ Live leaderboard is temporarily unavailable. Please refresh shortly.';
    container.innerHTML = `
      <div class="empty-leaderboard-card">
        <h3 class="empty-title">LEADERBOARD UNAVAILABLE</h3>
        <p>We could not reach the official competition database. No local or unofficial scores are shown.</p>
        <div class="mt-3">
          <button type="button" class="btn btn-primary" onclick="renderLeaderboard()">RETRY</button>
        </div>
      </div>
    `;
    return;
  }

  if (statusEl) statusEl.textContent = '⚡ Live Central Leaderboard: Synchronized with Supabase Database.';
  const leaderboard = onlineData;

  if (leaderboard.length === 0) {
    container.innerHTML = `
      <div class="empty-leaderboard-card">
        <h3 class="empty-title">NO ENTRIES YET!</h3>
        <p>Be the first participant to enter the maze and claim the top rank on the central leaderboard.</p>
        <div class="mt-3">
          <a href="register.html" class="btn btn-primary">ENTER MINDMAZE NOW</a>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  leaderboard.forEach((item, idx) => {
    const rank = item.rank || (idx + 1);
    const row = document.createElement('div');
    row.className = `leader-row ${rank <= 3 ? `rank-${rank}` : ''}`;

    let rankLabel = `#${rank}`;
    if (rank === 1) rankLabel = '🥇 1';
    else if (rank === 2) rankLabel = '🥈 2';
    else if (rank === 3) rankLabel = '🥉 3';

    const pName = item.participant_name || item.participantName || 'Anonymous';
    const pCollege = item.participant_college || item.participantCollege || 'College Participant';
    const scoreVal = item.score;
    const totalQ = item.total_questions || item.totalQuestions || 20;
    const timeSec = item.time_taken_seconds || item.timeTakenSeconds || 0;
    const timeFmt = item.timeTakenFormatted || formatTime(timeSec);

    row.innerHTML = `
      <div class="rank-badge">${rankLabel}</div>
      <div class="participant-info">
        <span class="participant-name">${escapeHTML(pName)}</span>
        <span class="participant-college">${escapeHTML(pCollege)}</span>
      </div>
      <div class="score-display">${scoreVal} / ${totalQ}</div>
      <div class="time-display">⏱ ${timeFmt}</div>
    `;

    container.appendChild(row);
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
