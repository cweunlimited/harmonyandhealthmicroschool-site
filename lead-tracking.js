/* ===========================================================================
 * Meta Pixel "Lead" tracking for embedded JotForm submissions
 * ---------------------------------------------------------------------------
 * The forms on this site (the Kaipod/Newton "Request Information" form on the
 * homepage, and the event RSVP forms) are cross-domain iframes hosted on
 * jotform.com. We cannot place tracking code inside them, so instead we listen
 * for the postMessage notifications the JotForm iframe sends up to this page,
 * and fire fbq('track', 'Lead') when one of them indicates a completed
 * submission.
 *
 * NOTE ON CONSENT: the Meta Pixel on this site is consent-gated by the Silktide
 * consent manager, so window.fbq only exists once a visitor has accepted
 * Marketing cookies. That is intentional. This script checks for fbq before
 * calling it, so a visitor who declined (or is running an ad blocker) simply
 * produces no Lead event instead of a JavaScript error.
 *
 * IF THE EVENT NEVER FIRES, the fallback options are:
 *   (a) Ask the form owner (Kaipod) to redirect the post-submit "thank you"
 *       page to a URL on our own domain, then fire the Lead event on that page
 *       load. This is the most reliable approach.
 *   (b) Switch from the iframe embed to JotForm's full "source code" embed, so
 *       the form lives directly in our page and its submit handler is
 *       reachable without postMessage.
 *
 * DEBUG is ON by default: every message received from a jotform.com origin is
 * logged with its raw payload, so we can confirm exactly what JotForm sends.
 * Set DEBUG to false once the Lead event is verified in Meta Events Manager.
 * ======================================================================== */
(function () {
  'use strict';

  // Verified 2026-07: this embed never announces a submission. The only
  // messages it sends are setHeight:* (resizing) and formSettled (finished
  // loading), then it redirects the top window to the form owner's domain.
  // Lead is therefore fired on /thank-you instead. This listener is kept as a
  // no-op safety net in case a future embed version does announce submissions.
  var DEBUG = false;              // set true to log raw JotForm payloads again
  var leadFired = false;          // fire at most once per page load

  // Substrings that indicate a completed submission. Matched case-insensitively
  // against a letters-only version of the payload, so colon-delimited strings
  // ("submission-success:12345") and camelCase ("formSubmissionSuccess") both
  // match, while resize chatter ("setHeight:600:12345") does not.
  var SUBMIT_PATTERNS = [
    'formsubmissionsuccess',
    'submissioncompleted',
    'submissionsuccess',
    'submitcompleted',
    'formsubmitted',
    'submissiondone',
    'submitted'
  ];

  function isJotFormOrigin(origin) {
    try {
      var host = new URL(origin).hostname.toLowerCase();
      // Exact apex or a genuine subdomain. Avoids matching look-alikes such as
      // "evil-jotform.com.attacker.net".
      return host === 'jotform.com' || host.indexOf('.jotform.com', host.length - 12) !== -1;
    } catch (e) {
      return false;
    }
  }

  // JotForm sends different payload shapes depending on embed version: a plain
  // string, or a structured object. Pull out the fields worth matching on.
  function candidateText(data) {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      var fields = ['action', 'type', 'event', 'eventName', 'message', 'name', 'status'];
      var parts = [];
      for (var i = 0; i < fields.length; i++) {
        if (typeof data[fields[i]] === 'string') parts.push(data[fields[i]]);
      }
      return parts.join(' ');
    }
    return '';
  }

  function looksLikeSubmission(text) {
    var normalized = String(text).toLowerCase().replace(/[^a-z]/g, '');
    if (!normalized) return false;
    for (var i = 0; i < SUBMIT_PATTERNS.length; i++) {
      if (normalized.indexOf(SUBMIT_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  function fireLead(reason) {
    if (leadFired) {
      if (DEBUG) console.log('[LeadTracking] Duplicate submission signal ignored:', reason);
      return;
    }
    if (typeof window.fbq !== 'function') {
      if (DEBUG) {
        console.warn(
          '[LeadTracking] Submission detected, but window.fbq is unavailable ' +
          '(Marketing cookies declined, or blocked by an ad blocker). ' +
          'No Lead event sent. Signal was:', reason
        );
      }
      return;
    }
    leadFired = true;
    window.fbq('track', 'Lead');
    if (DEBUG) console.log('[LeadTracking] fbq("track", "Lead") FIRED. Signal was:', reason);
  }

  window.addEventListener('message', function (event) {
    if (!isJotFormOrigin(event.origin)) return;

    if (DEBUG) {
      console.log(
        '[LeadTracking] Message from ' + event.origin +
        ' | typeof: ' + (typeof event.data) + ' | raw payload:', event.data
      );
    }

    var text = candidateText(event.data);
    if (text && looksLikeSubmission(text)) fireLead(text);
  }, false);

  if (DEBUG) {
    console.log('[LeadTracking] Listener active. Watching for JotForm submissions.');
  }
})();
