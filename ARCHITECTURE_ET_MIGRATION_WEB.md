# Enigmate — Architecture actuelle et plan de migration vers le web

## 1. Panorama du dépôt
- `backend/supabase/` : configuration Supabase (base de données Postgres, stockage, edge functions).
- `iOS/` : application SwiftUI pour iPhone/iPad (entrée `EnigmateApp.swift`).
- `web-app/` : squelette Next.js (migration web en cours).
- `Ressources/` : assets non compilés (images d'énigmes, portraits, logos).
- `API_DOCUMENTATION.md` : référence des endpoints pensés pour le client.

## 2. Backend Supabase
### 2.1 Modèle de données (`backend/supabase/migrations/20250626214753_initial_structure.sql`)
- **Tables principales** : `riddles` (énigmes quotidiennes), `chats` (historique de conversation par utilisateur/énigme), `scores` (résultat et temps par utilisateur/énigme).
- **Contraintes** : clés étrangères sur `auth.users` pour lier chats et scores à un utilisateur Supabase ; identités générées automatiquement.
- **Politique RLS** :
  - `riddles` : lecture publique limitée aux énigmes dont `release_date <= CURRENT_DATE`.
  - `chats` et `scores` : accès restreint à `auth.uid()` (chaque utilisateur ne voit que ses données).
- **Droits** : rôles `anon`, `authenticated`, `service_role` autorisés sur les trois tables (lecture/écriture selon besoin du client).

### 2.2 Jeu de données (`backend/supabase/seed.sql`)
- Trois énigmes de démonstration (IDs 1, 2, 5) avec question, réponse détaillée, image associée et date de publication.
- Aucune donnée d'authentification préchargée : comptes créés depuis le client.

### 2.3 Edge Function `riddle_today` (`backend/supabase/functions/riddle_today/index.ts`)
- Déployée sur Deno Edge Runtime ; injecte `SUPABASE_URL` et `SUPABASE_ANON_KEY` via variables d'environnement.
- Recherche l’énigme du jour (`release_date == today UTC`) et renvoie `{ id, question, imageURL }`.
- Pour le développement local, mappe quelques IDs vers des URLs signées Supabase Storage (bucket `riddle-images`).
- Réponse JSON 404 si aucune énigme n’est trouvée.

## 3. Application iOS SwiftUI
### 3.1 Cycle de vie (`iOS/EnigmateApp.swift`)
- Initialise `SupabaseService` (acteur Swift Concurrency) au lancement et l’injecte dans l’environnement SwiftUI via `.environment(\.supabase, …)`.
- Écoute les URLs profondes `enigmate://` pour compléter un OAuth LinkedIn ou une réinitialisation de mot de passe et, si besoin, affiche `PasswordResetView`.

### 3.2 Service Supabase (`iOS/Services/SupabaseService.swift`)
- **Acteur thread-safe** encapsulant `SupabaseClient`.
- Fournit :
  - Authentification email/mot de passe (`signIn`, `signUp`, `resetPassword`, `updatePassword`).
  - OAuth LinkedIn avec redirection custom `enigmate://login-callback`.
  - Gestion des sessions (`currentSession`, `authStateStream`, listeners internes) pour sync UI.
  - Lecture de l’énigme du jour (`todaysRiddle`), basée sur `date` côté base.
  - Téléchargement d’images depuis le bucket `riddle-images` (`downloadPuzzleImageData`).
- Utilise `Logger` pour trace détaillée.

### 3.3 Injection environnementale (`iOS/Services/SupabaseEnvironment.swift`)
- Définit des `EnvironmentKey` pour `supabase` (service asynchronous) et `showPasswordReset` (binding utilisé par `ContentView`).

### 3.4 Authentification UI
- `ContentView` (`iOS/Views/ContentView.swift`) écoute `supabase.authStateStream()` :
  - Session nulle → `AuthView` (écran de connexion).
  - Session active → `RiddleIntroView`.
- `AuthView` (`iOS/Views/Auth/AuthView.swift`) propose boutons LinkedIn / email.
- `EmailAuthView` (`iOS/Views/Auth/EmailAuthView.swift`) gère connexion/inscription avec validations locales, toggles de visibilité, liens « mot de passe oublié ».
- `PasswordResetView` (`iOS/Views/Auth/PasswordResetView.swift`) permet de définir un nouveau mot de passe après deep link Supabase.
- Boutons stylisés via `MainButton` & `MainButtonStyle` (`iOS/Views/SharedViews.swift`).

### 3.5 Écran d’introduction des énigmes (`iOS/Views/Riddle/RiddleIntroView.swift`)
- Charge l’énigme du jour via `supabase.todaysRiddle()`, télécharge l’image correspondante (conversion `UIImage` → `Image`).
- Affiche titre, image, durée estimée (`duration` en secondes), difficulté (convertie par `Riddle.getDifficultyString()`), compteur de jours restants.
- Bouton « Start » ouvre `RiddleView`.

### 3.6 Lecture de l’énigme & conversation (`iOS/Views/Riddle/RiddleView.swift`)
- Télécharge l’énigme et son image puis démarre un compte à rebours `RiddleTimer` (par défaut 45 minutes si valeur manquante).
- Section principale : titre, image, question.
- Section « The Master » + bouton message ouvre `ConversationView` (sheet pleine hauteur).
- `ConversationManager` (`iOS/Models/ChatMessage.swift`) simule échanges : ajoute message utilisateur, lance délai aléatoire (1.5–3s), renvoie réponse piochée parmi dix suggestions.
- `ConversationView` (`iOS/Views/Riddle/ConversationView.swift`) rend l’historique, indicateur de frappe, champ de saisie en bas. Se base sur `ScrollViewReader` pour auto-scroll.

### 3.7 Gestion du timer (`iOS/Utilities/RiddleTimer.swift`)
- Objet `ObservableObject` déclenchant un `Timer.scheduledTimer` (1s).
- Expose `timeRemaining`, `totalDuration`, états `isActive`/`isFinished`, pourcentage restant et format `MM:SS`.
- Méthodes `start`, `pause`, `resume`, `stop`, `addTime`.

### 3.8 Utilitaires et styles
- `Fonts.swift` et `SharedViews.swift` unifient la typographie (`SFCompactRounded`) et composants (fond dégradé, boutons).
- `SharedFunctions.swift` propose `dismissKeyboard()` et formatage de date.
- `SupabaseManager.swift` : singleton simple pour `SupabaseClient` (semble résiduel vs `SupabaseService`).
- `Notifications.swift` : planification locale d’une notification « Come back! » 10 secondes après sortie (non intégré au flux principal).

## 4. Flux global utilisateur
1. **Lancement** : `EnigmateApp` crée le service, fournit les environnements.
2. **Auth** : `ContentView` affiche `AuthView` jusqu’à présence d’une session.
3. **Accueil énigme** : `RiddleIntroView` télécharge contenu + image depuis Supabase (table + bucket).
4. **Lecture** : `RiddleView` présente l’énigme, déclenche le timer et autorise conversation simulée.
5. **Chat** : `ConversationView` gère messages via `ConversationManager` (pas d’échange réseau réel pour l’instant).
6. **Backend** : la seule fonction edge publique est `riddle_today`; toutes les autres interactions passent par le client Supabase.

## 5. Plan de transformation vers une application web
### 5.1 Choisir la stack web
- Framework recommandé : React/Next.js, Remix, ou SvelteKit (faciles à coupler avec Supabase via `@supabase/supabase-js`).
- Conserver Supabase comme backend (tables, storage, edge function déjà prêts).

### 5.2 Initialiser le projet web
- Générer un projet (`npx create-next-app`, `npm create vite@latest`, etc.).
- Installer `@supabase/supabase-js`, gestionnaire d’état (Context API, Zustand, Redux Toolkit…) et librairie UI (Tailwind, Chakra, Mantine, DaisyUI…).
- Configurer variables d’environnement (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### 5.3 Porter `SupabaseService`
- Créer un **SupabaseClient singleton** (`createClient`) et l’exposer via un `SupabaseContext` React (ou équivalent) qui fournit :
  - Session courante (`supabase.auth.getSession()`).
  - Stream d’auth (`supabase.auth.onAuthStateChange`).
  - Fonctions utilitaires : `signInWithPassword`, `signUp`, `signInWithOAuth({ provider: 'linkedin_oidc' })`, `resetPasswordForEmail`, `updateUser`.
  - Fetch de l’énigme du jour (requête PostgREST sur `riddles` ou appel de l’edge function `riddle_today`).
  - Téléchargement d’images (`supabase.storage.from('riddle-images').createSignedUrl(...)`).
- Migrer les logs `Logger` vers `console`/`Sentry`/`PostHog` selon besoin.

### 5.4 Recréer les vues SwiftUI côté web
1. **Layout global** : gradient de fond + conteneur principal → CSS/SCSS/utility classes.
2. **Accueil / Auth** :
   - Page login avec boutons LinkedIn + email.
   - Modale/onglets pour switcher « Sign In / Sign Up » avec validations (regex email, longueur mot de passe) côté client.
   - Gestion du deep link : redirections Supabase doivent pointer vers une URL publique (ex. `https://votredomaine.com/auth/callback`).
3. **Écran d’intro** :
   - Composant `RiddleIntro` qui fetch l’énigme dès que la session est établie.
   - Utiliser `useEffect` pour charger l’image (via `createSignedUrl` ou `getPublicUrl`).
   - Bouton « Start » → route `/riddle` (Next.js) ou navigation SPA.
4. **RiddleView** :
   - Timer via `useEffect` + `setInterval`, contrôler `timeRemaining` et nettoyer l’intervalle au démontage.
   - Mise en page scrollable pour l’énigme et la section « The Master ».
5. **ConversationView** :
   - Panneau latéral ou modal, `position: fixed`/`dialog`. Historique via `map` et `ref` pour auto-scroll (`scrollIntoView`).
   - Reproduire avatars, bulles, indicateur de frappe avec CSS animations.
6. **Gestion du clavier/Focus** : transformer `dismissKeyboard()` en gestion du focus (`inputRef.current?.blur()`).

### 5.5 Adapter les fonctionnalités spécifiques iOS
- **Notifications locales** : remplacer par Web Push (Service Workers) ou par simple bannière in-app.
- **Fonts** : intégrer `SF Compact Rounded` via `@font-face` ou Google Fonts alternative (ex. `Nunito`, `Manrope`).
- **Animations** : utiliser CSS transitions/Framer Motion pour reproduire `withAnimation`.
- **Gestion du temps** : convertir `TimeInterval` en millisecondes, manipuler `Date` avec `dayjs`/`date-fns` pour cohérence fuseau.

### 5.6 Consolider la logique métier
- Envisager de porter `ConversationManager` côté backend (fonction edge) si l’on souhaite des réponses dynamiques. Pour l’instant, implémenter un générateur pseudo-aléatoire côté client JS.
- Implémenter la persistance des conversations et scores via appels Supabase (`insert/update` sur `chats` et `scores`). Actuellement la version iOS ne les consomme pas encore.

### 5.7 Sécurité et déploiement
- Vérifier les politiques RLS couvrant bien les cas web (les tokens publics du navigateur sont équivalents aux mobile).
- Configurer les redirections OAuth LinkedIn dans la console Supabase/LinkedIn Developer (URL web au lieu de schéma iOS).
- Déploiement : Vercel/Netlify/Cloudflare Pages pour le front, Supabase gère déjà l’infra backend.

### 5.8 Tests & monitoring
- Mettre en place tests UI/interaction (Playwright/Cypress) pour valider auth, chargement d’énigme, timer.
- Surveiller les quotas d’URL signées pour les images ; éventuellement servir des URLs publiques.

## 6. Points d’attention lors de la migration
- **Gestion du fuseau horaire** : l’app iOS utilise l’heure locale + offset maison (`yesterday`/`now`). Sur le web, forcer la comparaison en UTC ou utiliser `release_date` + `timezone` cohérent pour éviter désynchronisation.
- **Simultanéité** : SwiftUI repose sur `@MainActor`; en JS, éviter les race conditions en mémorisant la dernière requête en cours (`AbortController`).
- **Accessibilité** : prévoir navigation clavier, attributs ARIA pour la conversation et les boutons (non nécessaire sur iOS natif).
- **Performance** : limiter les `signedUrl` générés côté client (mettre un TTL suffisant, caching).

## 7. Prochaines étapes rapides
1. Installer un squelette Next.js + Supabase et valider la connexion (login email/password).
2. Porter la récupération d’énigmes (table + images) et reproduire l’écran d’introduction.
3. Recréer le timer + conversation fake pour assurer la parité fonctionnelle de base.
4. Étendre ensuite vers la persistance des chats/scores et les notifications web.

