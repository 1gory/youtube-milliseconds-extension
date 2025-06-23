let updateInterval;

// Format time for display
function formatTime(totalSeconds) {
  const years = Math.floor(totalSeconds / (365 * 24 * 3600));
  const days = Math.floor((totalSeconds % (365 * 24 * 3600)) / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

// Update total time display
async function updateTotalTime() {
  try {
    const data = await chrome.storage.local.get(['totalWatchTime']);
    const totalTime = data.totalWatchTime || 0;
    document.getElementById('totalTime').textContent = formatTime(totalTime);
  } catch (error) {
    console.error('Error updating total time:', error);
  }
}

// Load and display statistics
async function loadStats() {
  try {
    const data = await chrome.storage.local.get(['totalWatchTime', 'showMilliseconds']);

    const totalTime = data.totalWatchTime || 0;
    const showMilliseconds = data.showMilliseconds !== false;

    document.getElementById('totalTime').textContent = formatTime(totalTime);
    document.getElementById('showMilliseconds').checked = showMilliseconds;

    // Update total time every second while popup is open
    updateInterval = setInterval(updateTotalTime, 1000);

  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('totalTime').textContent = 'Error loading data';
  }
}

// Handle milliseconds checkbox change
document.getElementById('showMilliseconds').addEventListener('change', async (e) => {
  try {
    const showMilliseconds = e.target.checked;
    // Simply save to storage - content scripts will listen for storage changes
    await chrome.storage.local.set({ showMilliseconds });

  } catch (error) {
    console.error('Error updating milliseconds setting:', error);
  }
});

// Reset statistics
document.getElementById('resetBtn').addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset all statistics?')) {
    try {
      const currentSettings = await chrome.storage.local.get(['showMilliseconds']);
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        totalWatchTime: 0,
        showMilliseconds: currentSettings.showMilliseconds !== false
      });
      location.reload();
    } catch (error) {
      console.error('Error resetting stats:', error);
      alert('Error resetting statistics. Please try again.');
    }
  }
});

// Cleanup when popup closes
window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// Initialize popup
document.addEventListener('DOMContentLoaded', loadStats);
