const RELOAD_DELAY_MS = 1200;

let scheduled = false;

export function beginUpdate(
  persist: () => Promise<void>,
  notify: () => void,
  reload: () => void,
): void {
  if (scheduled) return;
  scheduled = true;
  notify();
  void persist().finally(() => {
    setTimeout(reload, RELOAD_DELAY_MS);
  });
}
