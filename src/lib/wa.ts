// WhatsApp click-to-chat links (pure, safe in the browser too).
export const waDigits = (s: string) => s.replace(/\D/g, "");
export function waLink(number: string, text: string): string {
  return `https://wa.me/${waDigits(number)}?text=${encodeURIComponent(text)}`;
}
