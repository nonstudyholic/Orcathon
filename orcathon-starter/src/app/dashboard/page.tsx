import { createClient } from "@/lib/supabase/server";
import ItemsBoard from "@/components/ItemsBoard";
import type { Item } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Create, edit, and organize your items.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          Could not load items: {error.message}. Check that you ran supabase/schema.sql in your project.
        </p>
      ) : (
        <ItemsBoard items={(data ?? []) as Item[]} />
      )}
    </div>
  );
}
