import AuthForm from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const { mode, error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm py-10">
      <AuthForm initialMode={mode === "signup" ? "signup" : "login"} initialError={error} />
    </div>
  );
}
