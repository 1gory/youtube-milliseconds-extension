// Pure accumulation — no rounding here, only round at display time
function accumulateWatchTime(currentTotal, seconds) {
  return (currentTotal || 0) + seconds;
}

// Returns local date as YYYY-MM-DD string (not UTC, matches user's clock)
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Only run Chrome API setup in browser/extension context
if (typeof chrome !== 'undefined') {

  // Initialize storage on extension install
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      const data = await chrome.storage.local.get(['totalWatchTime', 'showMilliseconds', 'dailyStats']);

      const updates = {};

      if (data.totalWatchTime === undefined) {
        updates.totalWatchTime = 0;
      }
      if (data.showMilliseconds === undefined) {
        updates.showMilliseconds = true;
      }
      if (data.dailyStats === undefined) {
        updates.dailyStats = {};
      }

      if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
      }
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  });

  // Handle messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_WATCH_TIME') {
      updateWatchTime(message.seconds)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('Error updating watch time:', error);
          sendResponse({ success: false });
        });

      return true;
    }
  });

  // Async function to update watch time
  async function updateWatchTime(seconds) {
    try {
      const data = await chrome.storage.local.get(['totalWatchTime', 'dailyStats']);
      const newTotal = accumulateWatchTime(data.totalWatchTime, seconds);

      const dailyStats = data.dailyStats || {};
      const today = getLocalDateString(new Date());
      dailyStats[today] = (dailyStats[today] || 0) + seconds;

      await chrome.storage.local.set({
        totalWatchTime: newTotal,
        dailyStats
      });
    } catch (error) {
      throw new Error('Failed to update watch time: ' + error.message);
    }
  }

} // end browser-only block

// Export for testing in Node.js environment
if (typeof module !== 'undefined') {
  module.exports = { accumulateWatchTime, getLocalDateString };
}
