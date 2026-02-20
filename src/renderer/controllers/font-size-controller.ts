import { adjustFontSize, FONT_SIZE_DEFAULT } from '../app-logic'

export class FontSizeController {
  private _fontSize: number;

  constructor() {
    this._fontSize = parseInt(localStorage.getItem('app-font-size') ?? '', 10) || FONT_SIZE_DEFAULT;
  }

  change(delta: number): void {
    this._fontSize = adjustFontSize(this._fontSize, delta);
    localStorage.setItem('app-font-size', String(this._fontSize));
    this._apply();
  }

  apply(): void {
    this._apply();
  }

  private _apply(): void {
    document.documentElement.style.setProperty('--app-font-size', `${this._fontSize}px`);
  }
}
