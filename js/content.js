// Pure utility — parse timestamp string into seconds (Number), or null if invalid.
// Supports: SS.mmm, M:SS, M:SS.mmm, H:MM:SS, H:MM:SS.mmm. Comma is treated as decimal separator.
function parseTimestamp(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(/,/g, '.');
  if (trimmed === '') return null;

  const parts = trimmed.split(':');
  if (parts.length < 1 || parts.length > 3) return null;

  const nums = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '' || !/^\d+(\.\d+)?$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isFinite(n) || n < 0) return null;
    // Non-leading groups must be < 60 (minutes/seconds)
    if (i > 0 && n >= 60) return null;
    nums.push(n);
  }

  let seconds;
  if (nums.length === 1) {
    seconds = nums[0];
  } else if (nums.length === 2) {
    seconds = nums[0] * 60 + nums[1];
  } else {
    seconds = nums[0] * 3600 + nums[1] * 60 + nums[2];
  }

  return seconds;
}

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
  let displayRafId = null;
  let displayLoopMode = null; // 'raf' | 'interval' | null
  let timeTrackingInterval;
  let currentVideoElement;
  let cachedTimeCurrentEl = null;
  let cachedTimeDurationEl = null;
  let isInternalTimeWrite = false;
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
  let showCopyBtn = true;
  let showMsToggleBtn = true;
  let showJumpBtn = true;

  const COPY_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
  </svg>`;

  const CHECK_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
  </svg>`;

  // Clock face with three small digits — used by the milliseconds toggle button
  const MS_TOGGLE_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/>
    <path d="M7.5 4a.5.5 0 0 1 .5.5V8h2.25a.5.5 0 0 1 0 1H7.5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z"/>
    <text x="8" y="14.5" text-anchor="middle" font-size="4" font-family="monospace" font-weight="700">.ms</text>
  </svg>`;

  // Crosshair / target icon — used by the jump-to-timestamp button
  const JUMP_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1a.5.5 0 0 1 .5.5v1.04a5.5 5.5 0 0 1 4.96 4.96H14.5a.5.5 0 0 1 0 1h-1.04a5.5 5.5 0 0 1-4.96 4.96V14.5a.5.5 0 0 1-1 0v-1.04A5.5 5.5 0 0 1 2.54 8.5H1.5a.5.5 0 0 1 0-1h1.04A5.5 5.5 0 0 1 7.5 2.54V1.5A.5.5 0 0 1 8 1zm0 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
  </svg>`;

  // Load settings on startup
  loadSettings();

  async function loadSettings() {
    if (!chrome.runtime?.id) return;
    try {
      const data = await chrome.storage.local.get([
        'showMilliseconds', 'showIntervalTimer',
        'showCopyBtn', 'showMsToggleBtn', 'showJumpBtn',
      ]);
      showMilliseconds = data.showMilliseconds !== false;
      showIntervalTimer = data.showIntervalTimer !== false;
      showCopyBtn = data.showCopyBtn !== false;
      showMsToggleBtn = data.showMsToggleBtn !== false;
      showJumpBtn = data.showJumpBtn !== false;
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
      updateMsToggleButtonState();
    }

    if (changes.showIntervalTimer) {
      showIntervalTimer = changes.showIntervalTimer.newValue;
      if (showIntervalTimer) {
        setupIntervalControls();
      } else {
        teardownIntervalControls();
      }
    }

    if (changes.showCopyBtn) {
      showCopyBtn = changes.showCopyBtn.newValue !== false;
      if (showCopyBtn) {
        setupCopyButton();
        // Other buttons anchor to the copy button — re-create them in correct order
        setupMillisecondsToggleButton();
        setupJumpControl();
        setupIntervalControls();
      } else {
        document.querySelector('.ytp-copy-time-btn')?.remove();
        // Re-anchor dependent buttons to .ytp-time-display
        setupMillisecondsToggleButton();
        setupJumpControl();
        setupIntervalControls();
      }
    }

    if (changes.showMsToggleBtn) {
      showMsToggleBtn = changes.showMsToggleBtn.newValue !== false;
      if (showMsToggleBtn) {
        setupMillisecondsToggleButton();
      } else {
        document.querySelector('.ytp-ms-toggle-btn')?.remove();
      }
    }

    if (changes.showJumpBtn) {
      showJumpBtn = changes.showJumpBtn.newValue !== false;
      if (showJumpBtn) {
        setupJumpControl();
      } else {
        document.querySelector('.ytp-jump-btn')?.remove();
        closeJumpInput();
      }
    }
  });

  let timeElementsObserver = null;

  // Hot-path tick: only updates currentTime. Reads cached refs to avoid 3× querySelector per tick.
  function updateTimeDisplay() {
    const video = currentVideoElement;
    const el = cachedTimeCurrentEl;
    if (!video || !el || isNaN(video.currentTime)) return;

    const text = formatVideoTime(video.currentTime, showMilliseconds);
    if (el.textContent !== text) {
      isInternalTimeWrite = true;
      el.textContent = text;
      isInternalTimeWrite = false;
    }
  }

  // Duration only changes at metadata load — no need to format it on every tick.
  function updateDurationDisplay() {
    const video = currentVideoElement || document.querySelector('video');
    const el = cachedTimeDurationEl;
    if (!video || !el || isNaN(video.duration)) return;

    const text = formatVideoTime(video.duration, showMilliseconds);
    if (el.textContent !== text) {
      isInternalTimeWrite = true;
      el.textContent = text;
      isInternalTimeWrite = false;
    }
  }

  // Watch for YouTube overwriting our time elements and immediately restore our format.
  // We ignore our own writes via the isInternalTimeWrite flag.
  function observeTimeElements(currentTimeElement, durationElement) {
    if (timeElementsObserver) timeElementsObserver.disconnect();

    timeElementsObserver = new MutationObserver(() => {
      if (isInternalTimeWrite) return;
      updateTimeDisplay();
      updateDurationDisplay();
    });
    timeElementsObserver.observe(currentTimeElement, { childList: true, characterData: true, subtree: true });
    timeElementsObserver.observe(durationElement,    { childList: true, characterData: true, subtree: true });
  }

  function stopDisplayLoop() {
    if (displayUpdateInterval) {
      clearInterval(displayUpdateInterval);
      displayUpdateInterval = null;
    }
    if (displayRafId !== null) {
      cancelAnimationFrame(displayRafId);
      displayRafId = null;
    }
    displayLoopMode = null;
  }

  function startRafLoop() {
    if (displayLoopMode === 'raf') return;
    stopDisplayLoop();
    displayLoopMode = 'raf';
    const tick = () => {
      if (displayLoopMode !== 'raf') return;
      updateTimeDisplay();
      displayRafId = requestAnimationFrame(tick);
    };
    displayRafId = requestAnimationFrame(tick);
  }

  function startIntervalLoop(ms) {
    if (displayLoopMode === 'interval') return;
    stopDisplayLoop();
    displayLoopMode = 'interval';
    displayUpdateInterval = setInterval(updateTimeDisplay, ms);
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
    cachedTimeCurrentEl = currentTimeElement;
    cachedTimeDurationEl = durationElement;

    stopDisplayLoop();

    if (showMilliseconds) {
      currentTimeElement.classList.add('ytp-time-milliseconds');
      durationElement.classList.add('ytp-time-milliseconds');
      observeTimeElements(currentTimeElement, durationElement);
      // rAF: tied to display refresh (≈60 Hz, 0 Hz when hidden), instead of a 100 Hz interval.
      startRafLoop();
    } else {
      currentTimeElement.classList.remove('ytp-time-milliseconds');
      durationElement.classList.remove('ytp-time-milliseconds');
      if (timeElementsObserver) {
        timeElementsObserver.disconnect();
        timeElementsObserver = null;
      }
      // No ms — second-level precision is enough; a slow interval avoids unnecessary work.
      startIntervalLoop(250);
    }

    // Render duration once on mode change (was previously redone every tick).
    updateDurationDisplay();
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
    stopDisplayLoop();
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

  // Update visual state of the ms-toggle button to match current showMilliseconds value
  function updateMsToggleButtonState() {
    const btn = document.querySelector('.ytp-ms-toggle-btn');
    if (!btn) return;
    btn.classList.toggle('ytp-ms-toggle-btn--off', !showMilliseconds);
    btn.title = showMilliseconds ? 'Hide milliseconds' : 'Show milliseconds';
    btn.setAttribute('aria-pressed', String(showMilliseconds));
  }

  // Create and inject the milliseconds-toggle button into the player control bar
  function setupMillisecondsToggleButton() {
    document.querySelector('.ytp-ms-toggle-btn')?.remove();

    if (!showMsToggleBtn) return;
    if (window.location.pathname.startsWith('/shorts/')) return;

    const anchor = document.querySelector('.ytp-copy-time-btn') || document.querySelector('.ytp-time-display');
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-ms-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle milliseconds display');
    btn.innerHTML = MS_TOGGLE_ICON;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!chrome.runtime?.id) return;
      try {
        const data = await chrome.storage.local.get(['showMilliseconds']);
        const current = data.showMilliseconds !== false;
        await chrome.storage.local.set({ showMilliseconds: !current });
      } catch (err) {
        console.error('Error toggling milliseconds:', err);
      }
    });

    anchor.insertAdjacentElement('afterend', btn);
    updateMsToggleButtonState();
  }

  // Apply parsed timestamp to the video. Clamps to [0, duration].
  function applyJump(seconds) {
    const video = document.querySelector('video');
    if (!video || !Number.isFinite(video.duration)) return false;
    const clamped = Math.max(0, Math.min(seconds, video.duration));
    video.currentTime = clamped;
    return true;
  }

  function closeJumpInput() {
    const input = document.querySelector('.ytp-jump-input');
    if (input) input.remove();
  }

  function openJumpInput() {
    // Idempotent — close any previous one first
    closeJumpInput();

    if (window.location.pathname.startsWith('/shorts/')) return;

    const videoContainer = document.querySelector('#movie_player') || document.querySelector('.html5-video-container');
    if (!videoContainer) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ytp-jump-input';
    input.setAttribute('aria-label', 'Jump to timestamp');
    input.placeholder = 'H:MM:SS.mmm';
    input.spellcheck = false;
    input.autocomplete = 'off';

    // Pre-fill with the current playback position so the user only edits the digits they care about
    const video = document.querySelector('video');
    if (video && Number.isFinite(video.currentTime)) {
      input.value = formatVideoTime(video.currentTime, true);
    }

    const onKeyDown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const parsed = parseTimestamp(input.value);
        if (parsed === null) {
          input.classList.add('ytp-jump-input--error');
          return;
        }
        if (applyJump(parsed)) closeJumpInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeJumpInput();
      } else {
        // Clear error state on subsequent typing
        input.classList.remove('ytp-jump-input--error');
      }
    };

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('blur', () => {
      // Defer so click handlers on the page still see the input briefly
      setTimeout(closeJumpInput, 0);
    });

    videoContainer.appendChild(input);
    input.focus();
    input.select();
  }

  // Create and inject the jump-to-timestamp button into the player control bar
  function setupJumpControl() {
    document.querySelector('.ytp-jump-btn')?.remove();
    closeJumpInput();

    if (!showJumpBtn) return;
    if (window.location.pathname.startsWith('/shorts/')) return;

    const anchor = document.querySelector('.ytp-copy-time-btn') || document.querySelector('.ytp-time-display');
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-jump-btn';
    btn.title = 'Jump to timestamp (g)';
    btn.setAttribute('aria-label', 'Jump to timestamp');
    btn.innerHTML = JUMP_ICON;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openJumpInput();
    });

    anchor.insertAdjacentElement('afterend', btn);
  }

  let jumpKeyboardSetup = false;
  function setupJumpKeyboardShortcut() {
    if (jumpKeyboardSetup) return;
    jumpKeyboardSetup = true;

    document.addEventListener('keydown', (e) => {
      if (!showJumpBtn) return;
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (window.location.pathname.startsWith('/shorts/')) return;

      e.preventDefault();
      openJumpInput();
    });
  }

  // Create and inject the copy-timestamp button after .ytp-time-display
  function setupCopyButton() {
    // Remove stale button from previous page
    document.querySelector('.ytp-copy-time-btn')?.remove();

    if (!showCopyBtn) return;

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
        // Initialization succeeded — stop watching the entire body. yt-navigate-finish
        // will trigger handleNavigation(), which re-arms this observer if needed.
        if (bodyObserver) bodyObserver.disconnect();

        handleVideoEvents(video);

        isVideoPlaying = !video.paused;
        lastTrackingTime = Date.now();

        startTimeTracking();

        video.addEventListener('loadedmetadata', updateDurationDisplay, { signal: videoAbortController.signal });

        // These are no-ops on Shorts (no .ytp-time-current / .ytp-time-display),
        // updateDisplayMode retries internally if elements aren't found yet
        updateDisplayMode();
        setupCopyButton();
        setupMillisecondsToggleButton();
        setupJumpControl();
        setupIntervalControls();

        if (!intervalKeyboardSetup) {
          setupIntervalKeyboardShortcuts();
          intervalKeyboardSetup = true;
        }
        setupJumpKeyboardShortcut();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkForPlayer);
      initializationInProgress = false;
    }, 10000);
  }

  // Fallback MutationObserver for edge cases where yt-navigate-finish doesn't fire.
  // Active only between navigation and the next successful initialization — never
  // attached during steady-state playback (when YouTube mutates the DOM most heavily).
  const bodyObserver = new MutationObserver((mutations) => {
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

  function armBodyObserver() {
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Handle YouTube SPA navigation — YouTube fires this event on page transitions
  function handleNavigation() {
    isInitialized = false;
    currentVideoElement = null;
    cachedTimeCurrentEl = null;
    cachedTimeDurationEl = null;
    intervalStartTime = null;
    intervalEndTime = null;
    closeJumpInput();
    stopAllTracking();
    // Re-arm the fallback observer until the new page's video shows up
    armBodyObserver();
    setTimeout(initializeExtension, 500);
  }

  window.addEventListener('yt-navigate-finish', handleNavigation);

  // Initial arm — disconnected by initializeExtension() once a video is found
  armBodyObserver();

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
  module.exports = { formatVideoTime, parseTimestamp };
}
