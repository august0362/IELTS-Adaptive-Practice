export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vòng quay kỹ năng</h1>
      <p className="max-w-md text-sm text-foreground/60">
        Vòng quay sẽ chọn 2/4 kỹ năng và tự động quay ra part/task tương ứng. (Đang xây dựng ở bước tiếp theo.)
      </p>
    </main>
  );
}
