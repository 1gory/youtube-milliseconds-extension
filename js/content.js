// Pure utility function — defined outside IIFE for testability
function formatVideoTime(seconds, showMs) {
  if (showMs) {
    // Work in integer milliseconds to avoid floating point issues
    // e.g. 61.123 % 1 = 0.12299... in IEEE 754, so Math.floor gives 122 not 123
    const totalMs = Math.round(seconds * 1000);
    const ms = totalMs % 1000;
    const totalSecs = Math.floor(totalMs / 1000);
    const secs = totalSecs % 60;
    const totalMins = Math.floor(totalSecs / 60);
    const minutes = totalMins % 60;
    const hours = Math.floor(totalMins / 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// YouTube Milliseconds Timer Extension — only runs in browser context
if (typeof document !== 'undefined') {
(function() {
  'use strict';

  let displayUpdateInterval;
  let timeTrackingInterval;
  let currentVideoElement;
  let lastTrackingTime = Date.now();
  let isVideoPlaying = false;
  let showMilliseconds = true;
  let isInitialized = false;
  let initializationInProgress = false;
  let videoAbortController = null;
  let displayModeRetries = 0;
  const MAX_DISPLAY_MODE_RETRIES = 50; // 5 seconds max

  let intervalStartTime = null;
  let intervalEndTime = null;
  let intervalKeyboardSetup = false;
  let showIntervalTimer = true;

  const COPY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
  </svg>`;

  const CHECK_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
  </svg>`;

  // Load settings on startup
  loadSettings();

  async function loadSettings() {
    if (!chrome.runtime?.id) return;
    try {
      const data = await chrome.storage.local.get(['showMilliseconds', 'showIntervalTimer']);
      showMilliseconds = data.showMilliseconds !== false;
      showIntervalTimer = data.showIntervalTimer !== false;
      if (isInitialized) {
        updateDisplayMode();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Listen for storage changes (when settings are updated from popup)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    if (changes.showMilliseconds) {
      showMilliseconds = changes.showMilliseconds.newValue;
      displayModeRetries = 0;
      updateDisplayMode();
    }

    if (changes.showIntervalTimer) {
      showIntervalTimer = changes.showIntervalTimer.newValue;
      if (showIntervalTimer) {
        setupIntervalControls();
      } else {
        teardownIntervalControls();
      }
    }
  });

  let timeElementsObserver = null;

  // Function to update time display
  function updateTimeDisplay() {
    const video = document.querySelector('video');
    if (!video) return;

    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (currentTimeElement && !isNaN(video.currentTime)) {
      const text = formatVideoTime(video.currentTime, showMilliseconds);
      if (currentTimeElement.textContent !== text) {
        currentTimeElement.textContent = text;
      }
    }

    if (durationElement && !isNaN(video.duration)) {
      const text = formatVideoTime(video.duration, showMilliseconds);
      if (durationElement.textContent !== text) {
        durationElement.textContent = text;
      }
    }
  }

  // Watch for YouTube overwriting our time elements and immediately restore our format
  function observeTimeElements(currentTimeElement, durationElement) {
    if (timeElementsObserver) timeElementsObserver.disconnect();

    timeElementsObserver = new MutationObserver(updateTimeDisplay);
    timeElementsObserver.observe(currentTimeElement, { childList: true, characterData: true, subtree: true });
    timeElementsObserver.observe(durationElement,    { childList: true, characterData: true, subtree: true });
  }

  // Function to update display mode immediately
  function updateDisplayMode() {
    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (!currentTimeElement || !durationElement) {
      if (displayModeRetries < MAX_DISPLAY_MODE_RETRIES) {
        displayModeRetries++;
        setTimeout(updateDisplayMode, 100);
      }
      return;
    }
    displayModeRetries = 0;

    // Stop current interval first
    if (displayUpdateInterval) {
      clearInterval(displayUpdateInterval);
      displayUpdateInterval = null;
    }

    if (showMilliseconds) {
      currentTimeElement.classList.add('ytp-time-milliseconds');
      durationElement.classList.add('ytp-time-milliseconds');
      displayUpdateInterval = setInterval(updateTimeDisplay, 10);
      observeTimeElements(currentTimeElement, durationElement);
    } else {
      currentTimeElement.classList.remove('ytp-time-milliseconds');
      durationElement.classList.remove('ytp-time-milliseconds');
      if (timeElementsObserver) {
        timeElementsObserver.disconnect();
        timeElementsObserver = null;
      }
      // Keep a slow interval — we own the textContent, YouTube won't update it reliably on its own
      displayUpdateInterval = setInterval(updateTimeDisplay, 250);
    }
  }

  // Function to update watch time statistics
  function updateWatchTime() {
    if (!isVideoPlaying) return;

    // chrome.runtime.id becomes undefined when the extension context is invalidated
    // (e.g. after a reload in dev mode). Stop all tracking to avoid repeated errors.
    if (!chrome.runtime?.id) {
      stopAllTracking();
      return;
    }

    const now = Date.now();
    const elapsed = (now - lastTrackingTime) / 1000;

    if (elapsed > 0 && elapsed < 10) {
      try {
        chrome.runtime.sendMessage({
          type: 'UPDATE_WATCH_TIME',
          seconds: elapsed
        }).catch(() => {
          // Ignore errors if background script is not ready
        });
      } catch {
        stopAllTracking();
      }
    }

    lastTrackingTime = now;
  }

  // Function to start time tracking
  function startTimeTracking() {
    if (timeTrackingInterval) {
      clearInterval(timeTrackingInterval);
    }
    timeTrackingInterval = setInterval(updateWatchTime, 1000);
  }

  // Function to stop all tracking
  function stopAllTracking() {
    if (displayUpdateInterval) {
      clearInterval(displayUpdateInterval);
      displayUpdateInterval = null;
    }
    if (timeTrackingInterval) {
      clearInterval(timeTrackingInterval);
      timeTrackingInterval = null;
    }
  }

  // Function to handle video events — uses AbortController to prevent duplicate listeners
  function handleVideoEvents(video) {
    if (videoAbortController) {
      videoAbortController.abort();
    }
    videoAbortController = new AbortController();
    const { signal } = videoAbortController;

    video.addEventListener('play', () => {
      isVideoPlaying = true;
      lastTrackingTime = Date.now();
    }, { signal });

    video.addEventListener('pause', () => {
      if (isVideoPlaying) {
        updateWatchTime();
        isVideoPlaying = false;
      }
    }, { signal });

    video.addEventListener('ended', () => {
      if (isVideoPlaying) {
        updateWatchTime();
        isVideoPlaying = false;
      }
    }, { signal });

    video.addEventListener('seeking', () => {
      lastTrackingTime = Date.now();
    }, { signal });
  }

  // Fallback clipboard copy for browsers without navigator.clipboard
  function fallbackCopy(text) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }

  // Update visual markers on the progress bar for interval points A and B
  function updateProgressMarkers() {
    const markerA = document.querySelector('.ytp-interval-marker-a');
    const markerB = document.querySelector('.ytp-interval-marker-b');
    const segment = document.querySelector('.ytp-interval-segment');
    const video = document.querySelector('video');

    if (!markerA || !markerB || !segment || !video || isNaN(video.duration) || video.duration === 0) return;

    if (intervalStartTime !== null) {
      const posA = (intervalStartTime / video.duration) * 100;
      markerA.style.left = `${posA}%`;
      markerA.style.display = '';
    } else {
      markerA.style.display = 'none';
    }

    if (intervalEndTime !== null) {
      const posB = (intervalEndTime / video.duration) * 100;
      markerB.style.left = `${posB}%`;
      markerB.style.display = '';
    } else {
      markerB.style.display = 'none';
    }

    if (intervalStartTime !== null && intervalEndTime !== null) {
      const posA = (intervalStartTime / video.duration) * 100;
      const posB = (intervalEndTime / video.duration) * 100;
      segment.style.left = `${Math.min(posA, posB)}%`;
      segment.style.width = `${Math.abs(posB - posA)}%`;
      segment.style.display = '';
    } else {
      segment.style.display = 'none';
    }
  }

  // Update the floating badge and progress markers to reflect current interval state
  function updateIntervalUI() {
    const badge = document.querySelector('.ytp-interval-badge');
    if (!badge) return;

    const timeA = badge.querySelector('[data-interval="start"]');
    const timeB = badge.querySelector('[data-interval="end"]');
    const timeDelta = badge.querySelector('[data-interval="delta"]');
    const copyBtn = badge.querySelector('.ytp-interval-copy-btn');

    if (intervalStartTime !== null) {
      badge.classList.add('ytp-interval-badge--visible');
      if (timeA) timeA.textContent = formatVideoTime(intervalStartTime, true);
    }

    if (timeB) timeB.textContent = intervalEndTime !== null ? formatVideoTime(intervalEndTime, true) : '—';

    if (intervalStartTime !== null && intervalEndTime !== null) {
      const delta = Math.abs(intervalEndTime - intervalStartTime);
      if (timeDelta) timeDelta.textContent = formatVideoTime(delta, true);
      if (copyBtn) copyBtn.disabled = false;
    } else {
      if (timeDelta) timeDelta.textContent = '—';
      if (copyBtn) copyBtn.disabled = true;
    }

    updateProgressMarkers();
  }

  // Record the current video position as interval start ('start') or end ('end')
  function setIntervalPoint(which) {
    const video = document.querySelector('video');
    if (!video) return;

    if (which === 'start') {
      intervalStartTime = video.currentTime;
    } else {
      intervalEndTime = video.currentTime;
    }
    updateIntervalUI();
  }

  // Clear both interval points and hide the badge and markers
  function resetInterval() {
    intervalStartTime = null;
    intervalEndTime = null;

    const badge = document.querySelector('.ytp-interval-badge');
    if (badge) badge.classList.remove('ytp-interval-badge--visible');

    const markerA = document.querySelector('.ytp-interval-marker-a');
    const markerB = document.querySelector('.ytp-interval-marker-b');
    const segment = document.querySelector('.ytp-interval-segment');
    if (markerA) markerA.style.display = 'none';
    if (markerB) markerB.style.display = 'none';
    if (segment) segment.style.display = 'none';
  }

  // Copy the interval delta (Δ) to clipboard and show brief feedback on the copy button
  function copyIntervalDelta() {
    if (intervalStartTime === null || intervalEndTime === null) return;

    const delta = Math.abs(intervalEndTime - intervalStartTime);
    const deltaText = formatVideoTime(delta, true);

    const badge = document.querySelector('.ytp-interval-badge');
    const copyBtn = badge?.querySelector('.ytp-interval-copy-btn');

    const showCopied = () => {
      if (!copyBtn) return;
      clearTimeout(copyBtn._resetTimeout);
      copyBtn.textContent = '✓';
      copyBtn._resetTimeout = setTimeout(() => {
        copyBtn.textContent = '⎘';
      }, 1500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(deltaText).then(showCopied).catch(() => {
        fallbackCopy(deltaText);
        showCopied();
      });
    } else {
      fallbackCopy(deltaText);
      showCopied();
    }
  }

  // Create and inject the copy-timestamp button after .ytp-time-display
  function setupCopyButton() {
    // Remove stale button from previous page
    document.querySelector('.ytp-copy-time-btn')?.remove();

    const timeDisplay = document.querySelector('.ytp-time-display');
    if (!timeDisplay) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-copy-time-btn';
    btn.title = 'Copy timestamp';
    btn.setAttribute('aria-label', 'Copy current timestamp to clipboard');
    btn.innerHTML = COPY_ICON;

    let resetTimeout;

    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent triggering play/pause

      const video = document.querySelector('video');
      if (!video) return;

      // Always copy with full millisecond precision — that's the point
      const timeText = formatVideoTime(video.currentTime, true);

      const showCopied = () => {
        clearTimeout(resetTimeout);
        btn.innerHTML = CHECK_ICON;
        btn.classList.add('ytp-copy-time-btn--copied');
        resetTimeout = setTimeout(() => {
          btn.innerHTML = COPY_ICON;
          btn.classList.remove('ytp-copy-time-btn--copied');
        }, 1500);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(timeText).then(showCopied).catch(() => {
          fallbackCopy(timeText);
          showCopied();
        });
      } else {
        fallbackCopy(timeText);
        showCopied();
      }
    });

    timeDisplay.insertAdjacentElement('afterend', btn);
  }

  // Remove all interval UI elements and reset state (used when feature is disabled)
  function teardownIntervalControls() {
    resetInterval();
    document.querySelector('.ytp-interval-btn-a')?.remove();
    document.querySelector('.ytp-interval-btn-b')?.remove();
    document.querySelector('.ytp-interval-badge')?.remove();
    document.querySelector('.ytp-interval-marker-a')?.remove();
    document.querySelector('.ytp-interval-marker-b')?.remove();
    document.querySelector('.ytp-interval-segment')?.remove();
  }

  // Register [ and ] keyboard shortcuts for setting interval points A and B
  function setupIntervalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!showIntervalTimer) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;

      if (e.key === '[') {
        e.preventDefault();
        setIntervalPoint('start');
      } else if (e.key === ']') {
        e.preventDefault();
        setIntervalPoint('end');
      }
    });
  }

  // Create and inject interval A/B buttons, the floating badge, and progress bar markers
  function setupIntervalControls() {
    if (!showIntervalTimer) return;

    // Remove stale elements from previous page
    document.querySelector('.ytp-interval-btn-a')?.remove();
    document.querySelector('.ytp-interval-btn-b')?.remove();
    document.querySelector('.ytp-interval-badge')?.remove();
    document.querySelector('.ytp-interval-marker-a')?.remove();
    document.querySelector('.ytp-interval-marker-b')?.remove();
    document.querySelector('.ytp-interval-segment')?.remove();

    // Skip Shorts — same check as setupCopyButton
    if (window.location.pathname.startsWith('/shorts/')) return;

    const copyBtn = document.querySelector('.ytp-copy-time-btn');
    if (!copyBtn) return;

    const btnA = document.createElement('button');
    btnA.className = 'ytp-interval-btn ytp-interval-btn-a';
    btnA.title = 'Set interval start (A)';
    btnA.setAttribute('aria-label', 'Set interval start point A');
    btnA.textContent = 'A';
    btnA.addEventListener('click', (e) => {
      e.stopPropagation();
      setIntervalPoint('start');
    });

    const btnB = document.createElement('button');
    btnB.className = 'ytp-interval-btn ytp-interval-btn-b';
    btnB.title = 'Set interval end (B)';
    btnB.setAttribute('aria-label', 'Set interval end point B');
    btnB.textContent = 'B';
    btnB.addEventListener('click', (e) => {
      e.stopPropagation();
      setIntervalPoint('end');
    });

    // Insert A then B after copyBtn → results in [copy][A][B]
    copyBtn.insertAdjacentElement('afterend', btnB);
    copyBtn.insertAdjacentElement('afterend', btnA);

    // Create floating badge
    const badge = document.createElement('div');
    badge.className = 'ytp-interval-badge';
    badge.innerHTML = `
      <div class="ytp-interval-badge__row">
        <span class="ytp-interval-badge__label">A</span>
        <span class="ytp-interval-badge__time" data-interval="start">—</span>
      </div>
      <div class="ytp-interval-badge__row">
        <span class="ytp-interval-badge__label">B</span>
        <span class="ytp-interval-badge__time" data-interval="end">—</span>
      </div>
      <div class="ytp-interval-badge__row">
        <span class="ytp-interval-badge__label">Δ</span>
        <span class="ytp-interval-badge__time" data-interval="delta">—</span>
        <button class="ytp-interval-copy-btn" title="Copy Δ to clipboard" disabled>⎘</button>
        <button class="ytp-interval-reset-btn" title="Reset interval">×</button>
      </div>
    `;

    badge.querySelector('.ytp-interval-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      copyIntervalDelta();
    });

    badge.querySelector('.ytp-interval-reset-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      resetInterval();
    });

    const videoContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-container');
    if (videoContainer) {
      videoContainer.appendChild(badge);
    }

    // Create progress bar markers and segment
    const progressBar = document.querySelector('.ytp-progress-bar');
    if (progressBar) {
      const segment = document.createElement('div');
      segment.className = 'ytp-interval-segment';
      segment.style.display = 'none';

      const markerA = document.createElement('div');
      markerA.className = 'ytp-interval-marker ytp-interval-marker-a';
      markerA.style.display = 'none';

      const markerB = document.createElement('div');
      markerB.className = 'ytp-interval-marker ytp-interval-marker-b';
      markerB.style.display = 'none';

      progressBar.appendChild(segment);
      progressBar.appendChild(markerA);
      progressBar.appendChild(markerB);
    }
  }

  // Function to initialize the extension
  function initializeExtension() {
    if (initializationInProgress) return;
    initializationInProgress = true;

    const checkForPlayer = setInterval(() => {
      const video = document.querySelector('video');

      if (video) {
        clearInterval(checkForPlayer);
        currentVideoElement = video;
        isInitialized = true;
        initializationInProgress = false;

        handleVideoEvents(video);

        isVideoPlaying = !video.paused;
        lastTrackingTime = Date.now();

        startTimeTracking();

        video.addEventListener('loadedmetadata', updateTimeDisplay);

        // These are no-ops on Shorts (no .ytp-time-current / .ytp-time-display),
        // updateDisplayMode retries internally if elements aren't found yet
        updateDisplayMode();
        setupCopyButton();
        setupIntervalControls();

        if (!intervalKeyboardSetup) {
          setupIntervalKeyboardShortcuts();
          intervalKeyboardSetup = true;
        }

        console.log('YouTube Milliseconds Timer activated');
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkForPlayer);
      initializationInProgress = false;
    }, 10000);
  }

  // Handle YouTube SPA navigation — YouTube fires this event on page transitions
  function handleNavigation() {
    isInitialized = false;
    currentVideoElement = null;
    intervalStartTime = null;
    intervalEndTime = null;
    stopAllTracking();
    setTimeout(initializeExtension, 500);
  }

  window.addEventListener('yt-navigate-finish', handleNavigation);

  // Fallback MutationObserver for edge cases where yt-navigate-finish doesn't fire
  const observer = new MutationObserver((mutations) => {
    if (isInitialized || initializationInProgress) return;

    const hasNewVideo = mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        (node.querySelector?.('video') || node.tagName === 'VIDEO')
      )
    );

    if (hasNewVideo) {
      setTimeout(initializeExtension, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initialize extension on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (isVideoPlaying) {
      updateWatchTime();
    }
    stopAllTracking();
  });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isVideoPlaying) {
      updateWatchTime();
    } else if (!document.hidden && isVideoPlaying) {
      lastTrackingTime = Date.now();
    }
  });

})();
} // end browser-only block

// Export for testing in Node.js environment
if (typeof module !== 'undefined') {
  module.exports = { formatVideoTime };
}
