import { ThemePicker } from "@/components/theme/ThemePicker";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cài đặt giao diện</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Chọn bảng màu bạn thích — áp dụng ngay cho toàn bộ ứng dụng, được nhớ cho lần sau.
        </p>
      </div>

      <ThemePicker />
    </main>
  );
}
