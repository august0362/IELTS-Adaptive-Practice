/**
 * Theme system: each ThemeDefinition carries 4 raw colors sourced from the
 * palette images in src/theme/ (Color Hunt exports + a few named light->dark
 * ramps). Colors are NOT assumed to be in any particular order (Color Hunt
 * palettes especially mix dark-first and light-first arrangements), so
 * `computeThemeRoles` derives usable UI roles from them by actual measured
 * luminance/saturation rather than by raw array position.
 *
 * Design rule (why background/foreground aren't just "the lightest/darkest
 * of the 4"): several source palettes are 4 close-lightness pastels with no
 * genuinely dark color at all (e.g. "Sorbet": ffeecc/ffddcc/ffcccc/febbcc) —
 * using such a palette's own extremes for body text would be unreadable.
 * So background/foreground stay a fixed safe light/dark neutral pair per
 * theme (decided by the palette's *average* luminance), and the palette's
 * character shows up in `primary` (buttons, active states — the most
 * saturated usable color) and `surface` (card tinting — closest to the
 * background's lightness tier, but still a distinct hue).
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: [string, string, string, string];
}

export interface ThemeRoles {
  background: string;
  foreground: string;
  surface: string;
  border: string;
  primary: string;
  primaryForeground: string;
  isDark: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG relative-luminance contrast ratio between two colors (1 = identical, 21 = black/white). */
function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** HSL as [hue 0-360, saturation 0-1, lightness 0-1]. */
function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const PRIMARY_MIN_LIGHTNESS = 0.32;
const PRIMARY_MAX_LIGHTNESS = 0.68;
const PRIMARY_MIN_SATURATION = 0.35;

/**
 * Picks the color best suited as a button/accent. Several source palettes
 * (the all-pastel Color Hunt ones especially) have no color that's both
 * saturated and mid-lightness — using one of those 4 hexes verbatim would
 * make for a washed-out, low-contrast "primary" that barely reads as a
 * button. In that case, keep the winning hue but synthesize a punchier
 * saturation/lightness for it instead of returning it unmodified.
 */
function pickPrimary(colors: string[]): string {
  const byHsl = colors.map((color) => ({ color, hsl: hexToHsl(color) }));
  byHsl.sort((a, b) => b.hsl[1] - a.hsl[1]); // highest saturation first
  const [hue, saturation, lightness] = byHsl[0].hsl;

  const isUsableAsIs =
    lightness >= PRIMARY_MIN_LIGHTNESS &&
    lightness <= PRIMARY_MAX_LIGHTNESS &&
    saturation >= PRIMARY_MIN_SATURATION;

  if (isUsableAsIs) return byHsl[0].color;

  const adjustedSaturation = Math.max(saturation, 0.55);
  const adjustedLightness = Math.min(Math.max(lightness, PRIMARY_MIN_LIGHTNESS), PRIMARY_MAX_LIGHTNESS);
  return hslToHex(hue, adjustedSaturation, adjustedLightness);
}

/** Picks the palette color whose lightness is closest to the target (e.g. 0.94 for a light theme's card surface). */
function pickClosestLightness(colors: string[], targetLightness: number): string {
  let best = colors[0];
  let bestDiff = Infinity;
  for (const color of colors) {
    const [, , l] = hexToHsl(color);
    const diff = Math.abs(l - targetLightness);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = color;
    }
  }
  return best;
}

