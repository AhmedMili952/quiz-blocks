# Rapport Complet de Comparaison

**Version Originale:** `C:\Users\Ahmed\quiz-blocks`  
**Version Modulaire:** `C:\Obsidian\Fichiers\Quiz Blocks Dev\src`  

**Date de génération:** 2026-04-06

---

## Table des matières

1. [Architecture Globale](#architecture-globale)
2. [Structure des Fichiers](#structure-des-fichiers)
3. [Fichier engine.js - Différences Détaillées](#fichier-enginejs---différences-détaillées)
4. [Modules vs Fonctions Originales](#modules-vs-fonctions-originales)
5. [Différences CSS](#différences-css)
6. [Fichiers Auxiliaires](#fichiers-auxiliaires)
7. [Changements Critiques](#changements-critiques)
8. [Résumé](#résumé)

---

## Architecture Globale

| Aspect | Version Originale | Version Modulaire |
|--------|-------------------|-------------------|
| **Lignes totales** | ~6,100 (monolithique) | ~4,000 (modulaire) |
| **Nombre de fichiers** | 3-4 fichiers principaux | 25+ fichiers |
| **Pattern** | Monolithique | Factory avec injection ctx |
| **Accès aux fonctions** | Direct | Via `ctx.*` |

---

## Structure des Fichiers

### Version Originale
```
src/
├── main.js           (3 lignes)
├── plugin.js         (~335 lignes)
├── engine.js         (~4,188 lignes - monolithique)
└── builder.js        (~1,933 lignes - monolithique)
```

### Version Modulaire
```
src/
├── main.js
├── plugin.js
├── quiz-utils.js              (NOUVEAU - extrait de engine.js)
├── engine.js                 (~863 lignes)
├── engine/                   (15 modules)
│   ├── terminal.js
│   ├── focus.js
│   ├── lifecycle.js
│   ├── warming.js
│   ├── sanitizer.js
│   ├── resources.js
│   ├── exam.js
│   ├── cards.js
│   ├── viewport.js
│   ├── track.js
│   ├── zoom.js
│   ├── interactions.js
│   ├── state.js
│   ├── hint.js
│   ├── questions.js
│   └── utils.js
├── editor.js                 (renommé de builder.js)
└── editor/                   (9 modules)
    ├── utils.js
    ├── modals.js
    ├── export.js
    ├── ui.js
    ├── resize.js
    ├── sidebar.js
    ├── preview.js
    ├── hint.js
    └── editor-form.js
```

---

## Fichier engine.js - Différences Détaillées

### 1. Imports et Dépendances

**Originale (aucun import de modules):**
```javascript
const JSON5 = require("json5");
```

**Modulaire (14 imports):**
```javascript
const { parseQuizSource, extractExamOptions, renderParagraph } = require("./quiz-utils");
const createTerminalHandlers = require("./engine/terminal");
const createFocusHandlers = require("./engine/focus");
const createLifecycleHandlers = require("./engine/lifecycle");
const createWarmingHandlers = require("./engine/warming");
const createSanitizer = require("./engine/sanitizer");
const createResourceHandlers = require("./engine/resources");
const createExamHandlers = require("./engine/exam");
const createCardRenderers = require("./engine/cards");
const createViewportHandlers = require("./engine/viewport");
const createTrackHandlers = require("./engine/track");
const createZoomHandlers = require("./engine/zoom");
const createInteractionHandlers = require("./engine/interactions");
const createStateHandlers = require("./engine/state");
const createHintHandlers = require("./engine/hint");
const createQuestionHandlers = require("./engine/questions");
```

### 2. Ordre d'Initialisation

**Critique - Problème de TDZ corrigé dans la version modulaire:**

Dans la version originale, les fonctions utilitaires comme `isQuestionSlideIndex` sont définies AVANT les constantes `SLIDE_SUBMIT_INDEX`, ce qui pouvait causer des problèmes de Temporal Dead Zone.

Dans la version modulaire:
1. Création de `ctx` avec les dépendances de base
2. Instanciation des modules avec injection de `ctx`
3. `Object.assign(ctx, {...})` pour attacher les modules
4. Définition des constantes SLIDE_*
5. Création de `quizState`
6. Définition des fonctions utilitaires (après les constantes)
7. Exposition des fonctions via `ctx`

### 3. Construction de l'Objet ctx

**La version modulaire utilise un pattern de "contexte partagé":**

```javascript
// Initial ctx (lignes 77-103)
const ctx = {
    app, container, sourcePath, Notice,
    quiz, isExamMode, examOptions, examDurationMs,
    get examTimeRemaining() { return examTimeRemaining; },
    set examTimeRemaining(v) { examTimeRemaining = v; },
    // ... getters/setters
    QUIZ_INSTANCE_ID, HINT_OVERLAY_ID, HINT_TITLE_ID, __quizGlobalCleanups,
    shuffleArray, clamp, isOrderingQuestion, isMatchingQuestion, isTextQuestion
};

// Modules instanciés avec ctx (lignes 106-120)
const sanitizer = createSanitizer(ctx);
const resources = createResourceHandlers(ctx);
// ... etc

// Attachement des modules à ctx (lignes 125-195)
Object.assign(ctx, {
    sanitize: sanitizer,
    resources, exam, cards, viewport, track, zoom, interactions,
    terminal, focus, lifecycle, warming, state, hint, questions,
    // Fonctions exposées
    escapeHtmlText: sanitizer.escapeHtmlText,
    // ... 40+ mappings
    render: null  // Assigné plus tard
});
```

### 4. Fonctions Déplacées vers les Modules

| Fonction(s) | Original | Modulaire |
|-------------|----------|-----------|
| Helpers Terminal (15 fonctions) | Lignes 104-302 | `engine/terminal.js` |
| Helpers Questions (7 fonctions) | Lignes 305-321 | `engine/questions.js` |
| Gestionnaire de cycle de vie (8 fonctions) | Lignes 420-493 | `engine/lifecycle.js` |
| Focus management (2 fonctions) | Lignes 510-566 | `engine/focus.js` |
| Warming/Préchargement (7 fonctions) | Lignes 1000-1169 | `engine/warming.js` |
| Track/Glissement (9 fonctions) | Lignes 695-716, 828-1390 | `engine/track.js` |
| Viewport/Affichage (12 fonctions) | Lignes 645-688, 754-930 | `engine/viewport.js` |
| Examen/Timer (6 fonctions) | Lignes 2229-2357 | `engine/exam.js` |
| Cartes/HTML (12 fonctions) | Lignes 2217-2227, 2359-3110 | `engine/cards.js` |
| Interactions (7 fonctions) | Lignes 3667-3950 | `engine/interactions.js` |
| Zoom/Transitions (3 fonctions) | Lignes 3112-3410 | `engine/zoom.js` |
| État/Résultats (13 fonctions) | Lignes 1565-1688, 1735-1745 | `engine/state.js` |
| Indices/Astuces (4 fonctions) | Lignes 1392-1563 | `engine/hint.js` |
| Ressources/Fichiers (7 fonctions) | Lignes 1829-1953 | `engine/resources.js` |
| Sanitization/HTML (12 fonctions) | Lignes 1955-2216 | `engine/sanitizer.js` |

**Fonctions restantes dans engine.js:**
- `buildShuffleMap`, `initSelections`, `initOrderingPicks`, `initMatchPicks`
- `isQuestionSlideIndex`, `isSubmitSlideIndex`, `isResultsSlideIndex`
- `clampSlideIndex`, `getSlidingWindow`
- `currentAsyncEpoch`, `isQuizInstanceAlive`, `getSlideGeneration`
- `cancelEnsureTrackVisibleRaf`, `clearBackgroundWarmIdleHandle`
- `alignToDevicePixel`, `settleViewportHeightToIndex`, `scheduleViewportHeightSync`
- `primeAllSlideHeights`, `applyTrackPositionAndHeightInstant`
- `ensureTrackVisibleAfterLayout`, `bindTrackFirstLoadFix`
- `goToSlide`, `redirectSlide`, `goToQuestion`, `goToSubmit`, `goToResults`
- `resetQuiz`, `destroyQuiz`, `refreshQuestionSlide`, `commitQuestionInteraction`
- `render` (la fonction principale de rendu)

### 5. Fonction render() - Comparaison

**Appels directs vs Via ctx:**

| Appel Original | Appel Modulaire |
|----------------|-----------------|
| `restartAsyncLifecycle()` | `ctx.lifecycle.restartAsyncLifecycle()` |
| `bumpAllSlideGenerations()` | `ctx.lifecycle.bumpAllSlideGenerations()` |
| `destroyActiveSlideResizeObserver()` | `ctx.viewport.destroyActiveSlideResizeObserver()` |
| `clearTrackTransitionFallback()` | `ctx.track.clearTrackTransitionFallback()` |
| `examTimerHtml()` | `ctx.exam.examTimerHtml()` |
| `navHtml()` | `ctx.cards.navHtml()` |
| `questionCardHtml(i)` | `ctx.cards.questionCardHtml(i)` |
| `submitSlideHtml()` | `ctx.cards.submitSlideHtml()` |
| `getSubmitSlideSignature()` | `ctx.state.getSubmitSlideSignature()` |
| `getTrackElements()` | `viewport.getTrackElements()` (renommé pour éviter conflit) |
| `bindTrackFirstLoadFix()` | `bindTrackFirstLoadFix()` (locale) |
| `bindViewportResizeObserver()` | `ctx.viewport.bindViewportResizeObserver()` |
| `bindZoomFixHandlers()` | `ctx.interactions.bindZoomFixHandlers()` |
| `applyTrackGeometry()` | `viewport.applyTrackGeometry()` |
| `setTrackTransformPx()` | `ctx.track.setTrackTransformPx()` |
| `applyTrackPositionAndHeightInstant()` | `applyTrackPositionAndHeightInstant()` (locale) |
| `bindAllSlidesResizeObserver()` | `ctx.viewport.bindAllSlidesResizeObserver()` |
| `bindAllTrackImages()` | `ctx.warming.bindAllTrackImages()` |
| `bindQuizResourceButtons(container)` | `ctx.resources.bindQuizResourceButtons(container)` |
| `bindQuestionTrackItem` | `ctx.interactions.bindQuestionTrackItem` |
| `bindStaticControls()` | `ctx.interactions.bindStaticControls()` |
| `bindExamStartButton()` | `ctx.exam.bindExamStartButton()` |
| `primeAllSlideHeights()` | `primeAllSlideHeights()` (locale) |
| `warmSlidesAroundIndex()` | `ctx.warming.warmSlidesAroundIndex()` |
| `startFullBackgroundWarm()` | `ctx.warming.startFullBackgroundWarm()` |
| `updateNavHighlight()` | `ctx.state.updateNavHighlight()` |
| `setSlidingClass()` | `ctx.state.setSlidingClass()` |
| `startExamTimer()` | `ctx.exam.startExamTimer()` |

**Différences notables:**
- La version modulaire utilise `ctx` pour tous les appels inter-modules
- Le destructuring `{ viewport: vp, track }` évite le conflit avec le module `viewport`
- Les fonctions locales restent les mêmes

---

## Modules vs Fonctions Originales

### exam.js

**Différence critique:**
- **Original:** `stopExamTimer({ resetTimeRemaining = false } = {})` avec logique de reset
- **Modulaire:** `stopExamTimer()` simplifié, sans paramètre

### cards.js

**Différences majeures:**

1. **`optionClass`** - **BUG POTENTIEL:**
   - Original: Garde clause `if (isOrderingQuestion(q) || isMatchingQuestion(q) || isTextQuestion(q)) return "";`
   - Modulaire: **PAS de garde clause**

2. **`explanationHtml`**:
   - Original: `sanitizeQuizHtml(replaceObsidianEmbedsInHtml(...))`
   - Modulaire: `ctx.sanitize.replaceObsidianEmbedsInHtml` sans `sanitizeQuizHtml`

3. **`orderingCardHtml` et `matchingCardHtml`**:
   - Original: Utilise `renderInlineQuizHtml` pour les valeurs
   - Modulaire: Utilise `ctx.escapeHtmlText`

### viewport.js

**Différences importantes:**

1. **`getSlideStableHeight`**:
   - Original: `if (!refresh && Number.isFinite(cached) && cached > 0)`
   - Modulaire: `if (!refresh) { const cached = __quizSlideHeightCache.get(index); if (cached) return cached; }`

2. **`primeAllSlideHeights`**:
   - Original: `retries = 8`
   - Modulaire: `retries = 2`

3. **`setViewportHeight`**:
   - Original: `style.transition = animate ? "height 220ms..."`
   - Modulaire: `style.setProperty('transition', ..., 'important')`

### track.js

**Différences:**

1. **`getSlideTranslateX`**:
   - Original: `getViewportStableWidth()`
   - Modulaire: `ctx.viewport.getViewportStableWidth()`

2. **`animateTrackToIndex`**:
   - Modulaire ajoute: `if (ctx.__quizDestroyed) return;` dans le callback RAF

### state.js

**Différences:**

1. **`isCorrect`**:
   - Original: `isTextQuestion(q)`, `terminal.isTextAnswerCorrect(q, sel)`
   - Modulaire: `ctx.isTextQuestion(q)`, `ctx.terminal.isTextAnswerCorrect(q, sel)`

2. **`goToResults`**:
   - Modulaire ajoute gestion examen:
     ```javascript
     if (ctx.isExamMode && ctx.examStarted && !ctx.examEnded) {
         ctx.examEnded = true;
         ctx.stopExamTimer();
         ctx.updateExamTimerDisplay();
     }
     ```

3. **`resetQuiz`**:
   - Modulaire ajoute cleanup: `ctx.clearBackgroundWarmIdleHandle()`, `ctx.cancelEnsureTrackVisibleRaf()`

### interactions.js

**Différences:**

1. **`bindSubmitSlideControls`**:
   - Modulaire ajoute: `if (document.activeElement === showScoreBtn) showScoreBtn.blur();`

2. **`bindResultsSlideControls`**:
   - Original: `restartQuizWithZoomBlurTransition()`
   - Modulaire: `ctx.zoom.restartQuizWithZoomBlurTransition()`

### zoom.js

**Différences:**

1. **`restartQuizWithZoomBlurTransition`**:
   - Modulaire ajoute gestion spéciale pour la page résultats:
     ```javascript
     if (ctx.quizState.isSliding && ctx.isResultsSlideIndex(ctx.quizState.current)) {
         ctx.quizState.isSliding = false;
         ctx.setSlidingClass(false);
     }
     ```

---

## Différences CSS

### Propriété manquante dans `.quiz-track`

**Original (ligne 211):**
```css
.quiz-track{
  /* ... */
  will-change: transform;
  transition: none;        /* ← MANQUANT DANS MODULAIRE */
  backface-visibility: hidden;
  /* ... */
}
```

**Modulaire:**
```css
.quiz-track{
  /* ... */
  will-change: transform;
  /* transition: none; est ABSENT */
  backface-visibility: hidden;
  /* ... */
}
```

**Impact:** Cette propriété est essentielle pour éviter les interférences entre les transitions CSS et les transformations JavaScript.

---

## Fichiers Auxiliaires

### quiz-utils.js

**N'existe PAS dans la version originale.**

**Contenu (49 lignes):**
- `parseQuizSource(source)`
- `extractExamOptions(quizArray)`
- `renderParagraph(container, text)`

Ces fonctions étaient inline dans engine.js originalement.

### plugin.js

| Ligne | Originale | Modulaire |
|-------|-----------|-----------|
| 5 | `require("./builder")` | `require("./editor")` |

### builder.js vs editor.js

**Renommé et refactoré:**
- `builder.js` (~1,933 lignes) → `editor.js` (~171 lignes) + 9 modules dans `editor/`

---

## Changements Critiques

### 1. Problème `isDestroyed()` (RÉSOLU)

**Problème:**
- Original: `isDestroyed` vérifiait `__quizDestroyed` directement
- Modulaire initialement: `isDestroyed: () => isQuizInstanceAlive()` utilisait une closure incorrecte

**Solution appliquée:**
```javascript
// Dans engine.js
isDestroyed: () => !__quizDestroyed,
// OU dans track.js
if (ctx.__quizDestroyed) return;
```

### 2. getSlidingWindow (RÉSOLU)

**Problème:**
- Modulaire avait: `{ from: current - 1, to: current + 1 }`
- Nécessite: `{ from: Math.min(prevCurrent, current), to: Math.max(prevCurrent, current) }`

**Solution appliquée:**
```javascript
const getSlidingWindow = () => ({ 
    from: Math.max(0, Math.min(quizState.prevCurrent, quizState.current)), 
    to: Math.min(TOTAL_SLIDES - 1, Math.max(quizState.prevCurrent, quizState.current)) 
});
```

### 3. Accès aux Caches

**Différence:**
- Original: `__quizSlideHeightCache` et `__quizWarmSlidePromises` définis dans engine.js
- Modulaire: Définis dans viewport.js, accédés via `ctx.viewport.__quizSlideHeightCache`

---

## Résumé

### Statistiques

| Métrique | Original | Modulaire | Différence |
|----------|----------|-----------|------------|
| **engine.js** | ~4,188 lignes | ~863 lignes | -3,325 lignes |
| **Nombre de modules** | 0 | 15 | +15 |
| **Fichiers quiz-utils** | 0 | 1 | +1 |
| **CSS** | Identique | 1 propriété manquante | Mineur |

### Avantages de la Version Modulaire

1. **Séparation des préoccupations** - Chaque module a une responsabilité unique
2. **Testabilité** - Les modules peuvent être testés individuellement
3. **Maintenabilité** - Code plus facile à comprendre et modifier
4. **Réutilisabilité** - Modules peuvent être réutilisés ailleurs

### Points de Vigilance

1. **Accès via ctx** - Tous les appels passent par `ctx`, ajoutant une indirection
2. **Ordre d'initialisation** - Important de maintenir l'ordre correct pour éviter TDZ
3. **Caches partagés** - Les caches sont exposés via ctx pour accès inter-modules
4. **Pattern Factory** - Chaque module exporte une fonction factory recevant ctx

### Bugs Potentiels Identifiés

1. **`cards.js:optionClass`** - Garde clause manquante pour ordering/matching/text
2. **`viewport.js:primeAllSlideHeights`** - Retries réduits de 8 à 2
3. **`exam.js:stopExamTimer`** - Paramètre `resetTimeRemaining` supprimé
4. **CSS** - `transition: none` manquant dans `.quiz-track`

---

*Rapport généré automatiquement par Claude Code*
