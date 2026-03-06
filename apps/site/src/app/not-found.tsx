export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-forge-950 px-4 text-center">
      <p className="font-ui text-xs uppercase tracking-[0.3em] text-ember">404 — Exile Lost</p>
      <h1 className="mt-4 font-display text-6xl font-black text-parchment">Wraeclast is Vast</h1>
      <p className="mt-4 max-w-sm font-body text-parchment-muted">
        This page does not exist — or was consumed by the void. Check your path and try again.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex h-10 items-center rounded-sm border border-ember bg-ember px-6 font-ui text-sm font-semibold tracking-wide text-forge-950 transition-all hover:bg-ember-light"
      >
        Return to the Codex
      </a>
    </main>
  )
}
