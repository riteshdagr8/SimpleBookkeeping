import { PaletteGrid } from "@/components/palette-grid";

export default function ThemeSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Theme</h1>
        <p className="text-sm text-fg-muted">
          Choose a color palette. Your selection is saved to your account and applies to every page instantly.
        </p>
      </div>
      <PaletteGrid />
    </div>
  );
}
