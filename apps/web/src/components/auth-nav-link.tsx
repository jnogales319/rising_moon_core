"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthNavLink({
  loggedIn,
  displayName,
}: {
  loggedIn: boolean;
  displayName: string | null;
}) {
  const pathname = usePathname();

  if (loggedIn) {
    return <span>{displayName}</span>;
  }

  if (pathname === "/login") {
    return null;
  }

  return (
    <Link href="/login" className="underline hover:no-underline">
      Log in
    </Link>
  );
}
