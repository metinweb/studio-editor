/**
 * Schedules overlay work that reads the editing document for the next animation frame. Failures
 * go to the editor's error handler (the watchdog), as they do for editor listeners, instead of
 * escaping as uncaught errors outside the restart logic.
 */
export function overlayFrame(engine, callback, source) {
  return requestAnimationFrame(() => (engine?.guard ? engine.guard(callback, source) : callback()))
}
