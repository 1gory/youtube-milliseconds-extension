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
      const seconds = Number(message.seconds);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        sendResponse({ success: false });
        return false;
      }

      updateWatchTime(seconds)
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('Error updating watch time:', error);
          sendResponse({ success: false });
        });

      return true;
    }
  });

  // Every YouTube tab reports independently, so the read-modify-write below
  // must not interleave — two tabs reporting at the same moment would each read
  // the same total and one write would silently overwrite the other. Chaining
  // onto a single promise serialises all updates within the service worker.
  let writeChain = Promise.resolve();

  function enqueueWrite(task) {
    const result = writeChain.then(task, task);
    writeChain = result.catch(() => {});
    return result;
  }

  function updateWatchTime(seconds) {
    return enqueueWrite(async () => {
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
    });
  }

} // end browser-only block

// Export for testing in Node.js environment
if (typeof module !== 'undefined') {
  module.exports = { accumulateWatchTime, getLocalDateString };
}
