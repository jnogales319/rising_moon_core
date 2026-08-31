const STORAGE_KEY = "resetPasswordSuccess";

// A query param would survive a bookmark or shared link, showing the
// "password reset" banner on a login page visit that never followed a
// reset. sessionStorage is single-use and never appears in the URL, so
// it can't be replayed that way.
export function markPasswordResetSuccess(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Best-effort: the login page just won't show the banner.
  }
}

export function consumePasswordResetSuccess(): boolean {
  let wasSet: boolean;
  try {
    wasSet = sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
  if (!wasSet) {
    return false;
  }

  // Cleanup is best-effort and separate from the read: a throwing
  // removeItem must not turn a real "flag was set" read into a false
  // negative, or leave the flag behind for a later, unrelated read to
  // pick up.
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return true;
}
