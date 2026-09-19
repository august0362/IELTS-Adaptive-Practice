import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../../components/theme/ThemeProvider";
import { ThemePicker } from "../../components/theme/ThemePicker";
import { computeThemeRoles, getThemeById } from "../../lib/theme";

const STORAGE_KEY = "ielts-app-theme";

describe("ThemePicker + ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.style.cssText = "";
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.style.cssText = "";
  });

  it("defaults to the 'Mặc định' theme and marks it as in use", () => {
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>
    );

    const defaultCard = screen.getByRole("button", { name: /Mặc định/ });
    expect(defaultCard).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the chosen theme's CSS variables to the document and persists it to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("button", { name: "Cold" }));

    const expectedRoles = computeThemeRoles(getThemeById("cold").colors);
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(expectedRoles.primary);
    expect(document.documentElement.style.getPropertyValue("--background")).toBe(expectedRoles.background);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("cold");

    // The picker itself should now show "Cold" as selected instead of "Mặc định".
    expect(screen.getByText("Cold").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Mặc định").closest("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("restores a previously-saved theme choice on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "ch-forest");

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: /Forest/ })).toHaveAttribute("aria-pressed", "true");
    const expectedRoles = computeThemeRoles(getThemeById("ch-forest").colors);
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(expectedRoles.primary);
  });

  it("falls back to the default theme if localStorage holds an unknown id", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-a-real-theme");

    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: /Mặc định/ })).toHaveAttribute("aria-pressed", "true");
  });
});
