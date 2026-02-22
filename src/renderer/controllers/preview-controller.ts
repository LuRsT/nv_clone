import type { marked as markedT } from 'marked'
import type DOMPurifyT from 'dompurify'

let markedFn: typeof markedT | null = null;
let purify: typeof DOMPurifyT | null = null;

async function loadDeps(): Promise<{ marked: typeof markedT; DOMPurify: typeof DOMPurifyT }> {
  if (markedFn && purify) return { marked: markedFn, DOMPurify: purify };
  const [markedMod, DOMPurifyMod] = await Promise.all([
    import('marked'),
    import('dompurify'),
  ]);
  markedMod.marked.use({
    async: false,
    renderer: {
      html() { return ''; },
    },
  });
  markedFn = markedMod.marked;
  purify = DOMPurifyMod.default;
  return { marked: markedFn, DOMPurify: purify };
}

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
    loadDeps().then(({ marked, DOMPurify }) => {
      try {
        this._preview.innerHTML = DOMPurify.sanitize(marked.parse(this._editor.value || '') as string);
      } catch {
        this._preview.textContent = 'Failed to render preview';
      }
    }).catch(() => {
      this._preview.textContent = 'Failed to load preview libraries';
    });
  }
}
