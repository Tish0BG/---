/**
 * The white-screen guard.
 *
 * There is one way this application can fail that leaves nothing at all on the
 * screen and nothing in the console a person could report: an `index.html` —
 * usually one an old service worker is still serving out of its cache — that
 * names a JavaScript bundle which is no longer next to it. The browser fetches
 * the only script the document has, gets a 404, and stops. No error, no
 * message, no app. "The site is white."
 *
 * The build already refuses to produce that. This is for the copies that were
 * produced before it did, and are still sitting in somebody's cache: if the
 * root is still empty a few seconds after load, the cached shell and the
 * worker that served it are thrown away and the page is loaded once more from
 * the network.
 *
 * Once. `sessionStorage` is what stops a genuinely broken deploy from becoming
 * a reload loop — if the second attempt is blank too, it stays blank, which is
 * at least a state somebody can describe.
 *
 * A separate file rather than an inline script because the
 * Content-Security-Policy allows no inline script, and a guard that only runs
 * when the page is already working would be no guard at all.
 */
(function () {
  var KEY = 'plauvia.recovered';

  function empty() {
    var root = document.getElementById('root');
    return !root || root.childElementCount === 0;
  }

  function recover() {
    if (!empty() || sessionStorage.getItem(KEY) === 'yes') return;
    try {
      sessionStorage.setItem(KEY, 'yes');
    } catch (e) {
      return; // no session storage means no way to stop a loop; do nothing
    }

    var done = function () {
      location.reload();
    };

    var jobs = [];
    if (window.caches && caches.keys) {
      jobs.push(
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }),
      );
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }),
      );
    }
    Promise.all(jobs).then(done, done);
  }

  // Long enough that a slow connection finishing its download is not mistaken
  // for a broken one, short enough that nobody sits looking at nothing.
  window.addEventListener('load', function () {
    setTimeout(recover, 6000);
  });

  // A boot that got far enough to draw something was not broken.
  window.addEventListener('plauvia:ready', function () {
    try {
      sessionStorage.removeItem(KEY);
    } catch (e) {
      /* private mode */
    }
  });
})();