export function computeThemeRoles(colors: [string, string, string, string]): ThemeRoles {
  const avgLuminance = colors.reduce((sum, c) => sum + relativeLuminance(c), 0) / colors.length;
  const isDark = avgLuminance < 0.4;

  const background = isDark ? "#0a0a0a" : "#ffffff";
  const foreground = isDark ? "#ededed" : "#171717";
  const surface = pickClosestLightness(colors, isDark ? 0.16 : 0.94);
  const border = surface;
  const primary = pickPrimary(colors);
  // Pick whichever fixed text color yields the higher contrast against `primary`,
  // rather than a flat relativeLuminance > 0.5 split: the actual crossover point
  // where black and white text achieve equal contrast is around luminance ~0.19,
  // not 0.5, so a 0.5 threshold misjudges every primary whose luminance falls in
  // the ~0.19-0.5 band (picking the *lower*-contrast of the two options there) —
  // caught by comparing several real theme primaries (e.g. "cold" #2196f3, "Ocean
  // Mist"/"Material Blue" mid-lightness blues) against real WCAG contrast ratios.
  const primaryForeground =
    contrastRatio(primary, "#111111") >= contrastRatio(primary, "#ffffff") ? "#111111" : "#ffffff";

  return { background, foreground, surface, border, primary, primaryForeground, isDark };
}

export const DEFAULT_THEME_ID = "default";

export const THEMES: ThemeDefinition[] = [
  { id: "default", name: "Mặc định", colors: ["#ffffff", "#f4f4f5", "#2563eb", "#171717"] },
  { id: "cold", name: "Cold", colors: ["#e3f0fb", "#93c9f5", "#2196f3", "#0e4c9b"] },
  { id: "dark-cold", name: "Dark Cold", colors: ["#afcffa", "#7c93f5", "#1c2fbe", "#0c1440"] },
  { id: "dark-winter", name: "Dark Winter", colors: ["#8bb897", "#2a8564", "#155450", "#0d2c30"] },
  { id: "fall", name: "Fall", colors: ["#e0a16e", "#fdedda", "#d2d3d5", "#80aebb"] },
  { id: "summer", name: "Summer", colors: ["#fdeacf", "#a1b27a", "#806d47", "#e99b79"] },
  { id: "winter", name: "Winter", colors: ["#7a7c68", "#b7b795", "#cecece", "#efefef"] },
  { id: "ch-ocean", name: "Ocean Mist", colors: ["#3368a0", "#66a3bf", "#c8dfdb", "#f2efe7"] },
  { id: "ch-violet-gold", name: "Violet Gold", colors: ["#3e0f8d", "#9564dd", "#e4da72", "#eeeeee"] },
  { id: "ch-forest", name: "Forest", colors: ["#499a13", "#bbdc12", "#8eca3c", "#276f27"] },
  { id: "ch-berry", name: "Berry", colors: ["#601d49", "#bd5579", "#ea9d9d", "#ffebb8"] },
  { id: "ch-material-blue", name: "Material Blue", colors: ["#e3f2fd", "#90caf9", "#2196f3", "#0d47a1"] },
  { id: "ch-mocha", name: "Mocha", colors: ["#e4e0e1", "#d6c0b3", "#ab886d", "#493628"] },
  { id: "ch-blush", name: "Blush Lavender", colors: ["#fbefef", "#ffe2e2", "#f5cbcb", "#c5b3d3"] },
  { id: "ch-pastel-mix", name: "Pastel Mix", colors: ["#fdf4d2", "#b0cde6", "#a290b7", "#946d6d"] },
  { id: "ch-coral-mint", name: "Coral Mint", colors: ["#ff9d9d", "#ffc5aa", "#eef8cd", "#bbf1d2"] },
  { id: "ch-peach-cream", name: "Peach Cream", colors: ["#ffdcdc", "#fff2eb", "#ffe8cd", "#ffd6ba"] },
  { id: "ch-sorbet", name: "Sorbet", colors: ["#ffeecc", "#ffddcc", "#ffcccc", "#febbcc"] },
  { id: "ch-sky-butter", name: "Sky Butter", colors: ["#fff2c6", "#fff8de", "#aac4f5", "#8ca9ff"] },
  { id: "ch-caramel", name: "Caramel", colors: ["#fff2d7", "#ffe0b5", "#f8c794", "#d8ae7e"] },
];

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
