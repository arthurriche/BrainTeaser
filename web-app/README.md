# Enigmate Web

Version web en cours de construction pour l'application Enigmate. Ce dossier contient une base Next.js (App Router, TypeScript, Tailwind 4) configurée pour consommer Supabase et reproduire l'expérience mobile.

## Prérequis
- Node.js 20+
- npm (fourni avec Node)
- Un projet Supabase configuré avec les tables/edge functions du backend (`backend/supabase`)

## Configuration
1. Dupliquez `.env.example` en `.env.local` ; renseignez les variables :
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   ```
2. Vérifiez que la fonction edge `riddle_today` est déployée (cf. `backend/supabase/functions/riddle_today`).
3. Dans Supabase, mettez à jour les URL de redirection OAuth LinkedIn pour inclure :
   - `https://votre-domaine/auth/callback`
   - `http://localhost:3000/auth/callback` (pour le dev)

## Lancer le projet
```bash
npm install
npm run dev
```

- Dev : `http://localhost:3000`
- La page d'accueil affiche soit le module d'authentification (email / LinkedIn), soit l'écran d'introduction à l'énigme.

## Structure actuelle
```
src/
  app/
    page.tsx                 # Bascule Auth ↔ Riddle selon session Supabase
    auth/callback/page.tsx   # Feedback après retour OAuth
    auth/password-reset/...  # Formulaire de nouveau mot de passe
    riddle/page.tsx          # Gabarit futur pour l'écran de résolution
  components/
    providers/SupabaseProvider.tsx  # Contexte session + client Supabase
    auth/AuthView.tsx                # UI d'authentification
    riddle/RiddleIntro.tsx           # Ecran d'intro, fetch edge function
  lib/
    supabaseClient.ts                # Singleton Supabase
```

## Fonctionnalités déjà portées
- Authentification email/mot de passe et inscription.
- Lancement OAuth LinkedIn (redirige vers `/auth/callback`).
- Réinitialisation de mot de passe (page dédiée, mise à jour via Supabase).
- Chargement de l'énigme du jour en appelant la fonction edge `riddle_today` + récupération du titre via PostgREST.

## Prochaines étapes suggérées
1. **Écran `/riddle` complet** :
   - Timer réactif (hook `useInterval`) reprenant `RiddleTimer`.
   - Mise en page détaillée (question, indices, image plein écran).
2. **Conversation avec le Maître** :
   - Reprise du `ConversationManager` (simulation locale) ou persistance via table `chats`.
   - Interface modale / panneau latéral avec auto-scroll et indicateur de frappe.
3. **Gestion des scores** : stocker résultats dans `scores` (API Supabase `insert/update`).
4. **Notifications** : remplacer `UNUserNotificationCenter` par Web Push ou rappels in-app.
5. **Tests & CI** : Playwright/Cypress pour auth + parcours d'une énigme, lint automatique.

## Déploiement
- Vercel conseillé (`npm run build` utilise Turbopack). Vérifiez les variables d'environnement côté production.
- Configurez la redirection Supabase vers `https://votre-domaine/auth/callback` et `https://votre-domaine/auth/password-reset`.

## Publication GitHub
Pour publier ce dossier dans un dépôt :
```bash
git init
git add .
git commit -m "chore: init enigmate web"
# Créez ensuite le dépôt sur GitHub et poussez-y ce contenu.
```
