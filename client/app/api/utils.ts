export function replacePlaceholders(template: string, values: string[]): string {
  return template.replace(/\[(\d+)\]/g, (_, index) => {
    const i = parseInt(index, 10) - 1;
    return values[i] ?? `[${index}]`; // fallback: leave as-is if no value
  });
}
