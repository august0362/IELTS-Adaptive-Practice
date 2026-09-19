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
 * using such a palette's own extremes for body text would be unreadable. So
 * background/foreground stay a fixed safe near-white/near-black neutral pair,
 * and the palette's character shows up in `primary` (buttons, active states —
 * the most saturated usable color), `surface` (card tinting — a distinct hue,
 * see below for its own lightness), and `input` (text inputs/textareas —
 * always the palette's own *lightest* color, so a writing surface never reads
 * as unreadable/"turned off").
 *
 * **"Tách giao diện web/ứng dụng" (outer shell vs. inner content)**:
 * background/foreground are now a *single* fixed light pair for literally
 * every theme, dark ones included — they're the page-level "shell" (nav bar +
 * page background, and any text sitting directly on the page rather than
 * inside a themed card), and the shell no longer changes at all based on
 * which theme is picked. This used to instead pick between a light pair and a
 * near-black pair via `isDark`, which meant a "dark" theme blacked out the
 * *entire* page, nav bar included — reported complaint: "khi tôi để web giao
 * diện dark thì rất tối và khó nhìn" (when I set a dark theme it's very dark
 * and hard to see). `isDark` still exists and still decides one thing: how
 * light or dark `surface` (card backgrounds) renders for that theme — that's
 * the only place a "dark" theme's character lives now. Because `surface` can
 * still be dark-toned while `background`/`foreground` can't, text *inside* a
 * themed card needs its own role — see `surfaceForeground` below, picked the
 * same contrast-maximizing way as `primaryForeground`/`inputForeground`.
 * `surface`'s own dark-tier value is synthesized (not picked verbatim from
 * the palette) by `pickDarkSurface` — see its doc comment — to land on a
 * genuinely dark GRAY rather than the near-black a raw palette color would
 * give, per the explicit follow-up direction once the shell stopped going
 * dark: "Nền tối sáng hơn (xám đậm thay vì gần đen) + thêm glow/sheen nhẹ
 * trên card" (make dark surfaces lighter — dark gray, not near-black — and
 * add a subtle glow/sheen on cards); the glow/sheen half of that lives in
 * `.surface-glow` in `globals.css`, not here.
 *
 * `foreground` (body text) is a step further than a flat fixed pair, though:
 * it's the same fixed near-black *lightness* as always, but re-hued toward
 * the palette's own dominant hue at a very low saturation (see
 * `FOREGROUND_TINT_SATURATION`) — reported complaint: "màu chữ chỉ có trắng
 * với đen thôi, muốn đổi nó sao cho hợp với theme" (text color is only ever
 * black/white, want it to feel like it belongs to the theme). This keeps text
 * reading as "basically black" up close (WCAG AA against `background` is
 * asserted for every theme in theme.test.ts, not just eyeballed) while
 * subtly warming/cooling to match the theme when compared side by side.
 * `background` itself stays the literal fixed hex — tinting the much larger
 * background area risked looking like a colored page rather than "basically
 * white", which is what the pastel-palette design rule above depends on.
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
  surfaceForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  input: string;
  inputForeground: string;
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

const FOREGROUND_TINT_SATURATION = 0.06;

/**
 * Hue (0-360) of the palette's own most-saturated raw color — reused as the
 * theme's "dominant" hue for `foreground`'s tint. Deliberately the simplest
 * reasonable signal (mirrors the first step of `pickPrimary`'s own sort)
 * rather than an average across all 4 colors, which would blur toward gray
 * for exactly the all-pastel palettes where a clear hue matters most.
 */
function dominantHue(colors: string[]): number {
  const bySaturation = colors.map((color) => hexToHsl(color)).sort((a, b) => b[1] - a[1]);
  return bySaturation[0][0];
}

/**
 * Re-hues a fixed near-black/near-white neutral toward `hue` at a low,
 * capped `saturation`. Lightness is preserved exactly (only hue/saturation
 * change), so this is a *tint*, not a replacement — the near-black/near-white
 * character (and thus its WCAG contrast against the theme's fixed
 * background) barely moves.
 */
