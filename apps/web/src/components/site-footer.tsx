import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 px-6 py-4 text-center text-xs text-gray-500">
      © {year} Rising Moon Productions ·{" "}
      <Link href="/license" className="underline">
        License
      </Link>
    </footer>
  );
}
