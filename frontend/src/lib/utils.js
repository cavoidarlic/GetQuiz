/**
 * Utility for merging class names.
 * Lightweight implementation — no tailwind-merge needed since this project uses vanilla CSS.
 */
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
