import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { PasswordResetService } from './password-reset.service';

const RESET_URL = '/api/auth/password-reset';
const EMAIL = 'ana@ual.es';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PasswordResetService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function accept(url: string, body: object): void {
    const request = http.expectOne(url);
    expect(request.request.body).toEqual(body);
    request.flush(null, { status: url === RESET_URL ? 202 : 204, statusText: 'OK' });
  }

  async function requestCode(): Promise<void> {
    const requested = service.requestCode(EMAIL);
    accept(RESET_URL, { email: EMAIL });
    await requested;
  }

  async function checkCode(code = '042137'): Promise<void> {
    const checked = service.checkCode(code);
    accept(`${RESET_URL}/verify`, { email: EMAIL, code });
    await checked;
  }

  it('requests the code and remembers the email', async () => {
    await requestCode();

    expect(service.email()).toBe(EMAIL);
    expect(service.hasVerifiedCode()).toBe(false);
  });

  it('resends the code to the same email', async () => {
    await requestCode();

    const resent = service.resendCode();
    accept(RESET_URL, { email: EMAIL });
    await resent;

    expect(service.email()).toBe(EMAIL);
  });

  it('keeps the code once it is checked', async () => {
    await requestCode();

    await checkCode();

    expect(service.hasVerifiedCode()).toBe(true);
  });

  it('does not keep a wrong code', async () => {
    await requestCode();

    const checked = service.checkCode('000000');
    http
      .expectOne(`${RESET_URL}/verify`)
      .flush(
        { '@type': 'Error', code: 'INVALID_VERIFICATION_CODE', status: '400' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(checked).rejects.toMatchObject({ code: 'INVALID_VERIFICATION_CODE' });
    await expect(checked).rejects.toBeInstanceOf(ApiError);
    expect(service.hasVerifiedCode()).toBe(false);
  });

  it('sends the email and the code with the new password, then forgets them', async () => {
    await requestCode();
    await checkCode();

    const reset = service.resetPassword('new-secret-password');
    accept(`${RESET_URL}/confirm`, {
      email: EMAIL,
      code: '042137',
      password: 'new-secret-password',
    });
    await reset;

    expect(service.email()).toBe('');
    expect(service.hasVerifiedCode()).toBe(false);
  });

  it('a new code request forgets the checked code', async () => {
    await requestCode();
    await checkCode();

    await requestCode();

    expect(service.hasVerifiedCode()).toBe(false);
  });
});
