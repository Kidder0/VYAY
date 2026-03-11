const { parsePhoneNumberFromString } = require('libphonenumber-js');

function normalizeToE164(phoneRaw, defaultCountry = 'US') {
  let raw = String(phoneRaw || '').trim();

  // remove spaces, dashes, parentheses etc (keep + and digits)
  raw = raw.replace(/[^\d+]/g, '');

  // handle "10 digits" without +1 (US)
  // Example: 9401234567 => parse with US
  const phone = parsePhoneNumberFromString(raw, defaultCountry);

  if (!phone || !phone.isValid()) {
    throw new Error('Invalid phone number');
  }

  return phone.number; // E.164 like +19401234567
}

module.exports = { normalizeToE164 };