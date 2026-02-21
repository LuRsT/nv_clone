const SHORTCUTS: [string, string][] = [
  ['F1 / Ctrl+?', 'Show this help'],
  ['↑ / ↓', 'Navigate results'],
  ['Enter', 'Open / create note'],
  ['Tab', 'Jump to editor'],
  ['Escape', 'Back to search / clear'],
  ['Ctrl+J / K', 'Navigate results (global)'],
  ['Ctrl+P', 'Toggle preview'],
  ['Ctrl+R', 'Rename note'],
  ['Ctrl+D', 'Delete note'],
  ['Ctrl+Delete', 'Delete note'],
  ['Ctrl++ / -', 'Zoom in / out'],
  ['Ctrl+0', 'Reset font size'],
  ['Ctrl+W', 'Delete word backward'],
];

export class HelpController {
  private _overlay: HTMLDivElement;
  private _visible = false;

  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'help-overlay';

    const panel = document.createElement('div');
    panel.className = 'help-panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Keyboard Shortcuts';
    panel.appendChild(heading);

    const table = document.createElement('table');
    for (const [key, desc] of SHORTCUTS) {
      const tr = document.createElement('tr');
      const tdKey = document.createElement('td');
      tdKey.className = 'help-key';
      tdKey.textContent = key;
      const tdDesc = document.createElement('td');
      tdDesc.textContent = desc;
      tr.appendChild(tdKey);
      tr.appendChild(tdDesc);
      table.appendChild(tr);
    }
    panel.appendChild(table);
    this._overlay.appendChild(panel);
    document.body.appendChild(this._overlay);

    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.toggle();
    });
  }

  get isVisible(): boolean { return this._visible; }

  toggle(): void {
    this._visible = !this._visible;
    this._overlay.classList.toggle('visible', this._visible);
  }
}
