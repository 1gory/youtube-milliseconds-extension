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

// dailyStats gains one key per active day and nothing ever removed them, while
// the *whole* map is re-serialised on every watch-time write (~every 5 s per
// playing tab). Left alone it grows without bound; two years of history is far
// more than the popup's calendar is ever browsed back through.
const DAILY_STATS_RETENTION_DAYS = 730;

// Upper bound on a single reported batch. The content script already caps each
// sample at 300 s and flushes every 5 s, so anything past an hour is a bug or a
// forged message — clamp rather than drop so real time is never lost.
const MAX_MESSAGE_SECONDS = 3600;

// Pure — returns a map holding only the last `maxDays` days ending at
// `referenceDate`. Returns the input untouched when nothing needs dropping, so
// the common path allocates nothing. Keys are YYYY-MM-DD, so string
// comparison is chronological.
function pruneDailyStats(dailyStats, referenceDate, maxDays) {
  const keys = Object.keys(dailyStats);
  if (keys.length <= maxDays) return dailyStats;

  const cutoffDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - (maxDays - 1)
  );
  const cutoff = getLocalDateString(cutoffDate);

  const pruned = {};
  for (const key of keys) {
    if (key >= cutoff) pruned[key] = dailyStats[key];
  }
  return pruned;
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
      const reported = Number(message.seconds);
      if (!Number.isFinite(reported) || reported <= 0) {
        sendResponse({ success: false });
        return false;
      }
      const seconds = Math.min(reported, MAX_MESSAGE_SECONDS);

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

        const now = new Date();
        const dailyStats = pruneDailyStats(data.dailyStats || {}, now, DAILY_STATS_RETENTION_DAYS);
        const today = getLocalDateString(now);
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
  module.exports = { accumulateWatchTime, getLocalDateString, pruneDailyStats };
}
