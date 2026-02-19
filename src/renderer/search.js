/**
 * filterNotes — pure function, no side effects, no browser globals.
 *
 * @param {Array<{title: string, excerpt: string, mtime: number}>} notes
 * @param {string} query
 * @returns {Array}
 */
function filterNotes(notes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return notes; // already sorted by mtime desc from main process

  return notes.filter((note) => {
    return (
      note.title.toLowerCase().includes(q) ||
      note.excerpt.toLowerCase().includes(q)
    );
  });
}

module.exports = { filterNotes };
