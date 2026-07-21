/* Click-to-load Google Maps embed.
   Privacy-friendly: nothing at all is requested from Google (no cookies, no
   IP shared) until the visitor actively presses "Show map". The address text
   and its plain Google Maps link remain available to everyone regardless. */
document.addEventListener('click', function (e) {
  if (!e.target || !e.target.closest) return;

  var btn = e.target.closest('.footer-map-btn');
  if (!btn) return;

  var src = btn.getAttribute('data-map-embed');
  if (!src) return;

  var iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = 'Map showing Harmony and Health Microschool at 9670 SW 72nd Street, Miami, FL 33173';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.setAttribute('allowfullscreen', '');

  btn.replaceWith(iframe);
});