function tintNeutral(hex: string, hue: number, saturation: number): string {
  const [, , lightness] = hexToHsl(hex);
  return hslToHex(hue, saturation, lightness);
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

const INPUT_MIN_LIGHTNESS = 0.85;

/**
 * A text input / textarea should always read as a bright, legible "writing
 * surface" — never just inherit the page's `background`, which for a dark
 * theme is a fixed near-black. Picks the palette's own lightest color (so it
 * still varies per theme rather than being one flat white everywhere), with
 * a floor: if even the lightest of the 4 isn't bright enough, keep its hue
 * but lighten it further rather than let a dim input pass through.
 */
function pickInputBackground(colors: string[]): string {
  let lightest = colors[0];
  let lightestLightness = hexToHsl(colors[0])[2];
  for (const color of colors) {
    const lightness = hexToHsl(color)[2];
    if (lightness > lightestLightness) {
      lightest = color;
      lightestLightness = lightness;
    }
  }

  if (lightestLightness >= INPUT_MIN_LIGHTNESS) return lightest;

  const [hue, saturation] = hexToHsl(lightest);
  return hslToHex(hue, Math.min(saturation, 0.4), INPUT_MIN_LIGHTNESS);
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

const SURFACE_DARK_LIGHTNESS = 0.24;
const SURFACE_DARK_MAX_SATURATION = 0.32;

/**
 * Synthesizes a dark theme's card surface instead of picking one of the raw 4
 * colors verbatim. The old rule (`pickClosestLightness(colors, 0.16)`) picked
 * whichever raw color sat closest to near-black — for both currently-dark
 * themes ("Dark Cold", "Dark Winter") that's their own darkest raw color,
 * itself only ~0.12-0.15 lightness (see `src/theme/DarkColdColor.png` /
 * `DarkWinterColor.png`: a near-black band at one end of each ramp). Now that
 * `background`/`foreground` are a fixed light "page shell" pair for every
 * theme (see the module comment above), `surface` is the only place a dark
 * theme still reads as dark, so it has to carry that on its own — reported
 * complaint: "nền tối ... rất tối và khó nhìn" (dark surfaces are too dark,
 * hard to read), with the explicit follow-up direction "xám đậm thay vì gần
 * đen" (dark GRAY, not near-black). Anchors hue on the theme's own darkest
 * raw color (its clearest "shadow" tone) but re-renders it at a fixed,
 * lighter target lightness with a capped saturation — the same
 * lighten-in-HSL-space technique `pickInputBackground` already uses in the
 * other direction for the input role. Keeps "Dark Cold" reading navy-tinted
 * and "Dark Winter" reading teal-tinted without either looking like a vivid
 * saturated color card (too high a saturation cap) or a flat neutral gray
 * with no theme character at all (saturation capped at 0, i.e. no tint).
 */
function pickDarkSurface(colors: string[]): string {
  const darkest = colors.reduce((a, b) => (hexToHsl(a)[2] <= hexToHsl(b)[2] ? a : b));
  const [hue, saturation] = hexToHsl(darkest);
  return hslToHex(hue, Math.min(saturation, SURFACE_DARK_MAX_SATURATION), SURFACE_DARK_LIGHTNESS);
}

const LIGHT_COMPONENT_LUMINANCE = 0.4;

export function computeThemeRoles(colors: [string, string, string, string]): ThemeRoles {
  // A theme reads as "dark" only when MOST of its own 4 colors are dark — not
  // just because their *average* dips under a threshold. A palette like
  // "Forest" (499a13/bbdc12/8eca3c/276f27) averages to luminance ~0.37 despite
  // 2 of its 4 colors being clearly bright, vivid greens; averaging alone
  // misclassified it as full dark mode (near-black page background) when the
  // user reported it should read as a bright nature theme. Named-dark
  // palettes ("Dark Cold", "Dark Winter") still have only 1 of their 4 colors
  // qualify as light, so they're unaffected by this change.
  const lightComponentCount = colors.filter((c) => relativeLuminance(c) >= LIGHT_COMPONENT_LUMINANCE).length;
  const isDark = lightComponentCount < 2;

  // "Tách giao diện web/ứng dụng": background/foreground are the page-level
  // SHELL pair (nav bar + page background, and any text sitting directly on
  // the page rather than inside a themed card) — always the fixed light pair
  // now, for every theme including dark ones. This used to branch on `isDark`
  // too, which is what made picking a dark theme black out the whole page
  // (nav bar included), not just its cards — reported: "khi tôi để web giao
  // diện dark thì rất tối và khó nhìn". A dark theme's actual dark character
  // now lives entirely in `surface` (below), which still varies with
  // `isDark` — that's the "khung ngoài luôn sáng, chỉ nội dung bên trong đổi
  // theo theme" split the user asked for.
  const background = "#ffffff";
  const foreground = tintNeutral("#171717", dominantHue(colors), FOREGROUND_TINT_SATURATION);
  const surface = isDark ? pickDarkSurface(colors) : pickClosestLightness(colors, 0.94);
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

  const input = pickInputBackground(colors);
  const inputForeground = contrastRatio(input, "#111111") >= contrastRatio(input, "#ffffff") ? "#111111" : "#ffffff";

  // Text that sits *inside* a themed surface/card. Needed because — unlike
  // `background`/`foreground` above, which are now always the fixed light
  // shell pair — `surface` still varies light/dark per theme (that's the
  // point: dark-theme character lives there now), so a card's own text can no
  // longer just reuse the fixed `foreground`. Picked the same
  // contrast-maximizing way as `primaryForeground`/`inputForeground`: whichever
  // of #111111/#ffffff wins against `surface`.
  const surfaceForeground =
    contrastRatio(surface, "#111111") >= contrastRatio(surface, "#ffffff") ? "#111111" : "#ffffff";

  return {
    background,
    foreground,
    surface,
    surfaceForeground,
    border,
    primary,
    primaryForeground,
    input,
    inputForeground,
    isDark,
  };
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
