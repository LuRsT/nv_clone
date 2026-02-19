// Pure helpers for note content — no Electron, no fs, no side effects.

function firstNonEmptyLine(text) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

module.exports = { firstNonEmptyLine };
