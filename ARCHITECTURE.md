# Quiz Blocks — Architecture du projet

> Plugin Obsidian de quiz interactifs avec éditeur intégré.

---

## Racine

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `main.js` | 2 | Point d'entrée, re-exporte `plugin.js` |
| `esbuild.config.mjs` | 95 | Build esbuild (JS + CSS bundle, watch mode) |
| `package.json` | 16 | Dépendances : `json5`, `esbuild` |

---

## `src/` — Code source

### `src/plugin.js` — 334 lignes

Point d'entrée du plugin Obsidian. Enregistre le `QuizBlocksPlugin` :
- Settings tab
- Code block processor (`quiz` / `quiz-exam`)
- Commands palette
- Editor mode (Quiz Builder)

---

### `src/engine.js` — 747 lignes

Orchestrateur principal. Crée et gère le cycle de vie d'un quiz :
- Parse le bloc de code (YAML/JSON)
- Initialise l'état (`state.js`)
- Monte le DOM, lance le rendu
- Coordonne interactions, navigation, soumission

---

### `src/engine/` — Moteur de quiz

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `state.js` | 278 | État du quiz (réponses, index, score, flags) |
| `cards.js` | 290 | Construction du DOM pour chaque carte de question |
| `track.js` | 261 | Carousel / slider (navigation entre questions) |
| `viewport.js` | 463 | Gestion du viewport, resize, scroll, dimensions |
| `interactions.js` | 472 | Événements clic, drag & drop, clavier |
| `terminal.js` | 693 | Rendu des blocs terminal (CMD/PowerShell/Bash) |
| `sanitizer.js` | 305 | Nettoyage HTML (XSS, sanitisation) |
| `hint.js` | 190 | Logique des indices (hints) |
| `resources.js` | 141 | Boutons de ressources externes |
| `focus.js` | 115 | Gestion du focus clavier |
| `warming.js` | 176 | Animation de préchauffage (warming effect) |
| `zoom.js` | 362 | Zoom sur images / médias |
| `exam.js` | 144 | Mode examen (timer, progression) |
| `lifecycle.js` | 109 | Montage / démontage du composant |
| `questions.js` | 71 | Parsing des questions |
| `utils.js` | 31 | Utilitaires internes |

---

### `src/editor.js` — 367 lignes

Contrôleur de l'éditeur Quiz Builder :
- Ouvre/ferme l'éditeur
- Synchronise les données entre éditeur et bloc de code
- Gère le mode preview

---

### `src/editor/` — Éditeur Quiz Builder

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `editor-form.js` | 455 | Formulaire dynamique (ajout/edition de questions) |
| `ui.js` | 330 | Composants UI (chips, toggles, listes, sections) |
| `modals.js` | 356 | Modales (confirm, import, preview) |
| `resize.js` | 243 | Redimensionnement des panneaux (split view) |
| `preview.js` | 185 | Rendu de preview en temps réel |
| `hint.js` | 126 | Édition des indices |
| `sidebar.js` | 93 | Barre latérale de navigation |
| `export.js` | 107 | Export du quiz en code bloc |
| `utils.js` | 100 | Utilitaires éditeur |

---

### `src/quiz-utils.js` — 58 lignes

Fonctions utilitaires partagées (parsing, formatage).

---

## `src/assets/css/` — Styles modulaires

### Architecture

```
index.css          ← Point d'entrée (@import de tous les modules)
├── tokens.css       Variables CSS (couleurs, espaces, animations)
├── base.css         GPU perf + accessibilité (prefers-reduced-motion)
├── layout.css       Largeurs, carousel/track, anti-coupure
├── utilities.css    Corrections thème clair (!important)
├── components/
│   ├── nav-tabs.css       Onglets de navigation
│   ├── quiz-card.css      Carte de question
│   ├── quiz-options.css   Options de réponse (grid, layout)
│   ├── ordering.css       Drag & drop / réordonnancement
│   ├── action-buttons.css Boutons d'action (suivant, résultats…)
│   ├── button-press.css   Effets de pression (press feedback)
│   ├── hint-modal.css     Bouton + modale d'indice
│   ├── explanations.css   Blocs d'explication
│   ├── embeds.css         Intégrations externes (iframe, video)
│   ├── inputs.css         Champs de saisie
│   ├── terminal-cmd.css       Terminal CMD Windows
│   ├── terminal-powershell.css Terminal PowerShell 5.1
│   ├── terminal-bash.css      Terminal Bash
│   ├── resource-btn.css   Boutons de ressource + tooltips
│   ├── settings-code.css  Blocs de code dans les settings
│   └── mobile.css         Overrides mobile/tactile (@media)
├── pages/
│   ├── results.css        Écran de résultats
│   └── exam.css           Mode examen (timer, start screen)
└── editor/
    ├── editor-base.css          Racine, header, boutons généraux
    ├── editor-layout.css        Panneaux, resizers, sidebar, responsive
    ├── editor-forms.css         Éléments de formulaire, sections, badges
    ├── editor-answers.css       Cartes de réponse, toggles, flash
    ├── editor-ui-components.css Chips, toggles, modales, collapsibles
    ├── editor-wysiwyg.css       Éditeur HTML/WYSIWYG, toolbar entités
    ├── editor-exam.css          Section exam, toggle, import, suggest
    ├── editor-forms-extra.css   Type badge, option cards, arrays, save
    └── editor-icons.css         Système d'icônes
```

