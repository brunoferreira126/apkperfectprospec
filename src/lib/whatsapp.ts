export function whatsappUrl(phone: string, message = ""): string {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  const text = message.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${international}${text}`;
}
