export class ResizeController {
  private _resizeHandle: HTMLDivElement;
  private _resultsPanel: HTMLDivElement;
  private _resultsPanelHeight = 200;

  constructor(resizeHandle: HTMLDivElement, resultsPanel: HTMLDivElement) {
    this._resizeHandle = resizeHandle;
    this._resultsPanel = resultsPanel;
  }

  bind(): void {
    let startY = 0;
    let startH = 0;

    this._resizeHandle.addEventListener('mousedown', (e) => {
      startY = e.clientY;
      startH = this._resultsPanelHeight;
      this._resizeHandle.classList.add('dragging');

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        this._resultsPanelHeight = Math.max(60, Math.min(500, startH + delta));
        this._apply();
      };

      const onUp = () => {
        this._resizeHandle.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });

    this._apply();
  }

  private _apply(): void {
    this._resultsPanel.style.height = `${this._resultsPanelHeight}px`;
    this._resultsPanel.style.maxHeight = `${this._resultsPanelHeight}px`;
  }
}
