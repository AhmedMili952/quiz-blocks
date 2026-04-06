# Différences Comportementales - Quiz Blocks

**Seules les différences affectant le rendu ou le comportement dans Obsidian**

---

## ✅ Déjà corrigées

### 1. Les transitions carousel ne fonctionnaient pas
**Problème :** `isDestroyed()` retournait `true` à tort dans les callbacks d'animation  
**Impact :** Aucune transition entre les questions  
**Correction :** Changé `isDestroyed: () => isQuizInstanceAlive()` pour `isDestroyed: () => !__quizDestroyed` ou vérification directe de `ctx.__quizDestroyed`

### 2. getSlidingWindow incorrect
**Problème :** Retournait toujours une fenêtre de 3 slides (current-1 à current+1)  
**Impact :** Quand on passait de Q1 à Q9, on ne voyait pas les slides intermédiaires défiler  
**Correction :** `{ from: Math.min(prevCurrent, current), to: Math.max(prevCurrent, current) }`

### 3. transition: none manquant en CSS
**Problème :** La propriété CSS `transition: none` manquait dans `.quiz-track`  
**Impact :** Possibles interférences entre CSS et animations JavaScript  
**Correction :** Suppression de la ligne `transition: none` (car géré par JS)

---

## ⚠️ Potentiellement problématiques

### 4. optionClass - Garde clause manquante
**Fichier :** `engine/cards.js`  
**Différence :**
```javascript
// ORIGINAL (ligne ~2369 dans engine.js original)
function optionClass(q, sel, qi, oi) {
    if (isOrderingQuestion(q) || isMatchingQuestion(q) || isTextQuestion(q)) return "";
    // ... suite
}

// MODULAIRE - MANQUE CETTE VÉRIFICATION !
function optionClass(q, sel, qi, oi) {
    // PAS de garde clause pour ordering/matching/text
    // ... suite
}
```
**Impact potentiel :** Les options dans les questions ordering/matching/text pourraient avoir des classes CSS incorrectes

---

### 5. primeAllSlideHeights - Moins de retries
**Fichier :** `engine/viewport.js`  
**Différence :**
```javascript
// ORIGINAL
function primeAllSlideHeights({ retries = 8, syncCurrent = true } = {}) { ... }

// MODULAIRE
function primeAllSlideHeights({ retries = 2, syncCurrent = true } = {}) { ... }
```
**Impact potentiel :** Le calcul de hauteur des slides pourrait être moins précis ou échouer plus souvent

---

### 6. stopExamTimer - Reset simplifié
**Fichier :** `engine/exam.js`  
**Différence :**
```javascript
// ORIGINAL
function stopExamTimer({ resetTimeRemaining = false } = {}) {
    if (examTimerId) {
        cancelAnimationFrame(examTimerId);
        examTimerId = null;
    }
    examStartTime = 0;
    if (resetTimeRemaining) {
        examTimeRemaining = examDurationMs;
    }
}

// MODULAIRE - Simplifié
function stopExamTimer() {
    if (examTimerId) {
        cancelAnimationFrame(examTimerId);
        examTimerId = null;
    }
    examStartTime = 0;
    // PAS de paramètre resetTimeRemaining
}
```
**Impact potentiel :** Le reset du timer d'examen pourrait ne pas réinitialiser correctement le temps restant dans certains cas

---

### 7. setViewportHeight - Style avec !important
**Fichier :** `engine/viewport.js`  
**Différence :**
```javascript
// ORIGINAL
viewport.style.transition = animate ? "height 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
viewport.style.height = `${h}px`;

// MODULAIRE
viewport.style.setProperty('transition', animate ? 'height 220ms...' : 'none', 'important');
viewport.style.setProperty('height', `${h}px`, 'important');
```
**Impact potentiel :** Les transitions de hauteur pourraient être plus "agressives" avec `!important`

---

### 8. orderingCardHtml et matchingCardHtml - Échappement différent
**Fichier :** `engine/cards.js`  
**Différence :**
```javascript
// ORIGINAL
return `<span class="quiz-slot-value">${renderInlineQuizHtml(placedText)}</span>`;

// MODULAIRE
return `<span class="quiz-slot-value">${ctx.escapeHtmlText(items[oi])}</span>`;
```
**Impact potentiel :** Le contenu HTML dans les slots ordering/matching pourrait être échappé différemment (texte brut vs HTML interprété)

---

### 9. explanationHtml - Sanitization différente
**Fichier :** `engine/cards.js`  
**Différence :**
```javascript
// ORIGINAL
return `<div class="quiz-explain ...">${sanitizeQuizHtml(replaceObsidianEmbedsInHtml(q._explainHtml))}</div>`;

// MODULAIRE
const html = q.explainHtml || q._explainHtml;
return `<div class="quiz-explain ...">${ctx.sanitize.replaceObsidianEmbedsInHtml(html)}</div>`;
```
**Impact potentiel :** Les explications HTML pourraient être sanitizées différemment (plus ou moins permissives)

---

### 10. renderQuizPromptHtml - Support de promptHtml
**Fichier :** `engine/cards.js`  
**Différence :**
```javascript
// ORIGINAL
function renderQuizPromptHtml(q) {
    if (q._promptHtml) {
        return sanitizeQuizHtml(replaceObsidianEmbedsInHtml(q._promptHtml));
    }
    // ...
}

// MODULAIRE
function renderQuizPromptHtml(q) {
    const promptHtml = q.promptHtml || q._promptHtml;  // Supporte aussi q.promptHtml (sans _)
    if (promptHtml) {
        return ctx.sanitize.replaceObsidianEmbedsInHtml(promptHtml);
    }
    // ...
}
```
**Impact :** La version modulaire supporte `promptHtml` (sans underscore) en plus de `_promptHtml`  
**Statut :** C'est une amélioration, pas un bug

---

## 📋 Résumé des impacts

| # | Problème | Fichier | Impact | Statut |
|---|----------|---------|--------|--------|
| 1 | isDestroyed incorrect | engine.js | Aucune transition | ✅ Corrigé |
| 2 | getSlidingWindow | engine.js | Slides intermédiaires invisibles | ✅ Corrigé |
| 3 | CSS transition | styles.css | Interférences CSS/JS | ✅ Corrigé |
| 4 | optionClass garde clause | cards.js | Classes CSS options | ⚠️ À tester |
| 5 | primeAllSlideHeights retries | viewport.js | Calcul hauteur | ⚠️ À surveiller |
| 6 | stopExamTimer reset | exam.js | Reset timer examen | ⚠️ À tester |
| 7 | setViewportHeight !important | viewport.js | Transitions hauteur | ℹ️ Acceptable |
| 8 | ordering/matching escape | cards.js | Rendu HTML contenu | ℹ️ Probablement OK |
| 9 | explanation sanitize | cards.js | Rendu HTML explications | ℹ️ Probablement OK |
| 10 | promptHtml support | cards.js | Support plus large | ✅ Amélioration |

---

## 🎯 Recommandations

### Tester prioritairement :
1. **Questions ordering/matching/text** - Vérifier que les options s'affichent correctement
2. **Mode examen** - Vérifier le reset du timer quand on recommence
3. **Calcul de hauteur** - Surveiller si des slides ont des hauteurs incorrectes

### À ignorer (sans impact visuel) :
- Toutes les différences d'architecture (factory pattern, ctx)
- Les noms de variables internes
- L'ordre des définitions de fonctions
- Les exports de modules

---

*Document généré le 2026-04-06*
