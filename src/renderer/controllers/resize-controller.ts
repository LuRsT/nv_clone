const PANEL_HEIGHT_MIN = 60;
const PANEL_HEIGHT_MAX = 500;
const PANEL_HEIGHT_DEFAULT = 200;
const STORAGE_KEY = 'panel-height';

export class ResizeController {
  private _resizeHandle: HTMLDivElement;
  private _resultsPanel: HTMLDivElement;
  private _resultsPanelHeight: number;
  private _onMouseDown: ((e: MouseEvent) => void) | null = null;

  constructor(resizeHandle: HTMLDivElement, resultsPanel: HTMLDivElement) {
    this._resizeHandle = resizeHandle;
    this._resultsPanel = resultsPanel;
    const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
    this._resultsPanelHeight = (saved >= PANEL_HEIGHT_MIN && saved <= PANEL_HEIGHT_MAX)
      ? saved
      : PANEL_HEIGHT_DEFAULT;
  }

  bind(): void {
    let startY = 0;
    let startH = 0;

    this._onMouseDown = (e: MouseEvent) => {
      startY = e.clientY;
      startH = this._resultsPanelHeight;
      this._resizeHandle.classList.add('dragging');

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        this._resultsPanelHeight = Math.max(PANEL_HEIGHT_MIN, Math.min(PANEL_HEIGHT_MAX, startH + delta));
        this._apply();
      };

      const onUp = () => {
        this._resizeHandle.classList.remove('dragging');
        localStorage.setItem(STORAGE_KEY, String(this._resultsPanelHeight));
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    };

    this._resizeHandle.addEventListener('mousedown', this._onMouseDown);
    this._apply();
  }

  destroy(): void {
    if (this._onMouseDown) {
      this._resizeHandle.removeEventListener('mousedown', this._onMouseDown);
      this._onMouseDown = null;
    }
  }

  private _apply(): void {
    this._resultsPanel.style.height = `${this._resultsPanelHeight}px`;
    this._resultsPanel.style.maxHeight = `${this._resultsPanelHeight}px`;
  }
}
