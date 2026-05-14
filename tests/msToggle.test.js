// Tests the storage interaction logic used by the milliseconds toggle button.
// The button reads `showMilliseconds`, inverts it, and writes the new value back.
// This mirrors the handler in setupMillisecondsToggleButton() in js/content.js.

function makeStorageMock(initial = {}) {
  let store = { ...initial };
  return {
    get(keys) {
      const out = {};
      if (Array.isArray(keys)) {
        keys.forEach((k) => { if (k in store) out[k] = store[k]; });
      } else if (typeof keys === 'string') {
        if (keys in store) out[keys] = store[keys];
      }
      return Promise.resolve(out);
    },
    set(obj) {
      Object.assign(store, obj);
      return Promise.resolve();
    },
    _peek: () => ({ ...store }),
  };
}

// The exact toggle handler logic from setupMillisecondsToggleButton().
async function toggle(storage) {
  const data = await storage.get(['showMilliseconds']);
  const current = data.showMilliseconds !== false;
  await storage.set({ showMilliseconds: !current });
}

describe('milliseconds toggle storage logic', () => {
  test('flips true → false', async () => {
    const storage = makeStorageMock({ showMilliseconds: true });
    await toggle(storage);
    expect(storage._peek().showMilliseconds).toBe(false);
  });

  test('flips false → true', async () => {
    const storage = makeStorageMock({ showMilliseconds: false });
    await toggle(storage);
    expect(storage._peek().showMilliseconds).toBe(true);
  });

  test('absent key is treated as true (default), so first toggle writes false', async () => {
    const storage = makeStorageMock({});
    await toggle(storage);
    expect(storage._peek().showMilliseconds).toBe(false);
  });

  test('two toggles return to original value', async () => {
    const storage = makeStorageMock({ showMilliseconds: true });
    await toggle(storage);
    await toggle(storage);
    expect(storage._peek().showMilliseconds).toBe(true);
  });
});
