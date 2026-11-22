import { COVERED_MODAL_CLASS, presentOverParent } from './modal-stack.util';

describe('presentOverParent', () => {
  function fakeModal(): {
    modal: HTMLIonModalElement;
    present: ReturnType<typeof vi.fn>;
    dismiss: () => void;
  } {
    let dismiss = (): void => undefined;
    const willDismiss = new Promise<void>((resolve) => {
      dismiss = resolve;
    });
    const present = vi.fn().mockResolvedValue(undefined);
    const modal = { present, onWillDismiss: () => willDismiss } as unknown as HTMLIonModalElement;
    return { modal, present, dismiss };
  }

  afterEach(() => document.body.replaceChildren());

  it('hides the window underneath while the new one is open', async () => {
    const parent = document.createElement('ion-modal');
    const host = document.createElement('button');
    parent.append(host);
    document.body.append(parent);
    const { modal, present, dismiss } = fakeModal();

    await presentOverParent(modal, host);

    expect(present).toHaveBeenCalled();
    expect(parent.classList).toContain(COVERED_MODAL_CLASS);
    dismiss();
    await Promise.resolve();
    await Promise.resolve();
    expect(parent.classList).not.toContain(COVERED_MODAL_CLASS);
  });

  it('only opens it when it is not inside another window', async () => {
    const host = document.createElement('button');
    document.body.append(host);
    const { modal, present } = fakeModal();

    await presentOverParent(modal, host);

    expect(present).toHaveBeenCalled();
    expect(document.querySelector(`.${COVERED_MODAL_CLASS}`)).toBeNull();
  });
});
