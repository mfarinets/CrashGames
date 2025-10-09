const IOS_IPHONE_REGEX = /iPhone/i;

let loadPromise = null;
let hapticApi = null;
let isSupported = false;

function isIosIphone() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || '';
  return IOS_IPHONE_REGEX.test(userAgent);
}

async function loadHapticsModule() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!isIosIphone()) return false;
    try {
      const module = await import('https://esm.sh/ios-haptics');
      if (module?.supportsHaptics && module?.haptic) {
        isSupported = Boolean(module.supportsHaptics);
        hapticApi = isSupported ? module.haptic : null;
        return isSupported && Boolean(hapticApi);
      }
    } catch {
      // Ignore network or runtime errors; fall through to return false.
    }
    isSupported = false;
    hapticApi = null;
    return false;
  })();
  return loadPromise;
}

export async function prepareHaptics() {
  return loadHapticsModule();
}

function invokeHaptic(action) {
  if (!isIosIphone()) return;
  void loadHapticsModule().then((ready) => {
    if (!ready || !hapticApi) return;
    try {
      action(hapticApi);
    } catch {
      // Swallow runtime errors to keep gameplay unaffected.
    }
  });
}

export function playImpact() {
  invokeHaptic((api) => {
    if (typeof api === 'function') {
      api();
    }
  });
}

export function playConfirm() {
  invokeHaptic((api) => {
    if (typeof api?.confirm === 'function') {
      api.confirm();
      return;
    }
    if (typeof api === 'function') {
      api();
    }
  });
}

export function playError() {
  invokeHaptic((api) => {
    if (typeof api?.error === 'function') {
      api.error();
      return;
    }
    if (typeof api === 'function') {
      api();
    }
  });
}
