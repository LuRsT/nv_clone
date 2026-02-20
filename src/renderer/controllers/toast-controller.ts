export class ToastController {
  private _toast: HTMLDivElement;
  private _toastTimer: ReturnType<typeof setTimeout> | null = null;
  private _toastHideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(toast: HTMLDivElement) {
    this._toast = toast;
  }

  show(message: string): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (this._toastHideTimer) clearTimeout(this._toastHideTimer);
    this._toast.textContent = message;
    this._toast.hidden = false;
    // Force reflow so the transition fires even on rapid successive calls.
    this._toast.getBoundingClientRect();
    this._toast.classList.add('visible');
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible');
      this._toastHideTimer = setTimeout(() => { this._toast.hidden = true; }, 150);
    }, 2000);
  }
}
