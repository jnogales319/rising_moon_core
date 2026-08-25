import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-accent/70 px-6 py-4 text-center text-xs text-muted">
      © {year} Rising Moon Productions ·{" "}
      <Link href="/license" className="underline">
        License
      </Link>
    </footer>
  );
}
