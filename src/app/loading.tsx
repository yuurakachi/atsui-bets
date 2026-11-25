import { Logo } from "./logo";
import { Bone } from "./skeleton";

export default function HomeLoading() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <p role="status" className="sr-only">
        Cargando…
      </p>
      <header className="flex items-center gap-3">
        <Logo className="h-auto w-24 shrink-0" />
        <div className="flex-1">
          <Bone className="h-4 w-20 rounded-md" />
          <Bone className="mt-2 h-9 w-40 rounded-md" />
        </div>
      </header>
      <Bone className="mt-8 h-5 w-24 rounded-md" />
      <Bone className="mt-3 h-20" />
      <Bone className="mt-2 h-20" />
      <Bone className="mt-8 h-16" />
      <Bone className="mt-8 h-5 w-32 rounded-md" />
      <Bone className="mt-3 h-16" />
      <Bone className="mt-2 h-16" />
    </main>
  );
}
