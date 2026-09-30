import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad · Atsui bets",
  description: "Qué datos usa Atsui bets y para qué.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <Link href="/login" className="text-sm text-muted hover:text-foreground">
        ← Atsui bets
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Política de privacidad</h1>
      <p className="mt-1 text-sm text-muted">Última actualización: 29 de septiembre de 2026</p>

      <div className="mt-6 space-y-6 leading-relaxed">
        <section>
          <h2 className="font-semibold">Qué es Atsui bets</h2>
          <p className="mt-1 text-muted">
            Atsui bets es una aplicación privada para una quiniela familiar de Liga MX, NFL y Fórmula 1.
            Solo pueden usarla las personas que un administrador registró en la quiniela.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Qué datos usamos</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li>
              De tu cuenta de Google: tu <strong>nombre</strong> y tu <strong>correo electrónico</strong>, solo
              para identificarte al iniciar sesión. No pedimos acceso a tu Gmail, tus contactos ni ningún otro
              dato de Google.
            </li>
            <li>
              De la quiniela: tu apodo, tus pronósticos (pics), tus puntos, y lo que debes o ganas en cada
              jornada.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Para qué los usamos</h2>
          <p className="mt-1 text-muted">
            Solo para que funcione la quiniela: saber quién eres, guardar tus pics, calcular las tablas y los
            premios, y llevar las cuentas de cada reunión. Los demás participantes de tu quiniela pueden ver tu
            apodo, tus puntos, tus premios y tus pics una vez que cierra cada partido.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Con quién los compartimos</h2>
          <p className="mt-1 text-muted">
            Con nadie. No vendemos ni compartimos datos, no mostramos publicidad y no usamos herramientas de
            rastreo. Los datos se guardan en Supabase (base de datos) y la aplicación se sirve desde Vercel, que
            solo los procesan para que la aplicación funcione.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Tus derechos</h2>
          <p className="mt-1 text-muted">
            Puedes pedirle al administrador de la quiniela que corrija tus datos o que borre tu cuenta. Borrar tu
            cuenta desliga tu acceso de Google; el historial de puntos y pagos de temporadas pasadas se conserva
            para que las cuentas de la quiniela sigan cuadrando.
          </p>
        </section>
      </div>
    </main>
  );
}
