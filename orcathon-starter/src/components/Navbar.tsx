import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/config";

export default async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-3 w-3 rounded-full bg-accent" aria-hidden="true" />
          {APP_NAME}
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard/analyze" className="btn-ghost">
                Analyze
              </Link>
              <Link href="/dashboard" className="btn-ghost">
                Dashboard
              </Link>
              <span className="hidden max-w-[12rem] truncate text-sm text-muted md:inline" title={user.email}>
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-ghost">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
