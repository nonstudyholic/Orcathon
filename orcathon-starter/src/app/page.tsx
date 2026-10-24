import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_TAGLINE } from "@/config";

// HACKATHON: replace this landing page with your product pitch.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="py-16 sm:py-24">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">{APP_NAME}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">{APP_TAGLINE}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {user ? (
          <Link href="/dashboard" className="btn-primary">
            Open dashboard
          </Link>
        ) : (
          <>
            <Link href="/login?mode=signup" className="btn-primary">
              Create account
            </Link>
            <Link href="/login" className="btn-ghost">
              Log in
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
