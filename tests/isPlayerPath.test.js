const { isPlayerPath } = require('../js/content.js');

describe('isPlayerPath', () => {
  test('accepts the watch page', () => {
    expect(isPlayerPath('/watch')).toBe(true);
  });

  test('accepts shorts, embed and live paths', () => {
    expect(isPlayerPath('/shorts/abc123')).toBe(true);
    expect(isPlayerPath('/embed/abc123')).toBe(true);
    expect(isPlayerPath('/live/abc123')).toBe(true);
  });

  // These are the pages that host hover-preview <video> elements — attaching
  // to those counted preview playback as watch time.
  test('rejects browsing pages that only contain preview players', () => {
    expect(isPlayerPath('/')).toBe(false);
    expect(isPlayerPath('/feed/subscriptions')).toBe(false);
    expect(isPlayerPath('/results')).toBe(false);
    expect(isPlayerPath('/@somechannel')).toBe(false);
    expect(isPlayerPath('/playlist')).toBe(false);
    expect(isPlayerPath('/feed/history')).toBe(false);
  });

  test('does not accept prefixes of /watch', () => {
    expect(isPlayerPath('/watchlater')).toBe(false);
    expect(isPlayerPath('/watch/extra')).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isPlayerPath(undefined)).toBe(false);
    expect(isPlayerPath(null)).toBe(false);
    expect(isPlayerPath(42)).toBe(false);
  });
});
