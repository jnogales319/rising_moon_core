export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-3xl font-semibold">Rising Moon</h1>
        <p className="max-w-md text-gray-600">
          Character sheets, dice, and campaigns for the Fate tabletop RPG
          system.
        </p>
      </main>
      <footer className="p-6 text-center text-xs text-gray-500">
        This is an unofficial fan tool for the Fate system, used under the Fate
        SRD license. Not affiliated with or endorsed by Evil Hat Productions.
      </footer>
    </div>
  );
}
