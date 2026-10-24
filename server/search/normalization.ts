export function normalizeSearchText(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizePhone(value?: string | null): string | undefined {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

export function normalizeDomain(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLocaleLowerCase("pt-BR").replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}
