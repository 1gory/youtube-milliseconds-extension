async () => {
  // Live end-to-end check, run INSIDE the target browser — Igor's own Chrome
  // with the unpacked build installed — on a real youtube.com watch page.
  // See TESTING.md, layer 3. Pass this whole file as the `function` argument
  // of the chrome-devtools `evaluate_script` tool, on a watch-page tab that has
  // been brought to the front (background tabs get no requestAnimationFrame).
  //
  // Run it on https://www.youtube.com/watch?v=aqz-KE-bpKQ (Big Buck Bunny,
  // 10:34, no chapters) and keep hands off the tab while it runs (~1 min) —
  // a click on the player during the run changes YouTube's state under it.
  // Puts back the user's milliseconds setting and YouTube's elapsed/remaining
  // mode when done; navigates the tab to a related video at the end.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const results = [];
  const check = (name, ok, detail) => results.push({ ok: !!ok, name, detail });

  const p = document.querySelector('#movie_player');
  if (!p || !location.pathname.startsWith('/watch')) return { error: 'open a /watch page first' };
  const v = p.querySelector('video');
  // An ad does not always set .ad-showing (seen 2026-10-06: a 0:32 ad
  // without it), so the duration check below is the real gate.
  const inAd = () => p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting') ||
    !!p.querySelector('.ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-preview-container');
  const skipAds = async () => {
    for (let i = 0; i < 120 && inAd(); i++) {
      document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern')?.click();
      await sleep(1000);
    }
    return !inAd();
  };
  if (!(await skipAds())) return { error: 'an ad is still playing after 2 minutes — rerun later' };
  // Ads play in the same <video>, pre-roll and mid-roll alike, so "is this
  // the 634.6 s film" is checked before every measurement, not just once.
  const isTheVideo = () => Math.abs(v.duration - 634.6) < 1;
  let adBreaks = 0;
  const ensurePlaying = async () => {
    if (!isTheVideo()) adBreaks++;
    for (let i = 0; i < 120 && !isTheVideo(); i++) {
      document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern')?.click();
      v.muted = true;
      if (v.paused) await v.play().catch(() => {});
      await sleep(1000);
    }
    v.muted = true;
    if (v.paused) { await v.play().catch(() => {}); await sleep(500); }
    return isTheVideo() && !v.paused;
  };
  if (!(await ensurePlaying())) {
    return { error: `could not get Big Buck Bunny (634.6 s) playing — <video> reports ${v.duration} s, paused=${v.paused}. Wrong video, an ad over 2 min, or click play once and rerun` };
  }
  await sleep(1500);

  const cur = () => p.querySelector('.ytp-time-current')?.textContent || '';
  const key = (k, code, target = document.body) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true }));
  const msBtn = () => p.querySelector('.ytp-ms-toggle-btn');
  const msOn = () => msBtn()?.getAttribute('aria-pressed') === 'true';
  const setMs = async (on) => { if (msBtn() && msOn() !== on) { msBtn().click(); await sleep(600); } };
  const remainingOn = () => cur().trim().startsWith('-');
  // YouTube's toggle handler sits on .ytp-time-contents (role=button). Not a
  // combined selector: querySelector returns the first match in document
  // order, which is the .ytp-time-display wrapper, and clicking that does
  // nothing.
  const setRemaining = async (on) => {
    if (remainingOn() !== on) {
      (p.querySelector('.ytp-time-contents') || p.querySelector('.ytp-time-display'))?.click();
      await sleep(400);
    }
    return remainingOn() === on;
  };
  // Synthetic mousemove does NOT stop YouTube's autohide, and the extension
  // deliberately skips repainting a hidden readout. So each reading first
  // drops .ytp-autohide (what a real mouse over the player does) and waits two
  // frames for the extension's loop to repaint.
  const frames = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const reveal = async () => { p.classList.remove('ytp-autohide'); await frames(2); };
  // A reading taken while an ad is on screen says nothing about the extension;
  // it is dropped and the ad counted, so a failure next to adBreaks > 0 is a
  // reason to rerun, not a bug.
  const sample = async (n, gap = 100) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      await reveal();
      if (isTheVideo()) out.push(cur()); else adBreaks++;
      await sleep(gap);
    }
    return out;
  };

  const initialMs = msOn();
  const initialRemaining = remainingOn();
  document.activeElement?.blur();

  // 1. Injected controls, exactly once each.
  const sels = ['.ytp-copy-time-btn', '.ytp-ms-toggle-btn', '.ytp-jump-btn', '.ytp-interval-btn-a', '.ytp-interval-btn-b'];
  const counts = sels.map((s) => document.querySelectorAll(s).length);
  check('each control-bar button injected exactly once (a 2 means the store build is still enabled)',
    counts.every((n) => n === 1), counts.join(','));

  // 2. Readout in all four elapsed/remaining × ms on/off combinations.
  //    1.6.3 regression: ms off + remaining flickered "-10:05" / "0:30".
  const combos = [[false, true], [true, true], [true, false], [false, false]];
  for (const [ms, rem] of combos) {
    await setMs(ms);
    if (!(await setRemaining(rem))) {
      check(`readout: ms ${ms ? 'on' : 'off'}, ${rem ? 'remaining' : 'elapsed'}`, false,
        `could not switch YouTube's mode by clicking the readout (text now "${cur()}")`);
      continue;
    }
    await ensurePlaying();
    const s = await sample(25);
    const re = new RegExp('^' + (rem ? '-' : '') + '\\d+:\\d{2}(:\\d{2})?' + (ms ? '\\.\\d{3}' : '') + '$');
    check(`readout: ms ${ms ? 'on' : 'off'}, ${rem ? 'remaining' : 'elapsed'}`,
      s.length >= 5 && s.every((x) => re.test(x)), [...new Set(s)].slice(0, 5).join(' '));
  }
  await setMs(true);
  check('duration shows milliseconds', /\.\d{3}$/.test(p.querySelector('.ytp-time-duration')?.textContent || ''),
    p.querySelector('.ytp-time-duration')?.textContent);

  // 3. Readout tracks playback while the controls are visible.
  const parse = (s) => {
    const m = /^(?:(\d+):)?(\d+):(\d{2})\.(\d{3})$/.exec(s);
    return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : null;
  };
  await ensurePlaying();
  let worst = 0; let seen = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(250);
    await reveal();
    if (v.paused || !isTheVideo()) continue;
    const shown = parse(cur());
    if (shown === null) continue;
    seen++;
    worst = Math.max(worst, Math.abs(shown - v.currentTime));
  }
  check('readout within 0.3 s of currentTime while visible', seen >= 10 && worst < 0.3, `samples=${seen} worst=${worst.toFixed(3)}s`);

  // 4. Shortcuts — Latin and Russian layouts (1.6.3: п / х / ъ).
  for (const [label, gKey, aKey, bKey] of [['latin', 'g', '[', ']'], ['russian', 'п', 'х', 'ъ']]) {
    await ensurePlaying();
    key(gKey, 'KeyG');
    await sleep(200);
    const input = p.querySelector('.ytp-jump-input');
    let jumped = null;
    if (input) {
      input.value = '1:00.500';
      key('Enter', 'Enter', input);
      await sleep(800);
      jumped = v.currentTime;
    }
    check(`${label}: ${gKey} opens jump input, Enter seeks to 1:00.500`,
      input && jumped !== null && Math.abs(jumped - 60.5) < 1.5 && !p.querySelector('.ytp-jump-input'),
      `t=${jumped?.toFixed(3)}`);

    await ensurePlaying();
    key(aKey, 'BracketLeft');
    await sleep(1200);
    key(bKey, 'BracketRight');
    await sleep(200);
    const delta = parse(p.querySelector('[data-interval="delta"]')?.textContent || '');
    check(`${label}: ${aKey} / ${bKey} set A and B`,
      p.querySelector('.ytp-interval-badge--visible') && delta !== null && delta > 0.5 && delta < 3 &&
      p.querySelector('.ytp-interval-marker-a')?.style.display !== 'none',
      p.querySelector('[data-interval="delta"]')?.textContent);
    p.querySelector('.ytp-interval-reset-btn')?.click();
    await sleep(100);
  }

  // 5. Put the user's settings back before navigating away.
  await setRemaining(initialRemaining);
  await setMs(initialMs);
  check('user settings restored', msOn() === initialMs && remainingOn() === initialRemaining,
    `ms=${msOn()} remaining=${remainingOn()}`);

  // 6. SPA navigation: controls rebuilt once, previous interval gone.
  key('[', 'BracketLeft');
  const here = new URLSearchParams(location.search).get('v');
  const link = [...document.querySelectorAll('a[href^="/watch?v="]')]
    .find((a) => !a.getAttribute('href').includes(here));
  if (link) {
    link.click();
    for (let i = 0; i < 20 && new URLSearchParams(location.search).get('v') === here; i++) await sleep(500);
    await skipAds();
    await sleep(3000);
    const after = sels.map((s) => document.querySelectorAll(s).length);
    check('after SPA navigation: buttons once each, old interval cleared',
      after.every((n) => n === 1) && !document.querySelector('.ytp-interval-badge--visible'),
      `${location.search} buttons=${after.join(',')}`);
  } else {
    check('SPA navigation', false, 'no related-video link found');
  }
  document.querySelector('#movie_player video')?.pause();

  const failed = results.filter((r) => !r.ok);
  return {
    passed: results.length - failed.length, total: results.length, adBreaks,
    note: adBreaks ? 'ads interrupted the run — rerun before treating a failure as a bug' : undefined,
    failed, results,
  };
}
