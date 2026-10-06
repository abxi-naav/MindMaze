/**
 * MINDMAZE - Organizer Admin Portal Controller
 * TANTRA 2026 | Presented by ENIGMA
 */

document.addEventListener('DOMContentLoaded', () => {
  initAdminPortal();
});

async function initAdminPortal() {
  const supabaseClient = getSupabaseClient();
  const loginForm = document.getElementById('admin-login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleAdminLogin);
  }

  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const isAdmin = await verifyAdminRole(supabaseClient);
      if (isAdmin) {
        showDashboardView(session.user);
      }
    }
  }
}


async function verifyAdminRole(supabaseClient) {
  try {
    const { data, error } = await supabaseClient.rpc('is_mindmaze_admin');
    if (error) {
      console.error('Admin authorization check failed:', error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('Admin authorization exception:', err);
    return false;
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const errorBox = document.getElementById('admin-login-error');
  errorBox.classList.remove('visible');

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  const supabaseClient = getSupabaseClient();

  if (!supabaseClient) {
    errorBox.textContent = '⚠️ Supabase is not configured yet. Please update js/supabase-config.js with your project URL and key.';
    errorBox.classList.add('visible');
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorBox.textContent = `⚠️ Authentication Failed: ${error.message}`;
      errorBox.classList.add('visible');
      return;
    }

    if (data.session) {
      const isAdmin = await verifyAdminRole(supabaseClient);
      if (!isAdmin) {
        await supabaseClient.auth.signOut();
        errorBox.textContent = '⚠️ This account is authenticated but is not authorized as a MINDMAZE organizer.';
        errorBox.classList.add('visible');
        return;
      }
      showDashboardView(data.session.user);
    }
  } catch (err) {
    errorBox.textContent = `⚠️ Error: ${err.message}`;
    errorBox.classList.add('visible');
  }
}

async function handleAdminLogout() {
  const supabaseClient = getSupabaseClient();
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  document.getElementById('admin-login-card').style.display = 'block';
  document.getElementById('admin-dashboard-view').style.display = 'none';
  document.getElementById('admin-user-info').style.setProperty('display', 'none', 'important');
}

async function showDashboardView(user) {
  document.getElementById('admin-login-card').style.display = 'none';
  document.getElementById('admin-dashboard-view').style.display = 'block';
  
  const userInfoEl = document.getElementById('admin-user-info');
  if (userInfoEl) userInfoEl.style.setProperty('display', 'flex', 'important');

  const emailEl = document.getElementById('admin-email-display');
  if (emailEl) emailEl.textContent = user.email;

  await loadAdminDirectoryData();
}

async function loadAdminDirectoryData() {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return;

  const tableBody = document.getElementById('admin-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading participants and results...</td></tr>';

  try {
    // Query participants and attempts via foreign key join
    const { data: participants, error } = await supabaseClient
      .from('participants')
      .select(`
        id,
        name,
        college,
        phone,
        registered_at,
        attempts (
          id,
          score,
          total_questions,
          accuracy,
          time_taken_seconds,
          submitted_at
        )
      `)
      .order('registered_at', { ascending: false });

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-accent">Error fetching data: ${error.message}</td></tr>`;
      return;
    }

    if (!participants || participants.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No participants registered yet.</td></tr>';
      updateAdminStats(0, 0, 0);
      return;
    }

    // Process & calculate stats
    let totalAttempts = 0;
    let highestScore = 0;

    tableBody.innerHTML = '';

    participants.forEach((p, idx) => {
      const attempt = (p.attempts && p.attempts.length > 0) ? p.attempts[0] : null;

      if (attempt) {
        totalAttempts++;
        if (attempt.score > highestScore) highestScore = attempt.score;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${escapeHTML(p.name)}</strong></td>
        <td>${escapeHTML(p.college)}</td>
        <td><code>${escapeHTML(p.phone)}</code></td>
        <td>${attempt ? `<strong>${attempt.score} / ${attempt.total_questions}</strong> (${attempt.accuracy}%)` : '<span class="text-muted">In Progress</span>'}</td>
        <td>${attempt ? formatTime(attempt.time_taken_seconds) : '-'}</td>
        <td>${attempt ? new Date(attempt.submitted_at).toLocaleString() : new Date(p.registered_at).toLocaleString()}</td>
        <td>
          <button type="button" class="btn-sm-danger" onclick="deleteParticipantEntry('${p.id}', '${escapeHTML(p.name)}')">DELETE 🗑️</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    updateAdminStats(participants.length, totalAttempts, highestScore);

  } catch (err) {
    console.error('Error loading admin directory:', err);
  }
}

function updateAdminStats(totalP, totalA, topScore) {
  const pEl = document.getElementById('adm-total-participants');
  const aEl = document.getElementById('adm-total-attempts');
  const sEl = document.getElementById('adm-highest-score');

  if (pEl) pEl.textContent = totalP;
  if (aEl) aEl.textContent = totalA;
  if (sEl) sEl.textContent = `${topScore}/20`;
}

async function deleteParticipantEntry(participantId, participantName) {
  showModal({
    title: 'DELETE PARTICIPANT ENTRY',
    text: `Are you sure you want to delete participant "${participantName}" and their quiz results? This action cannot be undone.`,
    confirmText: 'DELETE PERMANENTLY',
    cancelText: 'CANCEL',
    onConfirm: async () => {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) return;

      const { error } = await supabaseClient
        .from('participants')
        .delete()
        .eq('id', participantId);

      if (error) {
        showModal({ title: 'ERROR', text: `Failed to delete: ${error.message}` });
      } else {
        await loadAdminDirectoryData();
      }
    }
  });
}

async function confirmResetCompetition() {
  showModal({
    title: '⚠️ RESET ALL COMPETITION DATA',
    text: 'CAUTION: This will delete ALL registered participants, scores, and leaderboard records from the central database. Type RESET to confirm.',
    confirmText: 'CONFIRM FULL RESET',
    cancelText: 'CANCEL',
    onConfirm: async () => {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) return;

      const { error } = await supabaseClient
        .from('participants')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) {
        showModal({ title: 'ERROR', text: `Failed to reset competition: ${error.message}` });
      } else {
        showModal({ title: 'COMPETITION RESET', text: 'All participant records and scores have been cleared successfully.' });
        await loadAdminDirectoryData();
      }
    }
  });
}

async function exportLeaderboardCSV() {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('leaderboard_view')
    .select('*');

  if (error || !data || data.length === 0) {
    showModal({ title: 'EXPORT CSV', text: 'No leaderboard data available to export.' });
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,Rank,Name,College,Score,TotalQuestions,Accuracy,TimeTakenSeconds,SubmittedAt\n';

  data.forEach(row => {
    csvContent += `"${row.rank}","${row.participant_name}","${row.participant_college}","${row.score}","${row.total_questions}","${row.accuracy}","${row.time_taken_seconds}","${row.submitted_at}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `MINDMAZE_TANTRA2026_Leaderboard_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
