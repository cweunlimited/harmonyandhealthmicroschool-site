/* Serverless lead-inquiry handler (Vercel).
 * Receives the "Request Information" form, then via Resend:
 *   1. sends the family an instant branded welcome email, and
 *   2. sends the founders a notification with the lead's details.
 * The Meta "Lead" pixel event fires separately, on the /thank-you page the
 * browser redirects to after this returns success.
 *
 * Requires the RESEND_API_KEY environment variable (set in the Vercel
 * dashboard) and a domain verified in Resend so mail can be sent from
 * @harmonyandhealthmicroschool.com.
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Harmony and Health Microschool <info@harmonyandhealthmicroschool.com>';
// Personal-looking sender for the family welcome note. Reading as a person
// rather than a brand keeps Gmail from filing it under the Promotions tab.
const FROM_WELCOME = 'Chris and Monika at Harmony and Health Microschool <info@harmonyandhealthmicroschool.com>';
const TEAM = 'info@harmonyandhealthmicroschool.com';
const BOOKING = 'https://calendar.app.google/SV24SpsTbCqi8ncg9';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* The family welcome note. Deliberately plain and personal: no logo image, no
 * template container, one plain link, conversational copy, and a matching
 * plain-text part (see welcomeText). This keeps Gmail from tagging it
 * "Promotions" and lands it in the Primary inbox, where a note from a real
 * person belongs. */
function welcomeEmail(firstName) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#222;">' +
      '<p>Hi ' + firstName + ',</p>' +
      "<p>Thanks so much for reaching out. I'm Chris, and Monika and I started Harmony and Health Microschool together, so I wanted to say hello personally.</p>" +
      "<p>We'd love to hear a little about your family and what you're hoping to find for your child. The easiest next step is a short, casual phone call. If you'd like to pick a time that works for you, you can grab one here:</p>" +
      '<p><a href="' + BOOKING + '">' + BOOKING + '</a></p>' +
      "<p>Or just reply to this email or call us at (786) 505-0768, whatever's easiest. Either way, we'll be in touch soon.</p>" +
      "<p>We keep the school small on purpose, just fifteen students, so we have the time to really know every child. We can't wait to learn your family's story.</p>" +
      '<p>Warmly,<br>Chris and Monika<br>Harmony and Health Microschool<br>(786) 505-0768</p>' +
    '</div>'
  );
}

function welcomeText(firstName) {
  return [
    'Hi ' + firstName + ',',
    '',
    "Thanks so much for reaching out. I'm Chris, and Monika and I started Harmony and Health Microschool together, so I wanted to say hello personally.",
    '',
    "We'd love to hear a little about your family and what you're hoping to find for your child. The easiest next step is a short, casual phone call. If you'd like to pick a time that works for you, you can grab one here:",
    '',
    BOOKING,
    '',
    "Or just reply to this email or call us at (786) 505-0768, whatever's easiest. Either way, we'll be in touch soon.",
    '',
    "We keep the school small on purpose, just fifteen students, so we have the time to really know every child. We can't wait to learn your family's story.",
    '',
    'Warmly,',
    'Chris and Monika',
    'Harmony and Health Microschool',
    '(786) 505-0768'
  ].join('\n');
}

function notifyEmail(d) {
  var row = function (label, value) {
    return '<tr><td style="padding:6px 12px 6px 0;vertical-align:top;color:#555;"><strong>' + label +
      '</strong></td><td style="padding:6px 0;">' + value + '</td></tr>';
  };
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#333;font-size:15px;line-height:1.6;">' +
      '<h2 style="color:#3A1B72;margin:0 0 12px;">New inquiry from the website</h2>' +
      '<table style="border-collapse:collapse;">' +
        row('Name', esc(d.firstName) + ' ' + esc(d.lastName)) +
        row('Email', '<a href="mailto:' + esc(d.email) + '" style="color:#5730C6;">' + esc(d.email) + '</a>') +
        row('Phone', esc(d.phone)) +
        row("Child's grade", esc(d.grade) || '&mdash;') +
        row('Message', esc(d.message).replace(/\n/g, '<br>') || '&mdash;') +
      '</table>' +
      '<p style="color:#777;font-size:13px;margin-top:18px;">Reply to this email to respond directly to the family. Remember to add them to Newton.</p>' +
    '</div>'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    var body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // Honeypot: real people never fill "company". Bots do. Pretend success.
    if (body.company) return res.status(200).json({ ok: true });

    var firstName = String(body.firstName || '').trim();
    var lastName = String(body.lastName || '').trim();
    var email = String(body.email || '').trim();
    var phone = String(body.phone || '').trim();
    var grade = String(body.grade || '').trim();
    var message = String(body.message || '').trim();

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({ error: 'Please fill in your first and last name, email, and phone number.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    var phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'Please enter a valid phone number, including the area code.' });
    }
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set.');
      return res.status(500).json({ error: 'Our form is not fully set up yet. Please email info@harmonyandhealthmicroschool.com.' });
    }

    await Promise.all([
      resend.emails.send({
        from: FROM_WELCOME,
        to: email,
        replyTo: TEAM,
        subject: 'Thanks for reaching out, ' + firstName,
        text: welcomeText(firstName),
        html: welcomeEmail(esc(firstName))
      }),
      resend.emails.send({
        from: FROM,
        to: TEAM,
        replyTo: email,
        subject: ('New inquiry: ' + firstName + ' ' + lastName).trim(),
        html: notifyEmail({ firstName: firstName, lastName: lastName, email: email, phone: phone, grade: grade, message: message })
      })
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Lead submission failed:', err);
    return res.status(500).json({ error: 'Something went wrong sending your request. Please try again, or email info@harmonyandhealthmicroschool.com.' });
  }
}
