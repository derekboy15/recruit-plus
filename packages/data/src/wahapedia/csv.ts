export type Row = Record<string, string>;

/** Parse a Wahapedia export file: UTF-8 with BOM, pipe-delimited, each line ends with '|'. */
export function parseWahapediaCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const cells = line.split('|');
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };
  const header = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}
