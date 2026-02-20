import { marked } from 'marked'
import DOMPurify from 'dompurify'

export class PreviewController {
  private _editor: HTMLTextAreaElement;
  private _preview: HTMLDivElement;
  private _previewMode = false;

  constructor(editor: HTMLTextAreaElement, preview: HTMLDivElement) {
    this._editor = editor;
    this._preview = preview;
  }

  get isActive(): boolean {
    return this._previewMode;
  }

  toggle(): void {
    this._previewMode = !this._previewMode;
    this._editor.hidden = this._previewMode;
    this._preview.hidden = !this._previewMode;
    if (this._previewMode) {
      this.render();
    } else {
      this._editor.focus();
    }
  }

  render(): void {
    this._preview.innerHTML = DOMPurify.sanitize(marked.parse(this._editor.value || '') as string);
  }
}
