// Returns local date as YYYY-MM-DD string (not UTC, matches user's clock)
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Compact time format for chart metrics: hours + minutes, or seconds only
function formatShortTime(totalSeconds) {
  const secs = Math.floor(totalSeconds);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;

  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}

// Returns array of 7 YYYY-MM-DD strings: 6 days ago → today
function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getLocalDateString(d));
  }
  return days;
}

// Format total watch time for display (days, hours, minutes, seconds)
function formatWatchTime(totalSeconds) {
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

// Only run DOM setup in browser/extension context
if (typeof document !== 'undefined') {

  let updateInterval;
  let calendarOffset = 0;
  let cachedDailyStats = {};
  let avgPeriod = '7d';

  // Refresh all live counters (total, today, avg) from storage
  async function updateCounters() {
    try {
      const data = await chrome.storage.local.get(['totalWatchTime', 'dailyStats']);
      cachedDailyStats = data.dailyStats || {};

      document.getElementById('totalTime').textContent = formatWatchTime(data.totalWatchTime || 0);

      const today = getLocalDateString(new Date());
      document.getElementById('todayTime').textContent = formatShortTime(cachedDailyStats[today] || 0);

      updateAvg();
    } catch (error) {
      console.error('Error updating counters:', error);
    }
  }

  // Calculate daily average for the selected period
  function calcAvg(dailyStats, period) {
    let dates;
    if (period === '7d') {
      dates = getLast7Days();
    } else if (period === '30d') {
      dates = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return getLocalDateString(d);
      });
    } else {
      dates = Object.keys(dailyStats);
    }
    const daysWithData = dates.filter(d => (dailyStats[d] || 0) > 0);
    const sum = daysWithData.reduce((acc, d) => acc + dailyStats[d], 0);
    return sum / Math.max(daysWithData.length, 1);
  }

  function updateAvg() {
    document.getElementById('avgTime').textContent = formatShortTime(calcAvg(cachedDailyStats, avgPeriod));
  }

  // Render 7-day bar chart into #weekChart
  function renderChart(dailyStats) {
    const container = document.getElementById('weekChart');
    if (!container) return;

    const days = getLast7Days();
    const today = getLocalDateString(new Date());
    const values = days.map(d => dailyStats[d] || 0);
    const maxVal = Math.max(...values, 1);

    container.innerHTML = '';
    days.forEach((dateStr, i) => {
      const seconds = values[i];
      const heightPct = Math.max((seconds / maxVal) * 100, 4);
      const isToday = dateStr === today;

      const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });

      const col = document.createElement('div');
      col.className = 'chart-col';

      const tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.textContent = formatShortTime(seconds);

      const bar = document.createElement('div');
      bar.className = 'chart-bar' + (isToday ? ' chart-bar--today' : '');
      bar.style.height = `${heightPct}%`;

      const label = document.createElement('div');
      label.className = 'chart-day' + (isToday ? ' chart-day--today' : '');
      label.textContent = dayLabel;

      col.appendChild(tooltip);
      col.appendChild(bar);
      col.appendChild(label);
      container.appendChild(col);
    });
  }

  // Fixed thresholds for calendar heatmap levels (seconds)
  const CAL_LEVELS = [
    { max: 0,          label: 'No data' },
    { max: 30 * 60,    label: '< 30m'   },
    { max: 2 * 3600,   label: '< 2h'    },
    { max: 5 * 3600,   label: '< 5h'    },
    { max: Infinity,   label: '5h+'     },
  ];

  function calLevel(seconds) {
    if (seconds <= 0) return 0;
    if (seconds < CAL_LEVELS[1].max) return 1;
    if (seconds < CAL_LEVELS[2].max) return 2;
    if (seconds < CAL_LEVELS[3].max) return 3;
    return 4;
  }

  // Render monthly calendar heatmap into #monthCalendar
  function renderCalendar(dailyStats, offset) {
    const container = document.getElementById('monthCalendar');
    if (!container) return;

    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = target.getFullYear();
    const month = target.getMonth();
    const today = getLocalDateString(now);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    container.innerHTML = '';

    // Header with prev / next navigation
    const header = document.createElement('div');
    header.className = 'cal-header';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'cal-nav';
    prevBtn.textContent = '‹';
    prevBtn.addEventListener('click', () => {
      calendarOffset--;
      renderCalendar(cachedDailyStats, calendarOffset);
    });

    const monthLabel = document.createElement('span');
    monthLabel.textContent = target.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'cal-nav';
    nextBtn.textContent = '›';
    nextBtn.disabled = offset >= 0;
    nextBtn.addEventListener('click', () => {
      calendarOffset++;
      renderCalendar(cachedDailyStats, calendarOffset);
    });

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    container.appendChild(header);

    const wdRow = document.createElement('div');
    wdRow.className = 'cal-weekdays';
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(wd => {
      const cell = document.createElement('div');
      cell.className = 'cal-wd';
      cell.textContent = wd;
      wdRow.appendChild(cell);
    });
    container.appendChild(wdRow);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = getLocalDateString(new Date(year, month, d));
      const seconds = dailyStats[dateStr] || 0;
      const level = calLevel(seconds);

      const cell = document.createElement('div');
      cell.className = `cal-day cal-day--l${level}${dateStr === today ? ' cal-day--today' : ''}`;
      if (seconds > 0) cell.dataset.time = formatShortTime(seconds);
      cell.textContent = d;
      grid.appendChild(cell);
    }

    container.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'cal-legend';
    CAL_LEVELS.forEach((lvl, i) => {
      const item = document.createElement('div');
      item.className = 'cal-legend-item';

      const swatch = document.createElement('div');
      swatch.className = `cal-legend-swatch cal-day--l${i}`;

      const label = document.createElement('span');
      label.textContent = lvl.label;

      item.appendChild(swatch);
      item.appendChild(label);
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  // Load and display statistics
  async function loadStats() {
    try {
      const data = await chrome.storage.local.get(['totalWatchTime', 'showMilliseconds', 'showIntervalTimer', 'dailyStats']);

      const totalTime = data.totalWatchTime || 0;
      const showMilliseconds = data.showMilliseconds !== false;
      const showIntervalTimer = data.showIntervalTimer !== false;
      const dailyStats = data.dailyStats || {};

      document.getElementById('showMilliseconds').checked = showMilliseconds;
      document.getElementById('showIntervalTimer').checked = showIntervalTimer;

      // Wire up period tabs (once)
      document.querySelectorAll('.avg-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.avg-tab').forEach(b => b.classList.remove('avg-tab--active'));
          btn.classList.add('avg-tab--active');
          avgPeriod = btn.dataset.period;
          updateAvg();
        });
      });

      // Initial render of counters, chart, calendar
      cachedDailyStats = dailyStats;
      await updateCounters();
      renderChart(dailyStats);
      renderCalendar(dailyStats, calendarOffset);

      // Keep all counters in sync every second
      updateInterval = setInterval(updateCounters, 1000);

    } catch (error) {
      console.error('Error loading stats:', error);
      document.getElementById('totalTime').textContent = 'Error loading data';
    }
  }

  // Handle milliseconds checkbox change
  document.getElementById('showMilliseconds').addEventListener('change', async (e) => {
    try {
      await chrome.storage.local.set({ showMilliseconds: e.target.checked });
    } catch (error) {
      console.error('Error updating milliseconds setting:', error);
    }
  });

  // Handle interval timer checkbox change
  document.getElementById('showIntervalTimer').addEventListener('change', async (e) => {
    try {
      await chrome.storage.local.set({ showIntervalTimer: e.target.checked });
    } catch (error) {
      console.error('Error updating interval timer setting:', error);
    }
  });

  // Reset statistics
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all statistics?')) {
      try {
        const currentSettings = await chrome.storage.local.get(['showMilliseconds', 'showIntervalTimer']);
        await chrome.storage.local.clear();
        await chrome.storage.local.set({
          totalWatchTime: 0,
          dailyStats: {},
          showMilliseconds: currentSettings.showMilliseconds !== false,
          showIntervalTimer: currentSettings.showIntervalTimer !== false
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

  // Initialize popup (script is at end of <body>, DOM is already ready)
  loadStats();

} // end browser-only block

// Export for testing in Node.js environment
if (typeof module !== 'undefined') {
  module.exports = { formatWatchTime };
}
