import { signOut } from "@/app/auth/actions";
import { requireAccount } from "@/lib/dal";

export default async function NoAccessPage() {
  const { email } = await requireAccount();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold">Todavía no estás en la quiniela</h1>
        <p className="mt-3 text-muted">
          La cuenta <span className="font-medium text-foreground">{email}</span> no está registrada.
          Pídele a un admin que te agregue con este correo y vuelve a entrar.
        </p>
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-medium transition hover:border-accent"
          >
            Entrar con otra cuenta
          </button>
        </form>
      </div>
    </main>
  );
}