> **Note** : `mobile.css` est importé **après** les pages pour respecter la cascade CSS (overrides `@media` doivent venir après les règles de base).

### Détail par fichier

| Fichier | Lignes | Contenu |
|---------|--------|---------|
| `index.css` | 40 | Point d'entrée — imports uniquement |
| `tokens.css` | 106 | Custom properties, couleurs, espaces, ombres |
| `base.css` | 71 | GPU perf + `prefers-reduced-motion` |
| `layout.css` | 133 | Largeurs max, carousel/track, anti-coupure |
| `utilities.css` | 62 | Corrections thème clair |
| **Components** | | |
| `nav-tabs.css` | 184 | Onglets de navigation du quiz |
| `quiz-card.css` | 61 | Carte de question |
| `quiz-options.css` | 199 | Options de réponse |
| `ordering.css` | 264 | Drag & drop, slots, possibilités |
| `action-buttons.css` | 187 | Boutons d'action |
| `button-press.css` | 162 | Animation de pression |
| `hint-modal.css` | 221 | Bouton et modale d'indice |
| `explanations.css` | 77 | Blocs d'explication |
| `embeds.css` | 73 | Iframes, vidéos |
| `inputs.css` | 128 | Champs texte, textarea |
| `terminal-cmd.css` | 443 | Terminal CMD Windows + thème clair |
| `terminal-powershell.css` | 194 | Terminal PowerShell 5.1 |
| `terminal-bash.css` | 205 | Terminal Bash |
| `resource-btn.css` | 174 | Boutons ressource + tooltips |
| `settings-code.css` | 64 | Blocs de code settings |
| `mobile.css` | 204 | Overrides mobile + anti-coupure |
| **Pages** | | |
| `results.css` | 148 | Écran résultats |
| `exam.css` | 188 | Mode examen |
| **Editor** | | |
| `editor-base.css` | 160 | Racine, header |
| `editor-layout.css` | 371 | Layout panneaux, resizers |
| `editor-forms.css` | 278 | Formulaires |
| `editor-answers.css` | 321 | Cartes de réponse, toggles, flash |
| `editor-ui-components.css` | 392 | Chips, toggles, modales, collapsibles |
| `editor-wysiwyg.css` | 203 | Éditeur WYSIWYG |
| `editor-exam.css` | 340 | Section exam, toggle, import, suggest |
| `editor-forms-extra.css` | 361 | Type badge, option cards, arrays, save |
| `editor-icons.css` | 85 | Icônes |

---

## Build & sortie

| Sortie | Origine | Rôle |
|--------|---------|------|
| `.obsidian/plugins/quiz-blocks/main.js` | `src/main.js` + tout `src/` | JS bundle (esbuild) |
| `.obsidian/plugins/quiz-blocks/styles.css` | `src/assets/css/index.css` + imports | CSS bundle (esbuild, ~5 176 lignes) |
| `.obsidian/plugins/quiz-blocks/manifest.json` | `src/assets/manifest.json` | Métadonnées plugin |

---

## Stats résumées

| Catégorie | Fichiers | Lignes |
|-----------|----------|--------|
| JS — Moteur (`src/engine.js` + `src/engine/`) | 16 | 4 497 |
| JS — Éditeur (`src/editor.js` + `src/editor/`) | 9 | 2 429 |
| JS — Plugin | 2 | 336 |
| **Total JS** | **27** | **7 262** |
| CSS — Quiz (`tokens` → `mobile`) | 21 | 3 326 |
| CSS — Pages | 2 | 336 |
| CSS — Éditeur | 9 | 2 311 |
| CSS — Index | 1 | 40 |
| **Total CSS** | **33** | **6 013** |
| Config racine | 3 | 109 |
| **Total projet** | **63** | **13 384** |