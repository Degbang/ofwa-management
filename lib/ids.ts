export function makeReadableId(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-${stamp}-${token}`;
}
