// YouTube Milliseconds Timer Extension
(function() {
  'use strict';

  let displayUpdateInterval;
  let timeTrackingInterval;
  let currentVideoElement;
  let lastTrackingTime = Date.now();
  let isVideoPlaying = false;
  let showMilliseconds = true;
  let isInitialized = false;

  // Load settings on startup
  loadSettings();

  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get(['showMilliseconds']);
      showMilliseconds = data.showMilliseconds !== false;
      if (isInitialized) {
        updateDisplayMode();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Listen for storage changes (when settings are updated from popup)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.showMilliseconds) {
      showMilliseconds = changes.showMilliseconds.newValue;
      updateDisplayMode();
    }
  });

  // Function to format time with or without milliseconds
  function formatTime(seconds, withMilliseconds = true) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (withMilliseconds && showMilliseconds) {
      const milliseconds = Math.floor((seconds % 1) * 1000);
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
      } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
      }
    } else {
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      }
    }
  }

  // Function to update time display
  function updateTimeDisplay() {
    const video = document.querySelector('video');
    if (!video) return;

    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (currentTimeElement && !isNaN(video.currentTime)) {
      currentTimeElement.textContent = formatTime(video.currentTime, true);
    }

    if (durationElement && !isNaN(video.duration)) {
      durationElement.textContent = formatTime(video.duration, true);
    }
  }

  // Function to update display mode immediately
  function updateDisplayMode() {
    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (!currentTimeElement || !durationElement) {
      setTimeout(updateDisplayMode, 100);
      return;
    }

    // Stop current interval first
    if (displayUpdateInterval) {
      clearInterval(displayUpdateInterval);
      displayUpdateInterval = null;
    }

    if (showMilliseconds) {
      currentTimeElement.classList.add('ytp-time-milliseconds');
      durationElement.classList.add('ytp-time-milliseconds');

      // Start fast updates for milliseconds
      displayUpdateInterval = setInterval(updateTimeDisplay, 10);
    } else {
      currentTimeElement.classList.remove('ytp-time-milliseconds');
      durationElement.classList.remove('ytp-time-milliseconds');

      // Update once without milliseconds
      updateTimeDisplay();
    }
  }

  // Function to update watch time statistics
  function updateWatchTime() {
    if (!isVideoPlaying) return;

    const now = Date.now();
    const elapsed = (now - lastTrackingTime) / 1000;

    if (elapsed > 0 && elapsed < 10) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_WATCH_TIME',
        seconds: elapsed
      }).catch(() => {
        // Ignore errors if background script is not ready
      });
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

  // Function to handle video events
  function handleVideoEvents(video) {
    video.addEventListener('play', () => {
      isVideoPlaying = true;
      lastTrackingTime = Date.now();
    });

    video.addEventListener('pause', () => {
      if (isVideoPlaying) {
        updateWatchTime();
        isVideoPlaying = false;
      }
    });

    video.addEventListener('ended', () => {
      if (isVideoPlaying) {
        updateWatchTime();
        isVideoPlaying = false;
      }
    });

    video.addEventListener('seeking', () => {
      lastTrackingTime = Date.now();
    });
  }

  // Function to initialize the extension
  function initializeExtension() {
    const checkForPlayer = setInterval(() => {
      const video = document.querySelector('video');
      const timeDisplay = document.querySelector('.ytp-time-current');

      if (video && timeDisplay) {
        clearInterval(checkForPlayer);
        currentVideoElement = video;
        isInitialized = true;

        // Setup display mode
        updateDisplayMode();

        // Setup video event handlers
        handleVideoEvents(video);

        // Check if video is already playing
        isVideoPlaying = !video.paused;
        lastTrackingTime = Date.now();

        // Start time tracking
        startTimeTracking();

        // Event handlers for metadata
        video.addEventListener('loadedmetadata', updateTimeDisplay);

        console.log('YouTube Milliseconds Timer activated');
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkForPlayer);
    }, 10000);
  }

  // DOM mutation observer for YouTube SPA navigation
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        const hasVideo = Array.from(mutation.addedNodes).some(node =>
          node.nodeType === 1 && (node.querySelector('video') || node.tagName === 'VIDEO')
        );

        if (hasVideo) {
          isInitialized = false;
          setTimeout(initializeExtension, 500);
        }
      }
    });
  });

  // Start observing DOM changes
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
