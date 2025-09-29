import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enigmate — Résolution",
};

export default function RiddlePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Étape de résolution
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Le duel avec le Maître
          <span className="block bg-gradient-to-r from-primary via-emerald-500 to-primary bg-clip-text text-transparent">
            Arrive bientôt sur le web
          </span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Nous travaillons à reproduire l'expérience immersive de l'app iOS — timer, indices progressifs et interface de conversation avec le Maître.
        </p>
      </header>

      <section className="grid gap-6 rounded-3xl border border-border bg-white p-10 text-muted-foreground shadow-xl">
        <p className="text-base leading-relaxed">
          • Chronomètre réactif inspiré du `RiddleTimer` SwiftUI (gestion pause/reprise, seuil d'urgence).<br />
          • Zone de discussion reprenant le style bulle de la landing page avec avatars et indicateur de frappe.<br />
          • Persistances des messages dans Supabase (`chats`) et sauvegarde des performances (`scores`).
        </p>

        <p className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-sm text-primary">
          L'objectif : offrir la même énergie lumineuse et stimulante que la Landing Page, tout en exploitant les fondations Supabase existantes.
        </p>
      </section>
    </div>
  );
}
