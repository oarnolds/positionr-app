import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">E-mail</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Gebruiker-ID</dt>
            <dd className="font-mono text-xs text-gray-500">{user?.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
