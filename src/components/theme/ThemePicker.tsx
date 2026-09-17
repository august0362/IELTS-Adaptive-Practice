"use client";

import { useTheme } from "./ThemeProvider";
import { THEMES, computeThemeRoles } from "@/lib/theme";

export function ThemePicker() {
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEMES.map((theme) => {
        const roles = computeThemeRoles(theme.colors);
        const isSelected = theme.id === themeId;

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => setThemeId(theme.id)}
            aria-pressed={isSelected}
            className={`flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all ${
              isSelected ? "shadow-md" : "hover:shadow-sm"
            }`}
            style={{
              background: roles.background,
              borderColor: isSelected ? roles.primary : roles.border,
            }}
          >
            <div className="flex gap-1">
              {theme.colors.map((color) => (
                <span key={color} className="h-6 flex-1 rounded" style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: roles.foreground }}>
                {theme.name}
              </span>
              {isSelected && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: roles.primary, color: roles.primaryForeground }}
                >
                  Đang dùng
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
