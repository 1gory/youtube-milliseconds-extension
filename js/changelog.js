// Version history shown in the popup (newest first). Written for users, not
// developers: what changed for them, in a line each. The full technical notes
// live in the GitHub releases.
//
// Every release adds an entry at the top — tests/changelog.test.js fails until
// the newest entry matches manifest.json. The popup shows the latest
// CHANGELOG_VISIBLE entries; older ones stay here as the record.
const CHANGELOG = [
  {
    version: '1.7.0',
    date: '2026-10',
    changes: [
      'New: this list of what changed in each version. It opens from the version number below the settings.',
    ],
  },
  {
    version: '1.6.3',
    date: '2026-10',
    changes: [
      'The clock no longer flickers between elapsed and remaining time after you click it.',
      'The G, [ and ] shortcuts now work on Cyrillic and other non-Latin keyboard layouts.',
      'Reset Statistics works reliably even while a video is playing.',
    ],
  },
  {
    version: '1.6.2',
    date: '2026-09',
    changes: [
      'The timestamp no longer freezes mid-video when YouTube redraws the player, e.g. around ad breaks.',
      'The player buttons now appear even when YouTube loads its controls late.',
    ],
  },
  {
    version: '1.6.1',
    date: '2026-08',
    changes: [
      'Video previews on the home page and in search no longer count as watch time or get buttons.',
      'The timestamp keeps working when YouTube swaps the video during an ad break.',
      'Reset Statistics now asks for confirmation right in this menu.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-07',
    changes: [
      'Watch time from several open tabs is no longer lost, and background-tab playback now counts.',
      'Lighter on the player: less work in the background while you watch.',
      'The buttons stay readable over bright video.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-05',
    changes: [
      'The daily average now spreads your watch time over the whole 7 or 30 days.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-05',
    changes: [
      'A "Leave a review" link in this menu for ideas and bug reports.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05',
    changes: [
      'Jump to an exact timestamp: press G or use the target button.',
      'A milliseconds on/off button right in the player.',
      'Hide any of the player buttons you do not use.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-04',
    changes: [
      'Interval timer: mark points A and B to measure the time between them, to the millisecond.',
      'Watch time statistics: today, daily average, a 7-day chart and a monthly calendar.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-04',
    changes: [
      'Copy the current timestamp with one click.',
      'Watch time now counts on YouTube Shorts too.',
    ],
  },
];

const CHANGELOG_VISIBLE = 10;
const RELEASES_URL = 'https://github.com/1gory/youtube-milliseconds-extension/releases';

if (typeof module !== 'undefined') {
  module.exports = { CHANGELOG, CHANGELOG_VISIBLE, RELEASES_URL };
}
