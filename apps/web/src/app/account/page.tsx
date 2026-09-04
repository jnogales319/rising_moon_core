import Link from "next/link";

export default function AccountPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-4xl font-semibold">Account</h1>
      <Link href="/account/password" className="underline hover:no-underline">
        Change your password
      </Link>
    </main>
  );
}
