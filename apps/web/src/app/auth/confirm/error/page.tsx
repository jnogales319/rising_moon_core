export default function ConfirmError() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">Confirmation failed</h1>
      <p className="text-sm text-red-600">
        This confirmation link is invalid or has expired.
      </p>
    </main>
  );
}
