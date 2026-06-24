"use client";

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const rawText = String(value);
  const text = /^[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>, columns?: string[]) {
  if (!rows.length) return columns?.join(",") ?? "";
  const keys = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const header = keys.map(escapeCsvCell).join(",");
  const body = rows.map((row) => keys.map((key) => escapeCsvCell(row[key])).join(","));
  return [header, ...body].join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, columns?: string[]) {
  downloadTextFile(filename, `\uFEFF${rowsToCsv(rows, columns)}`, "text/csv;charset=utf-8");
}
