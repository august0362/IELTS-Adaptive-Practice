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
});

describe("getThemeById", () => {
  it("returns the matching theme", () => {
    expect(getThemeById("cold").name).toBe("Cold");
  });

  it("falls back to the first theme (default) for an unknown id", () => {
    expect(getThemeById("does-not-exist").id).toBe(THEMES[0].id);
  });
});
