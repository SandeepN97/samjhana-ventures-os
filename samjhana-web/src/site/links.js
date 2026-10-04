/**
 * Links in the website's editable content can be real addresses, in-page anchors, or two tokens the site
 * fills in from the contact details: "@whatsapp" and "@phone". Nothing else is ever turned into a link.
 */
export function resolveLink(href, contact = {}) {
  if (!href) return '';
  if (href === '@whatsapp') return contact.whatsapp ? `https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}` : '';
  if (href === '@phone') return contact.phone ? `tel:${String(contact.phone).replace(/[^\d+]/g, '')}` : '';
  return href;
}

export function isExternal(href) {
  return /^(https?:|tel:|mailto:)/.test(href);
}

export function whatsappLink(contact = {}, message = '') {
  const base = resolveLink('@whatsapp', contact);
  return base && message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function telLink(contact = {}) {
  return resolveLink('@phone', contact);
}

/** The embedded map address for a point, or empty when the contact has no usable coordinates. */
export function mapEmbedUrl(contact = {}) {
  const lat = Number(contact.latitude);
  const lng = Number(contact.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return '';
  return `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
}
