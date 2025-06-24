// Initialize storage on extension install
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get(['totalWatchTime', 'showMilliseconds']);

    const updates = {};

    if (data.totalWatchTime === undefined) {
      updates.totalWatchTime = 0;
    }
    if (data.showMilliseconds === undefined) {
      updates.showMilliseconds = true;
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
    const data = await chrome.storage.local.get(['totalWatchTime']);
    const newTotal = Math.round((data.totalWatchTime || 0) + seconds);

    await chrome.storage.local.set({
      totalWatchTime: newTotal
    });
  } catch (error) {
    throw new Error('Failed to update watch time: ' + error.message);
  }
}
