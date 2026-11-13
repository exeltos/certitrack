import { describe, it, expect } from 'vitest';
import { authCallbackTarget, RESET_PATH } from '../../src/lib/authRedirect';

const at = (pathname: string, hash = '', search = '') => ({ pathname, hash, search });

describe('authCallbackTarget', () => {
  it('sends a recovery link that landed on the home page to the reset page, keeping the tokens', () => {
    expect(authCallbackTarget(at('/', '#access_token=abc&refresh_token=def&type=recovery')))
      .toBe(`${RESET_PATH}#access_token=abc&refresh_token=def&type=recovery`);
    expect(authCallbackTarget(at('/index.html', '#access_token=abc&type=recovery'))).toMatch(/^\/pages\/auth\/reset-password\.html#/);
  });
  it('sends an expired link to the reset page, which explains it', () => {
    expect(authCallbackTarget(at('/', '#error=access_denied&error_code=otp_expired&error_description=x')))
      .toBe(`${RESET_PATH}#error=access_denied&error_code=otp_expired&error_description=x`);
  });
  it('does nothing on the reset page itself or for ordinary URLs', () => {
    expect(authCallbackTarget(at(RESET_PATH, '#access_token=abc&type=recovery'))).toBeNull();
    expect(authCallbackTarget(at('/pages/organization/partner.html', '', '?id=1&tab=mine'))).toBeNull();
    expect(authCallbackTarget(at('/', '#main'))).toBeNull();
  });
});
