/** The family's logo; a lighter red in dark mode so it reads on the dark background. */
export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/logo.png" alt="Atsui bets" width={550} height={518} className={className} />
    </picture>
  );
}
