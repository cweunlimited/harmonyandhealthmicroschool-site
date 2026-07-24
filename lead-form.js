/* "Request Information" form: submits to /api/lead, then sends the family to
 * the /thank-you page (where the Meta "Lead" pixel event fires). Keeps the
 * visitor on our own domain the whole time, unlike the old iframe embed. */
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatus('');

    var firstName = form.firstName.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();

    if (!firstName || !email || !phone) {
      setStatus('Please fill in your name, email, and phone number.', true);
      return;
    }

    var payload = {
      firstName: firstName,
      lastName: form.lastName.value.trim(),
      email: email,
      phone: phone,
      grade: form.grade.value,
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
        // Success. The Lead pixel event fires on /thank-you.
        window.location.href = '/thank-you';
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
