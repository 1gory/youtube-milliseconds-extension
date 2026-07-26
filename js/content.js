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

// Pure utility — how many seconds of a sampling window actually count as "watched".
//
// Wall-clock time alone over-counts (machine sleep, stalled buffering) and media
// progress alone over-counts (forward seeks), so each bounds the other:
//   • elapsed 60 s / media 60 s  (background tab, throttled timer) → 60
//   • elapsed 3600 s / media 0 s (laptop asleep)                   → 0
//   • elapsed 1 s / media 600 s  (seek forward 10 min)             → 1
// Media progress is divided by playbackRate so 2× playback still counts real seconds.
function computeWatchedSeconds(elapsedSeconds, mediaDeltaSeconds, playbackRate, maxSample) {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(mediaDeltaSeconds)) return 0;
  const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const played = Math.max(0, mediaDeltaSeconds) / rate;
  const counted = Math.min(elapsedSeconds, played);
  if (!(counted > 0)) return 0;
  return Math.min(counted, maxSample);
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

  // ---------------------------------------------------------------- constants
  const MAX_DISPLAY_MODE_RETRIES = 50;   // × 100 ms = 5 s max wait for player DOM
  const PLAYER_POLL_MS = 100;
  const PLAYER_POLL_TIMEOUT_MS = 10000;
  const NO_MS_TICK_MS = 250;             // second-level precision needs no rAF
  const WATCH_FLUSH_MS = 5000;           // batch watch-time IPC instead of 1 msg/s
  const MAX_TICK_SECONDS = 300;          // hard ceiling on a single accepted sample
  const NAV_POLL_MS = 1000;              // fallback SPA-navigation detection

  // ------------------------------------------------------------ display state
  let displayUpdateInterval = null;
  let displayRafId = null;
  let displayLoopMode = null;            // 'raf' | 'interval' | null
  let displayModeTimeout = null;
  let displayModeRetries = 0;

  // --------------------------------------------------------------- init state
  let playerCheckInterval = null;
  let playerCheckTimeout = null;
  let initRetryTimeout = null;
  let isInitialized = false;
  let initializationInProgress = false;
  let navEpoch = 0;                      // invalidates async work from a previous page
  let lastHref = location.href;

  // ------------------------------------------------------------ cached lookups
  let currentVideoElement = null;
  let cachedTimeCurrentEl = null;
  let cachedTimeDurationEl = null;
  let cachedTimeDisplayEl = null;
  let cachedPlayerEl = null;

  // --------------------------------------------------------- watch-time state
  let timeTrackingInterval = null;
  let lastTrackingTime = Date.now();
  let lastMediaTime = 0;
  let lastFlushTime = Date.now();
  let pendingWatchSeconds = 0;
  let isVideoPlaying = false;
  let videoAbortController = null;

  // ------------------------------------------------------------ interval A→B
  let intervalStartTime = null;
  let intervalEndTime = null;

  // ----------------------------------------------------------------- settings
  let showMilliseconds = true;
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

  const isShortsPage = () => window.location.pathname.startsWith('/shorts/');
  const getVideo = () => currentVideoElement || document.querySelector('video');

  // Settings are loaded once up front; UI setup awaits this promise so that
  // buttons the user disabled never flash on screen before being removed.
  const settingsReady = loadSettings();

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
      if (isInitialized) applyUiSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Rebuild every piece of injected UI from the current settings.
  // Cheap enough to run wholesale (settings changes are rare) and avoids the
  // ordering bugs that per-key incremental updates kept reintroducing.
  function applyUiSettings() {
    displayModeRetries = 0;
    updateDisplayMode();
    setupCopyButton();
    setupMillisecondsToggleButton();
    setupJumpControl();
    if (showIntervalTimer) {
      setupIntervalControls();
    } else {
      teardownIntervalControls();
    }
  }

  // Changing any of these means the set of injected buttons changes, so the
  // whole control bar has to be rebuilt. Toggling milliseconds does not.
  const LAYOUT_KEYS = ['showIntervalTimer', 'showCopyBtn', 'showMsToggleBtn', 'showJumpBtn'];

  // Listen for storage changes (when settings are updated from popup)
  chrome.storage?.onChanged?.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    if (changes.showMilliseconds) showMilliseconds = changes.showMilliseconds.newValue !== false;
    if (changes.showIntervalTimer) showIntervalTimer = changes.showIntervalTimer.newValue !== false;
    if (changes.showCopyBtn) showCopyBtn = changes.showCopyBtn.newValue !== false;
    if (changes.showMsToggleBtn) showMsToggleBtn = changes.showMsToggleBtn.newValue !== false;
    if (changes.showJumpBtn) showJumpBtn = changes.showJumpBtn.newValue !== false;

    if (LAYOUT_KEYS.some(key => key in changes)) {
      if (!showJumpBtn) closeJumpInput();
      applyUiSettings();
    } else if (changes.showMilliseconds) {
      // Targeted path: keeps keyboard focus on the in-player toggle button
      // instead of destroying and recreating it on every click.
      displayModeRetries = 0;
      updateDisplayMode();
      updateMsToggleButtonState();
    }
  });

  let timeElementsObserver = null;

  // Single write path. Skipping equal text is what makes the whole thing safe:
  // our own writes feed back into the MutationObserver below, and the second
  // pass no-ops instead of looping.
  //
  // The previous `isInternalTimeWrite` flag could never work — it was set and
  // cleared synchronously around the write, while MutationObserver callbacks
  // are delivered as microtasks, i.e. always after the flag was already false.
  function writeText(el, text) {
    if (el.textContent === text) return;
    el.textContent = text;
  }

  // Hot-path tick: only updates currentTime. Reads cached refs to avoid 3× querySelector per tick.
  function updateTimeDisplay() {
    const video = currentVideoElement;
    const el = cachedTimeCurrentEl;
    if (!video || !el || isNaN(video.currentTime)) return;
    writeText(el, formatVideoTime(video.currentTime, showMilliseconds));
  }

  // Duration only changes at metadata load — no need to format it on every tick.
  function updateDurationDisplay() {
    const video = getVideo();
    const el = cachedTimeDurationEl;
    if (!video || !el || !Number.isFinite(video.duration)) return;
    writeText(el, formatVideoTime(video.duration, showMilliseconds));
  }

  // Watch for YouTube overwriting our time elements and immediately restore our
  // format. Both handlers are idempotent, so re-entering on our own write costs
  // one string compare and stops there.
  function observeTimeElements(currentTimeElement, durationElement) {
    if (timeElementsObserver) timeElementsObserver.disconnect();

    timeElementsObserver = new MutationObserver(() => {
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
      // Controls faded out → the time text is invisible. Skipping the write
      // avoids 60 style/layout invalidations per second for the common case of
      // just watching a video. The next visible frame repaints it immediately.
      if (!cachedPlayerEl || !cachedPlayerEl.classList.contains('ytp-autohide')) {
        updateTimeDisplay();
      }
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

  // Pick the cheapest loop that still keeps the readout correct.
  // Paused video: no loop at all — 'seeking'/'seeked'/'timeupdate' cover the
  // only moments currentTime can change.
  function syncDisplayLoop() {
    if (!cachedTimeCurrentEl) return;
    if (!isVideoPlaying) {
      stopDisplayLoop();
      updateTimeDisplay();
      return;
    }
    if (showMilliseconds) {
      startRafLoop();
    } else {
      startIntervalLoop(NO_MS_TICK_MS);
    }
  }

  // Resolve the player DOM, apply the ms/no-ms mode and (re)start the loop.
  function updateDisplayMode() {
    if (displayModeTimeout) {
      clearTimeout(displayModeTimeout);
      displayModeTimeout = null;
    }

    // Shorts has no time readout at all — skip the 5 s retry loop entirely.
    if (isShortsPage()) return;

    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (!currentTimeElement || !durationElement) {
      if (displayModeRetries < MAX_DISPLAY_MODE_RETRIES) {
        displayModeRetries++;
        displayModeTimeout = setTimeout(updateDisplayMode, 100);
      }
      return;
    }
    displayModeRetries = 0;
    cachedTimeCurrentEl = currentTimeElement;
    cachedTimeDurationEl = durationElement;
    cachedTimeDisplayEl = currentTimeElement.closest('.ytp-time-display');
    cachedPlayerEl = document.querySelector('#movie_player');

    stopDisplayLoop();

    if (showMilliseconds) {
      currentTimeElement.classList.add('ytp-time-milliseconds');
      durationElement.classList.add('ytp-time-milliseconds');
      // Widening .ytp-time-display is only correct in ms mode; keeping it
      // unconditional left a dead gap in the control bar with ms turned off.
      cachedTimeDisplayEl?.classList.add('ytp-time-display--ms');
      observeTimeElements(currentTimeElement, durationElement);
    } else {
      currentTimeElement.classList.remove('ytp-time-milliseconds');
      durationElement.classList.remove('ytp-time-milliseconds');
      cachedTimeDisplayEl?.classList.remove('ytp-time-display--ms');
      if (timeElementsObserver) {
        timeElementsObserver.disconnect();
        timeElementsObserver = null;
      }
    }

    syncDisplayLoop();
    updateDurationDisplay();
  }

  function resetWatchSampling() {
    lastTrackingTime = Date.now();
    const video = currentVideoElement;
    lastMediaTime = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
  }

  // ------------------------------------------------------------- watch time
  // Sampled once a second (cheap, no IPC) but flushed to the service worker in
  // batches — one message per 5 s instead of one per second keeps the worker
  // from doing a storage read+write every second for every open YouTube tab.
  //
  // Each sample counts min(wall-clock elapsed, media time consumed). The two
  // signals cross-check each other:
  //   • machine sleep / stalled buffering → media time stands still, nothing counted
  //   • forward seek → wall clock stays small, only real seconds counted
  //   • background tab (setInterval throttled to ~1/min) → both agree at ~60 s,
  //     so background playback is finally counted instead of being discarded by
  //     the old "elapsed < 10" guard
  function sampleWatchTime() {
    if (!isVideoPlaying) return;

    // chrome.runtime.id becomes undefined when the extension context is invalidated
    // (e.g. after a reload in dev mode). Stop all tracking to avoid repeated errors.
    if (!chrome.runtime?.id) {
      pendingWatchSeconds = 0;
      stopAllTracking();
      return;
    }

    const video = currentVideoElement;
    const now = Date.now();
    const elapsed = (now - lastTrackingTime) / 1000;
    lastTrackingTime = now;

    if (!video || !Number.isFinite(video.currentTime)) return;

    const mediaDelta = video.currentTime - lastMediaTime;
    lastMediaTime = video.currentTime;

    pendingWatchSeconds += computeWatchedSeconds(
      elapsed, mediaDelta, video.playbackRate, MAX_TICK_SECONDS
    );

    if (now - lastFlushTime >= WATCH_FLUSH_MS) flushWatchTime();
  }

  function flushWatchTime() {
    lastFlushTime = Date.now();
    if (pendingWatchSeconds <= 0) return;

    if (!chrome.runtime?.id) {
      pendingWatchSeconds = 0;
      return;
    }

    const seconds = pendingWatchSeconds;
    pendingWatchSeconds = 0;
    try {
      chrome.runtime.sendMessage({ type: 'UPDATE_WATCH_TIME', seconds })
        .catch(() => { /* background not ready — one batch lost, not worth retrying */ });
    } catch {
      stopAllTracking();
    }
  }

  // Sample the tail of the current play span and push it out immediately.
  function commitWatchTime() {
    sampleWatchTime();
    flushWatchTime();
  }

  function startTimeTracking() {
    if (timeTrackingInterval) clearInterval(timeTrackingInterval);
    lastFlushTime = Date.now();
    resetWatchSampling();
    timeTrackingInterval = setInterval(sampleWatchTime, 1000);
  }

  function stopAllTracking() {
    stopDisplayLoop();
    if (timeTrackingInterval) {
      clearInterval(timeTrackingInterval);
      timeTrackingInterval = null;
    }
  }

  // Attach video listeners — AbortController guarantees the previous video's
  // listeners are gone before new ones are added.
  function handleVideoEvents(video) {
    if (videoAbortController) videoAbortController.abort();
    videoAbortController = new AbortController();
    const { signal } = videoAbortController;

    video.addEventListener('play', () => {
      isVideoPlaying = true;
      resetWatchSampling();
      syncDisplayLoop();
    }, { signal });

    const onStop = () => {
      if (isVideoPlaying) {
        commitWatchTime();
        isVideoPlaying = false;
      }
      syncDisplayLoop();
    };
    video.addEventListener('pause', onStop, { signal });
    video.addEventListener('ended', onStop, { signal });

    video.addEventListener('seeking', () => {
      // Re-baseline both clocks so the jump itself is never counted as watched.
      resetWatchSampling();
      if (!isVideoPlaying) updateTimeDisplay();
    }, { signal });

    // While paused there is no loop running, so these are what keep the
    // readout in sync with scrubbing and chapter jumps.
    video.addEventListener('seeked', () => {
      if (!isVideoPlaying) updateTimeDisplay();
    }, { signal });
    video.addEventListener('timeupdate', () => {
      if (!isVideoPlaying) updateTimeDisplay();
    }, { signal });

    video.addEventListener('loadedmetadata', updateDurationDisplay, { signal });
    video.addEventListener('durationchange', updateDurationDisplay, { signal });
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

  function copyToClipboard(text, onDone) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(() => {
        fallbackCopy(text);
        onDone();
      });
    } else {
      fallbackCopy(text);
      onDone();
    }
  }

  // Update visual markers on the progress bar for interval points A and B
  function updateProgressMarkers() {
    const markerA = document.querySelector('.ytp-interval-marker-a');
    const markerB = document.querySelector('.ytp-interval-marker-b');
    const segment = document.querySelector('.ytp-interval-segment');
    const video = getVideo();

    // Live streams report Infinity — percentages would collapse to 0.
    if (!markerA || !markerB || !segment || !video || !Number.isFinite(video.duration) || video.duration === 0) return;

    const posA = intervalStartTime !== null ? (intervalStartTime / video.duration) * 100 : null;
    const posB = intervalEndTime !== null ? (intervalEndTime / video.duration) * 100 : null;

    if (posA !== null) {
      markerA.style.left = `${posA}%`;
      markerA.style.display = '';
    } else {
      markerA.style.display = 'none';
    }

    if (posB !== null) {
      markerB.style.left = `${posB}%`;
      markerB.style.display = '';
    } else {
      markerB.style.display = 'none';
    }

    if (posA !== null && posB !== null) {
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

    // Show the badge as soon as either point is set — setting B first used to
    // draw a progress marker with no visible readout anywhere.
    if (intervalStartTime !== null || intervalEndTime !== null) {
      badge.classList.add('ytp-interval-badge--visible');
    }

    if (timeA) timeA.textContent = intervalStartTime !== null ? formatVideoTime(intervalStartTime, true) : '—';
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
    const video = getVideo();
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

    document.querySelector('.ytp-interval-badge')?.classList.remove('ytp-interval-badge--visible');

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

    const deltaText = formatVideoTime(Math.abs(intervalEndTime - intervalStartTime), true);
    const copyBtn = document.querySelector('.ytp-interval-badge .ytp-interval-copy-btn');

    copyToClipboard(deltaText, () => {
      if (!copyBtn) return;
      clearTimeout(copyBtn._resetTimeout);
      copyBtn.textContent = '✓';
      copyBtn._resetTimeout = setTimeout(() => {
        copyBtn.textContent = '⎘';
      }, 1500);
    });
  }

  // All injected control-bar buttons sit after the copy button when it exists,
  // and fall back to the time display when the user has hidden it.
  function getControlAnchor() {
    return document.querySelector('.ytp-copy-time-btn') || document.querySelector('.ytp-time-display');
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

    if (!showMsToggleBtn || isShortsPage()) return;

    const anchor = getControlAnchor();
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-ms-toggle-btn';
    btn.setAttribute('aria-label', 'Toggle milliseconds display');
    btn.innerHTML = MS_TOGGLE_ICON;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!chrome.runtime?.id) return;
      try {
        // Toggle against the in-memory value: it is already kept in sync by the
        // storage listener, so an extra round-trip only adds latency.
        await chrome.storage.local.set({ showMilliseconds: !showMilliseconds });
      } catch (err) {
        console.error('Error toggling milliseconds:', err);
      }
    });

    anchor.insertAdjacentElement('afterend', btn);
    updateMsToggleButtonState();
  }

  // Apply parsed timestamp to the video. Clamps to [0, duration].
  function applyJump(seconds) {
    const video = getVideo();
    if (!video || !Number.isFinite(video.duration)) return false;
    video.currentTime = Math.max(0, Math.min(seconds, video.duration));
    return true;
  }

  function closeJumpInput(only) {
    const input = document.querySelector('.ytp-jump-input');
    if (!input) return;
    // `only` guards against a deferred blur handler killing the input that a
    // subsequent click has just re-opened.
    if (only && input !== only) return;
    input.remove();
  }

  function openJumpInput() {
    closeJumpInput();
    if (isShortsPage()) return;

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
    const video = getVideo();
    if (video && Number.isFinite(video.currentTime)) {
      input.value = formatVideoTime(video.currentTime, true);
    }

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        const parsed = parseTimestamp(input.value);
        if (parsed === null) {
          input.classList.add('ytp-jump-input--error');
          return;
        }
        if (applyJump(parsed)) closeJumpInput(input);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeJumpInput(input);
      } else {
        input.classList.remove('ytp-jump-input--error');
      }
    });

    input.addEventListener('blur', () => {
      // Defer so click handlers on the page still see the input briefly
      setTimeout(() => closeJumpInput(input), 0);
    });

    videoContainer.appendChild(input);
    input.focus();
    input.select();
  }

  // Create and inject the jump-to-timestamp button into the player control bar
  function setupJumpControl() {
    document.querySelector('.ytp-jump-btn')?.remove();

    if (!showJumpBtn || isShortsPage()) return;

    const anchor = getControlAnchor();
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

  // Create and inject the copy-timestamp button after .ytp-time-display
  function setupCopyButton() {
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

      const video = getVideo();
      if (!video) return;

      // Always copy with full millisecond precision — that's the point
      copyToClipboard(formatVideoTime(video.currentTime, true), () => {
        clearTimeout(resetTimeout);
        btn.innerHTML = CHECK_ICON;
        btn.classList.add('ytp-copy-time-btn--copied');
        resetTimeout = setTimeout(() => {
          btn.innerHTML = COPY_ICON;
          btn.classList.remove('ytp-copy-time-btn--copied');
        }, 1500);
      });
    });

    timeDisplay.insertAdjacentElement('afterend', btn);
  }

  // Remove all interval UI elements and reset state (used when feature is disabled)
  function teardownIntervalControls() {
    resetInterval();
    document.querySelectorAll(
      '.ytp-interval-btn-a, .ytp-interval-btn-b, .ytp-interval-badge, ' +
      '.ytp-interval-marker-a, .ytp-interval-marker-b, .ytp-interval-segment'
    ).forEach(el => el.remove());
  }

  // Create and inject interval A/B buttons, the floating badge, and progress bar markers
  function setupIntervalControls() {
    // Remove stale elements from previous page / previous settings state
    document.querySelectorAll(
      '.ytp-interval-btn-a, .ytp-interval-btn-b, .ytp-interval-badge, ' +
      '.ytp-interval-marker-a, .ytp-interval-marker-b, .ytp-interval-segment'
    ).forEach(el => el.remove());

    if (!showIntervalTimer || isShortsPage()) return;

    // Anchoring to the copy button alone meant hiding the copy button silently
    // killed the whole interval feature.
    const anchor = getControlAnchor();
    if (!anchor) return;

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

    // Insert A then B after the anchor → results in [anchor][A][B]
    anchor.insertAdjacentElement('afterend', btnB);
    anchor.insertAdjacentElement('afterend', btnA);

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
    if (videoContainer) videoContainer.appendChild(badge);

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

    // Restore any points that survived a settings toggle
    if (intervalStartTime !== null || intervalEndTime !== null) updateIntervalUI();
  }

  // ----------------------------------------------------------- initialization
  function clearInitTimers() {
    if (playerCheckInterval) {
      clearInterval(playerCheckInterval);
      playerCheckInterval = null;
    }
    if (playerCheckTimeout) {
      clearTimeout(playerCheckTimeout);
      playerCheckTimeout = null;
    }
  }

  function initializeExtension() {
    if (isInitialized || initializationInProgress) return;
    initializationInProgress = true;
    clearInitTimers();

    playerCheckInterval = setInterval(() => {
      const video = document.querySelector('video');
      if (video) onPlayerFound(video);
    }, PLAYER_POLL_MS);

    playerCheckTimeout = setTimeout(() => {
      clearInitTimers();
      initializationInProgress = false;
    }, PLAYER_POLL_TIMEOUT_MS);
  }

  async function onPlayerFound(video) {
    clearInitTimers();
    const epoch = navEpoch;

    currentVideoElement = video;
    isInitialized = true;
    initializationInProgress = false;

    handleVideoEvents(video);

    isVideoPlaying = !video.paused;
    startTimeTracking();

    // Wait for stored settings before injecting anything, otherwise buttons the
    // user turned off appear for a frame (or forever, if storage is slow).
    await settingsReady;
    if (epoch !== navEpoch) return;

    // These are no-ops on Shorts (no .ytp-time-current / .ytp-time-display);
    // updateDisplayMode retries internally if elements aren't found yet.
    applyUiSettings();
  }

  // Handle YouTube SPA navigation — YouTube fires this event on page transitions
  function handleNavigation() {
    navEpoch++;
    lastHref = location.href;
    commitWatchTime();

    isInitialized = false;
    initializationInProgress = false;
    isVideoPlaying = false;
    clearInitTimers();
    if (displayModeTimeout) {
      clearTimeout(displayModeTimeout);
      displayModeTimeout = null;
    }
    displayModeRetries = 0;

    if (videoAbortController) {
      videoAbortController.abort();
      videoAbortController = null;
    }
    if (timeElementsObserver) {
      timeElementsObserver.disconnect();
      timeElementsObserver = null;
    }

    currentVideoElement = null;
    cachedTimeCurrentEl = null;
    cachedTimeDurationEl = null;
    cachedTimeDisplayEl = null;
    cachedPlayerEl = null;
    // YouTube reuses #movie_player across SPA transitions, so the previous
    // page's badge and progress markers would otherwise stay on screen with
    // stale timestamps until the new page finished initializing.
    teardownIntervalControls();
    closeJumpInput();
    stopAllTracking();

    clearTimeout(initRetryTimeout);
    initRetryTimeout = setTimeout(initializeExtension, 500);
  }

  window.addEventListener('yt-navigate-finish', handleNavigation);

  // Fallback for SPA transitions where yt-navigate-finish doesn't fire.
  // A 1 s href comparison replaces the old MutationObserver on document.body:
  // that observer ran a querySelector('video') over every added subtree, which
  // on an infinite-scroll feed meant continuous work for no benefit.
  setInterval(() => {
    if (location.href === lastHref) return;
    handleNavigation();
  }, NAV_POLL_MS);

  // ------------------------------------------------------ keyboard shortcuts
  const isTypingTarget = (target) =>
    target instanceof Element &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    if (isTypingTarget(e.target)) return;
    if (isShortsPage()) return;

    // Alt is not excluded here: on several keyboard layouts the bracket keys
    // are only reachable via AltGr, which reports altKey.
    if (showIntervalTimer && (e.key === '[' || e.key === ']')) {
      e.preventDefault();
      setIntervalPoint(e.key === '[' ? 'start' : 'end');
      return;
    }

    if (showJumpBtn && !e.altKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      openJumpInput();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

  // pagehide is the reliable teardown hook; beforeunload does not fire on
  // bfcache navigations or mobile tab eviction.
  window.addEventListener('pagehide', () => {
    commitWatchTime();
    stopAllTracking();
  });

  // Restored from the back/forward cache — pagehide already tore everything
  // down, so rebuild from scratch instead of leaving a dead page behind.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) handleNavigation();
  });

  // Flush in both directions: hiding pushes out what was watched so far, and
  // becoming visible again closes the throttled background span. The media-time
  // cross-check in sampleWatchTime() means the hidden span no longer has to be
  // discarded wholesale.
  document.addEventListener('visibilitychange', commitWatchTime);

})();
} // end browser-only block

// Export for testing in Node.js environment
if (typeof module !== 'undefined') {
  module.exports = { formatVideoTime, parseTimestamp, computeWatchedSeconds };
}
