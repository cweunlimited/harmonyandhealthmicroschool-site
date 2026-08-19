/* "Request Information" form: submits to /api/lead, fires the Meta "Lead"
 * pixel event once the API confirms success, then sends the family to the
 * /thank-you page. Keeps the visitor on our own domain the whole time, unlike
 * the old iframe embed. */
(function () {
  'use strict';

  var form = document.getElementById('leadForm');
  if (!form) return;

  var btn = document.getElementById('lf-submit');
  var status = document.getElementById('lf-status');

  function setStatus(msg, isError) {
    status.textContent = msg || '';
    status.className = 'lf-status' + (isError ? ' lf-error' : '');
  }

  /* Fire Lead against a confirmed submission. This previously lived on the
   * /thank-you page, where it counted anyone who loaded that page, including
   * revisits in a new session, so the pixel reported more leads than actually
   * arrived in the inbox. Tying it to a successful API response makes one Lead
   * mean one real enquiry.
   *
   * fbq is a no-op queue until fbevents.js loads, which only happens with
   * marketing consent, so this respects the consent gate exactly as before.
   * eventID gives Meta a key to dedupe against if a server-side copy is ever
   * added, and guards against a retry double-counting. */
  function trackLead() {
    try {
      if (typeof window.fbq !== 'function') return;
      var eventId = 'lead.' + Date.now() + '.' + Math.random().toString(36).slice(2, 10);
      window.fbq('track', 'Lead', {}, { eventID: eventId });
    } catch (e) {
      /* Tracking must never block the redirect. */
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('');

    var firstName = form.firstName.value.trim();
    var lastName = form.lastName.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();

    if (!firstName || !lastName || !email || !phone) {
      setStatus('Please fill in your first and last name, email, and phone number.', true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
      setStatus('Please enter a valid email address, like name@example.com.', true);
      form.email.focus();
      return;
    }
    var phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setStatus('Please enter a valid phone number, including the area code.', true);
      form.phone.focus();
      return;
    }

    var payload = {
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      // The form used to ask for the child's grade; it now asks which class or
      // program they are interested in. Read whichever field is present so an
      // older cached copy of a page keeps working.
      interest: (form.interest || form.grade || {}).value || '',
      message: form.message.value.trim(),
      company: form.company.value // honeypot
    };

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.ok) {
        trackLead();
        // Brief pause before navigating: a redirect fired in the same tick can
        // cancel the pixel's in-flight request and lose the event.
        setTimeout(function () { window.location.href = '/thank-you'; }, 350);
        return;
      }
      return res.json().catch(function () { return {}; }).then(function (data) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      });
    }).catch(function (err) {
      setStatus(err.message || 'Something went wrong. Please try again, or email info@harmonyandhealthmicroschool.com.', true);
      btn.disabled = false;
      btn.textContent = originalText;
    });
  });
})();
