export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  upper: /[A-ZΑ-Ω]/,
  lower: /[a-zα-ω]/,
  number: /[0-9]/,
  symbol: /[^A-Za-zΑ-Ωα-ω0-9\s]/
});

export function validatePassword(password='') {
  const checks = {
    length: password.length >= PASSWORD_POLICY.minLength,
    upper: PASSWORD_POLICY.upper.test(password),
    lower: PASSWORD_POLICY.lower.test(password),
    number: PASSWORD_POLICY.number.test(password),
    symbol: PASSWORD_POLICY.symbol.test(password)
  };
  return { valid: Object.values(checks).every(Boolean), checks };
}

export function passwordPolicyMessage(locale='el') {
  return locale === 'en'
    ? 'Use at least 12 characters with uppercase, lowercase, number and symbol.'
    : 'Χρησιμοποιήστε τουλάχιστον 12 χαρακτήρες με κεφαλαίο, πεζό, αριθμό και σύμβολο.';
}
