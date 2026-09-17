import { describe, expect, it } from "vitest";
import { computeThemeRoles, getThemeById, THEMES } from "../../lib/theme";

describe("computeThemeRoles", () => {
  it("keeps background/foreground a safe fixed light pair for an all-light pastel palette (no genuinely dark color)", () => {
    // "Sorbet": all 4 colors are light pastels — a naive lightest/darkest split
    // would produce unreadable near-white-on-near-white text.
    const roles = computeThemeRoles(["#ffeecc", "#ffddcc", "#ffcccc", "#febbcc"]);
    expect(roles.isDark).toBe(false);
    expect(roles.background).toBe("#ffffff");
    expect(roles.foreground).toBe("#171717");
  });

  it("picks a dark fixed background/foreground pair for a palette with low average luminance", () => {
    const roles = computeThemeRoles(["#0c1440", "#1c2fbe", "#7c93f5", "#afcffa"]);
    expect(roles.isDark).toBe(true);
    expect(roles.background).toBe("#0a0a0a");
    expect(roles.foreground).toBe("#ededed");
  });

  it("uses one of the 4 input colors as primary when it's already usable (saturated, mid-lightness)", () => {
    // #3368a0 is a mid-lightness, reasonably saturated blue — usable as-is.
    const colors: [string, string, string, string] = ["#3368a0", "#66a3bf", "#c8dfdb", "#f2efe7"];
    const roles = computeThemeRoles(colors);
    expect(colors.map((c) => c.toLowerCase())).toContain(roles.primary.toLowerCase());
  });

  it("synthesizes a punchier primary (same hue family, not a verbatim input color) when all 4 inputs are too pale/desaturated for a usable button", () => {
    // "Sorbet": all 4 are light, low-saturation pastels — none is a good filled-button color as-is.
    const colors: [string, string, string, string] = ["#ffeecc", "#ffddcc", "#ffcccc", "#febbcc"];
    const roles = computeThemeRoles(colors);
    expect(colors.map((c) => c.toLowerCase())).not.toContain(roles.primary.toLowerCase());
  });

  it("picks a readable primaryForeground for both a dark and a light primary", () => {
    const darkPrimaryRoles = computeThemeRoles(["#3e0f8d", "#9564dd", "#e4da72", "#eeeeee"]);
    // #3e0f8d is dark and saturated enough to plausibly win as primary; whichever wins,
    // primaryForeground must contrast with it.
    expect(["#111111", "#ffffff"]).toContain(darkPrimaryRoles.primaryForeground);
  });

  it("picks a surface color close to the background's lightness tier for a light theme", () => {
    const roles = computeThemeRoles(["#e3f2fd", "#90caf9", "#2196f3", "#0d47a1"]);
    expect(roles.isDark).toBe(false);
    // surface should be one of the 4 input colors and lighter than primary.
    expect(["#e3f2fd", "#90caf9", "#2196f3", "#0d47a1"]).toContain(roles.surface);
  });

  it("every defined theme produces valid hex roles without throwing", () => {
    for (const theme of THEMES) {
      const roles = computeThemeRoles(theme.colors);
      for (const value of [roles.background, roles.foreground, roles.surface, roles.primary, roles.primaryForeground]) {
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  // Regression test for a Milestone 4 review finding: primaryForeground was picked via a
  // flat `relativeLuminance(primary) > 0.5` split, but the actual crossover luminance where
  // black and white text reach equal WCAG contrast is ~0.19, not 0.5 — so any primary whose
  // luminance fell in the ~0.19-0.5 band got the *lower*-contrast text color. This hit 7 of
  // the 19 real shipped themes (e.g. "cold" #2196f3 paired with white text scored only
  // 3.12:1; "ch-material-blue" and "ch-mocha" scored ~2.2:1, below even the 3:1 floor for
  // large text/UI components). Fixed by picking whichever of #111111/#ffffff yields higher
  // contrast against the actual primary, which mathematically guarantees >= ~4.3:1 in the
  // worst case (the exact crossover point) for any primary color at all.
  it("guarantees WCAG AA contrast (>= 4.5:1) between primary and primaryForeground for every defined theme", () => {
    function relativeLuminance(hex: string): number {
      const clean = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
      const [rl, gl, bl] = [r, g, b].map((s) => (s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
      return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    }
    function contrastRatio(a: string, b: string): number {
      const l1 = relativeLuminance(a);
      const l2 = relativeLuminance(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    for (const theme of THEMES) {
      const roles = computeThemeRoles(theme.colors);
      const ratio = contrastRatio(roles.primary, roles.primaryForeground);
      expect(ratio, `theme "${theme.id}": primary=${roles.primary} primaryForeground=${roles.primaryForeground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("picks whichever fixed text color gives higher contrast, not a flat luminance>0.5 split", () => {
    // #2196f3 has relativeLuminance ~0.286 (between the true ~0.19 crossover and 0.5), so
    // the old ">0.5" rule picked white (3.12:1) when black (#111111) gives 6.04:1 — clearly
    // the better choice. Construct a theme where this color wins pickPrimary and assert the
    // fixed-up logic now chooses the higher-contrast option.
    const roles = computeThemeRoles(["#2196f3", "#e3f0fb", "#93c9f5", "#0e4c9b"]);
    expect(roles.primary).toBe("#2196f3");
    expect(roles.primaryForeground).toBe("#111111");
  });
});

describe("getThemeById", () => {
  it("returns the matching theme", () => {
    expect(getThemeById("cold").name).toBe("Cold");
  });

  it("falls back to the first theme (default) for an unknown id", () => {
    expect(getThemeById("does-not-exist").id).toBe(THEMES[0].id);
  });
});
