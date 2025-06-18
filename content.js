// YouTube Milliseconds Timer Extension
(function() {
  'use strict';

  let timeUpdateInterval;
  let currentVideoElement;

  // Function to format time with milliseconds
  function formatTimeWithMilliseconds(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }
  }

  // Function to update time display
  function updateTimeDisplay() {
    const video = document.querySelector('video');
    if (!video) return;

    const currentTimeElement = document.querySelector('.ytp-time-current');
    const durationElement = document.querySelector('.ytp-time-duration');

    if (currentTimeElement && !isNaN(video.currentTime)) {
      currentTimeElement.textContent = formatTimeWithMilliseconds(video.currentTime);
    }

    if (durationElement && !isNaN(video.duration)) {
      durationElement.textContent = formatTimeWithMilliseconds(video.duration);
    }
  }

  // Function to start time tracking
  function startTimeTracking() {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }

    // Update every 10 milliseconds for smooth display
    timeUpdateInterval = setInterval(updateTimeDisplay, 10);
  }

  // Function to stop time tracking
  function stopTimeTracking() {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
    }
  }

  // Function to initialize the extension
  function initializeExtension() {
    // Wait for YouTube player to load
    const checkForPlayer = setInterval(() => {
      const video = document.querySelector('video');
      const timeDisplay = document.querySelector('.ytp-time-current');

      if (video && timeDisplay) {
        clearInterval(checkForPlayer);
        currentVideoElement = video;

        // Add class for styling
        timeDisplay.classList.add('ytp-time-milliseconds');
        document.querySelector('.ytp-time-duration')?.classList.add('ytp-time-milliseconds');

        // Start time tracking
        startTimeTracking();

        // Event handlers
        video.addEventListener('loadedmetadata', updateTimeDisplay);
        video.addEventListener('timeupdate', updateTimeDisplay);

        console.log('YouTube Milliseconds Timer activated');
      }
    }, 100);

    // Stop checking after 10 seconds if player not found
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
  window.addEventListener('beforeunload', stopTimeTracking);

})();
