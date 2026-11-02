import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { IdentityCheck } from './identity-check';

describe('IdentityCheck', () => {
  let fixture: ComponentFixture<IdentityCheck>;
  let component: IdentityCheck;
  let requestCode: ReturnType<typeof vi.fn>;
  let verifyCode: ReturnType<typeof vi.fn>;
  let verified: string[];

  function render(requirementKeys: string[] = []): HTMLElement {
    requestCode = vi.fn().mockResolvedValue(undefined);
    verifyCode = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [IdentityCheck],
      providers: [provideIonicAngular(), provideTestingTransloco()],
    });
    fixture = TestBed.createComponent(IdentityCheck);
    fixture.componentRef.setInput('requestCode', requestCode);
    fixture.componentRef.setInput('verifyCode', verifyCode);
    fixture.componentRef.setInput('requirementKeys', requirementKeys);
    fixture.componentRef.setInput('requirementsTitleKey', 'title.key');
    component = fixture.componentInstance;
    verified = [];
    component.verified.subscribe((code) => verified.push(code));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => vi.useRealTimers());

  it('starts asking to send the code, with the requirements when there are any', () => {
    const root = render(['first.requirement', 'second.requirement']);

    expect(component.step()).toBe('request');
    expect(root.querySelectorAll('.identity-check__requirements li')).toHaveLength(2);
    expect(root.textContent).toContain('title.key');
  });

  it('shows no requirements card without requirements', () => {
    const root = render();

    expect(root.querySelector('.identity-check__requirements')).toBeNull();
  });

  it('sends the code and waits 60 seconds before resending it', async () => {
    vi.useFakeTimers();
    render();

    await component.handleSendCode();

    expect(requestCode).toHaveBeenCalledTimes(1);
    expect(component.step()).toBe('code');
    expect(component.secondsToResend()).toBe(60);
    await component.handleSendCode();
    expect(requestCode).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(component.secondsToResend()).toBe(0);
    expect(component.resendTime()).toBe('00:00');
  });

  it('stays on the first step and says why when the code cannot be sent', async () => {
    render();
    requestCode.mockRejectedValue(new ApiError('ACCOUNT_HAS_ACTIVE_TRIPS', 409));

    await component.handleSendCode();

    expect(component.step()).toBe('request');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.isSending()).toBe(false);
  });

  it('checks a complete code and reports it when it is right', async () => {
    render();
    await component.handleSendCode();

    component.code.setValue('12345');
    await component.handleVerify();
    expect(verifyCode).not.toHaveBeenCalled();

    component.code.setValue('123456');
    await component.handleVerify();

    expect(verifyCode).toHaveBeenCalledWith('123456');
    expect(verified).toEqual(['123456']);
  });

  it('shows a wrong code and clears the error when the code changes', async () => {
    render();
    await component.handleSendCode();
    verifyCode.mockRejectedValue(new ApiError('INVALID_VERIFICATION_CODE', 400));

    component.code.setValue('111111');
    await component.handleVerify();
    expect(component.errorMessage()).toBeTruthy();
    expect(verified).toEqual([]);

    component.code.setValue('11111');
    expect(component.errorMessage()).toBeNull();
  });

  it('asks for a new code after too many attempts', async () => {
    render();
    await component.handleSendCode();
    verifyCode.mockRejectedValue(new ApiError('TOO_MANY_ATTEMPTS', 429));

    component.code.setValue('222222');
    await component.handleVerify();

    expect(component.needsNewCode()).toBe(true);
    expect(component.code.value).toBe('');
    expect(component.secondsToResend()).toBe(0);
    expect(component.errorMessage()).toBeTruthy();

    await component.handleSendCode();
    expect(requestCode).toHaveBeenCalledTimes(2);
    expect(component.needsNewCode()).toBe(false);
  });
});
