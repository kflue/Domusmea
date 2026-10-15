const HOUR_MS = 60 * 60 * 1000;

/**
 * Runs `check` now and then every `intervalMs` (hourly by default), never overlapping. A failed
 * check is logged and retried at the next one. `check` returns how many emails' worth of work it
 * did, logged with `name` when positive. Returns a function that stops the timer; the timer does
 * not keep the process alive.
 */
export function startPeriodicCheck(
  name: string,
  check: () => Promise<number>,
  intervalMs = HOUR_MS,
): () => void {
  let running = false;
  const run = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const count = await check();
      if (count > 0) {
        console.log(`${name}: email sent for ${count} entr${count === 1 ? 'y' : 'ies'}.`);
      }
    } catch (error) {
      console.error(`${name} failed; retrying at the next check.`, error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
