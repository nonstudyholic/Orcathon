import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_TAGLINE } from "@/config";

const STEPS = [
  { n: "01", title: "Upload", text: "Add a before and an after satellite image of the same place, or try the built-in demo." },
  { n: "02", title: "Detect", text: "Your browser compares both images pixel by pixel and highlights what changed." },
  { n: "03", title: "Explain", text: "AI labels each change, tells natural from human-made, and scores its confidence." },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <section className="relative py-14 sm:py-24">
        <div className="hero-orb right-0 top-6 hidden h-72 w-72 lg:block xl:right-10 xl:h-96 xl:w-96" aria-hidden="true" />

        <div className="relative max-w-2xl">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(45,212,191,0.9)]" aria-hidden="true" />
            Satellite change detection
          </span>

          <h1 className="text-gradient mt-6 text-5xl font-semibold tracking-tight sm:text-7xl">{APP_NAME}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{APP_TAGLINE}</p>

          <div className="mt-9 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link href="/dashboard/analyze" className="btn-primary px-6 py-3">
                  Open analyzer
                </Link>
                <Link href="/dashboard" className="btn-ghost px-6 py-3">
                  Scan history
                </Link>
              </>
            ) : (
              <>
                <Link href="/login?mode=signup" className="btn-primary px-6 py-3">
                  Create account
                </Link>
                <Link href="/login" className="btn-ghost px-6 py-3">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section aria-label="How it works" className="grid gap-4 pb-10 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="card p-6">
            <p className="text-sm font-semibold tracking-widest text-accent">{s.n}</p>
            <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
