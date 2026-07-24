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
const TEAM = 'info@harmonyandhealthmicroschool.com';
const BOOKING = 'https://calendar.app.google/SV24SpsTbCqi8ncg9';
const LOGO = 'https://harmonyandhealthmicroschool.com/logo-main.png';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function welcomeEmail(firstName) {
  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:600px;margin:0 auto;line-height:1.65;font-size:16px;">' +
      '<p>Hi ' + firstName + ',</p>' +
      "<p>Thank you so much for your interest in Harmony and Health Microschool! Our names are Chris and Monika, and we're so excited to connect with you.</p>" +
      '<p>As educators and parents, we believe that education should be built around the whole child. Instead of asking kids to sit still at a desk all day, our K-5 microschool intentionally integrates music, mindful movement, and outdoor play right into our daily curriculum. Because we cap our enrollment at just 15 students, we actually have the time to help your child process big emotions, regulate their nervous system, and truly rediscover the joy of learning.</p>' +
      "<p>I'd love to schedule a quick, casual phone call just to learn more about your family, your student, and what you are looking for.</p>" +
      '<p>You can grab a time that works best for you right here: <a href="' + BOOKING + '" style="color:#5730C6;">' + BOOKING + '</a></p>' +
      '<p>You can also reach us directly via email at: <a href="mailto:info@harmonyandhealthmicroschool.com" style="color:#5730C6;">info@harmonyandhealthmicroschool.com</a><br>' +
      'Or give us a call at: (786) 505-0768</p>' +
      "<p>Looking forward to hearing your family's story!</p>" +
      '<p>Warmly,<br>Chris and Monika<br>Founders, Harmony and Health Microschool</p>' +
      '<p style="text-align:center;margin-top:32px;">' +
        '<img src="' + LOGO + '" alt="Harmony and Health Microschool" width="200" style="max-width:200px;height:auto;">' +
      '</p>' +
    '</div>'
  );
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set.');
      return res.status(500).json({ error: 'Our form is not fully set up yet. Please email info@harmonyandhealthmicroschool.com.' });
    }

    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: email,
        replyTo: TEAM,
        subject: 'Hello from Harmony and Health Microschool!',
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
