# Analyse Approfondie du Quiz Editor - Deuxième Passage

**Date** : 2026-04-07  
**Objectif** : Identification de bugs et comportements non voulus sans modification de code

---

## 1. Architecture et Patterns

### Pattern Factory + Injection de Contexte
Le code utilise un pattern factory avec injection de `ctx` (contexte) qui contient toutes les dépendances partagées.

**Observation** : `ctx.questions` est une référence au tableau `this.questions`, mais `ctx.activeIdx` est une valeur primitive copiée. C'est cohérent car on ne modifie que `ctx.activeIdx`, jamais `this.activeIdx` directement.

---

## 2. Problèmes Identifiés

### 🔴 CRITIQUE - Fuite de mémoire événementielle

**Fichier** : `editor/hint.js:36`  
**Code** :
```javascript
document.addEventListener("keydown", view._hintEscHandler);
```

**Problème** : Ce gestionnaire est ajouté à chaque ouverture de modal hint, mais il n'est jamais supprimé ! Dans `editor.js:153-158`, on supprime l'overlay mais pas le listener document.

**Impact** : Chaque ouverture de hint ajoute un listener qui reste actif pour toujours. Sur une session longue, cela peut accumuler des centaines de listeners.

**Preuve** :
```javascript
// Dans editor.js onClose():
this._closeHint();  // Ferme le hint
const overlay = document.getElementById("qb-hint-overlay");
if (overlay) overlay.remove();  // Supprime l'overlay
// MAIS le listener document.addEventListener("keydown", ...) reste !
```

---

### 🔴 CRITIQUE - Perte de données HTML à l'import

**Fichier** : `editor/modals.js:198`  
**Code** :
```javascript
question.prompt = q.promptHtml.replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
```

**Problème** : La regex `/<[^>]+>/g` supprime **toutes** les balises HTML, y compris `<pre>`, `<code>`, `<br>`, etc.

**Exemple de perte de données** :
- Export : `"Voici un <pre><code>tracert</code></pre> exemple"`
- Après import : `"Voici un  exemple"` (le code a disparu !)

**Impact** : Perte irréversible de contenu formaté.

---

### 🟠 MAJEUR - Images dans _promptHtml invisibles (CORRIGÉ)

**Fichier** : `editor/preview.js:35-37`  
**Statut** : ✅ Corrigé dans le commit précédent

**Ancien problème** :
```javascript
if (q._promptHtml) {
    const promptEl = card.createDiv({ cls: "quiz-question" });
    promptEl.innerHTML = q._promptHtml;  // Wiki-links jamais convertis !
}
```

**Solution appliquée** :
```javascript
let html = q._promptHtml.replace(/!\[\[([^\]]+)\]\]/g, '<img src="$1" class="qb-md-img" />');
html = _resolveImagesInHtml(html);
promptEl.innerHTML = html;
```

---

### 🟠 MAJEUR - Comportement asynchrone dangereux

**Fichier** : `editor/preview.js:8-9`  
**Code** :
```javascript
if (view._previewDebounce) clearTimeout(view._previewDebounce);
view._previewDebounce = setTimeout(() => renderPreview(), 150);
```

**Problème** : Si la view est fermée entre le setTimeout et l'exécution de renderPreview(), le code essaiera de render sur un élément qui n'existe plus.

**Scénario** :
1. Utilisateur tape rapidement
2. setTimeout(150ms) programmé
3. Utilisateur ferme la view avant 150ms
4. renderPreview() s'exécute sur `view.previewBodyEl` qui est undefined ou détaché
5. Erreur JavaScript

**Solution recommandée** :
```javascript
view._previewDebounce = setTimeout(() => {
    if (view.previewBodyEl && view.previewBodyEl.isConnected) {
        renderPreview();
    }
}, 150);
```

---

### 🟡 MINEUR - Race condition dans le redimensionnement

**Fichier** : `editor/resize.js:88-94`  
**Code** :
```javascript
const scheduleUpdate = () => {
    if (!dragState.needsUpdate) {
        dragState.needsUpdate = true;
        rafId = requestAnimationFrame(() => {
            updatePanels();
        });
    }
};
```

**Problème** : Si l'utilisateur redimensionne très vite, plusieurs RAF peuvent être empilés car `needsUpdate` est remis à true après l'exécution de updatePanels().

**Impact** : Performance dégradée pendant le drag rapide.

---

### 🟡 MINEUR - Variable non définie dans certain cas

**Fichier** : `editor/resize.js:29-84`  
**Code** : La fonction `updatePanels` utilise `type` et `dragState` qui sont définis dans la closure parente.

**Problème** : Si `_setupResizer` est appelé plusieurs fois sur le même élément, de nouvelles closures sont créées mais les anciennes listeners peuvent persister.

**Non-confirmation** : Impossible de déterminer sans tester si cela cause réellement un problème.

---

## 3. Comportements Étranges (Non-bugs mais à noter)

### Re-numérotation automatique des titres

**Fichier** : `editor/sidebar.js:55-56`

```javascript
ctx.questions.forEach((qq, idx) => { 
    if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; 
});
```

**Comportement** : Si l'utilisateur nomme intentionnellement une question "Question 5" (pour correspondre à un numéro de question d'examen par exemple), elle sera automatiquement renommée après toute suppression de question précédente.

**Impact utilisateur** : Perte de l'intention utilisateur.

---

### Désactivation conditionnelle du bouton suppression

**Fichier** : `editor/editor-form.js:287-297`

```javascript
if (!isCorrect && q.options.length > 2) {
    const delBtn = card.createEl("button", { cls: "qb-answer-delete" });
    // ...
}
```

**Comportement** : On ne peut pas supprimer une option si elle est marquée "correcte" OU s'il n'y a que 2 options. C'est cohérent pour éviter d'avoir moins de 2 options, mais le message n'est pas explicite pour l'utilisateur.

---

### Boucle while potentiellement infinie

**Fichier** : `editor/editor-form.js:316-318`

```javascript
while (q.correctOrder.length < q.possibilities.length) 
    q.correctOrder.push(q.correctOrder.length);
```

**Analyse** : Si `q.correctOrder` était undefined ou null, cela causerait une erreur. Mais dans la pratique, `makeDefault` initialise toujours `correctOrder`.

**Statut** : ✅ Safe, mais fragile si les defaults changent.

---

## 4. Incohérences entre Import et Export

### Format des questions

**Export** (`export.js:13-23`) :
- Si `_useHtmlPrompt && _promptHtml` → exporte `_promptHtml` directement
- Si `prompt` avec markdown → convertit via `md2html()` puis exporte

**Import** (`modals.js:195-203`) :
- Si `promptHtml` existe → supprime toutes les balises HTML pour créer `prompt`
- Si `prompt` existe → garde tel quel

**Problème** : L'export produit du HTML, l'import détruit le HTML. Ce n'est pas symétrique !

---

## 5. Problèmes de Focus et Accessibilité

### Focus trap dans le modal hint

**Fichier** : `editor/hint.js:76-77`

```javascript
const focus = overlay.querySelector(".quiz-hint-modal-close");
if (focus) setTimeout(() => { try { focus.focus(); } catch (_) {} }, 340);
```

**Problème** : Le focus est mis sur le bouton fermer, mais il n'y a pas de gestion de tabulation pour piéger le focus dans le modal. Un utilisateur au clavier peut tabuler hors du modal.

---

### Pas de aria-live pour les notifications

Les notifications (`new obsidian.Notice`) ne sont pas accompagnées de `aria-live` regions pour les lecteurs d'écran.

---

## 6. Performance

### Re-render complet à chaque modification

**Fichier** : `editor/editor-form.js:9-11`

```javascript
function onEdit() {
    view.renderCode();
    view.schedulePreview();
    view.scheduleSave?.();
}
```

**Observation** : Chaque modification déclenche un re-render complet du code (JSON5) et du preview. Pour un quiz avec 50 questions, cela pourrait être coûteux.

**Optimisation possible** : Debounce plus long pour le code, ou render incrémental.

---

### Appels répétés à getResourcePath

**Fichier** : `editor/preview.js:41-52`

Pour chaque image dans le prompt, on appelle :
1. `view.app.vault.getConfig("attachmentFolderPath")`
2. `view.app.vault.getAbstractFileByPath(filePath)`
3. `view.app.vault.adapter.getResourcePath(filePath)`

Ces appels sont synchrones mais pourraient être mis en cache.

---

## 7. Scénarios de Test Recommandés

### Scénario A : Session longue avec hints
1. Ouvrir le Quiz Editor
2. Créer 50 questions avec hints
3. Ouvrir/fermer chaque hint 10 fois
4. Vérifier la mémoire avec DevTools (detached DOM nodes)

**Attendu** : Pas de fuite mémoire significative

### Scénario B : Import avec HTML
1. Créer une question avec un bloc `<pre><code>`
2. Exporter le quiz
3. Importer le quiz
4. Vérifier que le bloc code est présent

**Attendu actuel** : Le bloc code disparaît (BUG)

### Scénario C : Fermeture rapide
1. Ouvrir le Quiz Editor
2. Taper rapidement dans le prompt
3. Fermer immédiatement la view (avant 150ms)
4. Vérifier la console pour erreurs

**Attendu actuel** : Erreur possible si renderPreview s'exécute après fermeture

---

## 8. Synthèse des Priorités

### 🔴 À corriger immédiatement
1. **Fuite mémoire hint** - Ajouter `removeEventListener` dans `onClose()`
2. **Perte HTML à l'import** - Ne pas supprimer les balises avec regex

### 🟠 À corriger prochainement
3. **Race condition preview** - Vérifier que l'élément existe avant de render
4. **Focus trap** - Implémenter un vrai focus trap dans le modal hint

### 🟡 Améliorations
5. **Cache des chemins d'images** - Éviter les appels répétés
6. **Re-render incrémental** - Ne pas tout re-render à chaque frappe
7. **Titres utilisateur** - Ne pas re-numéroter si modifié manuellement

---

## 9. Code Review - Bonnes pratiques observées

### ✅ Points positifs
- Utilisation cohérente du pattern Factory
- Debouncing approprié pour les opérations coûteuses
- Gestion des erreurs avec try/catch sur les opérations sensibles
- Séparation claire des responsabilités (ui, sidebar, preview, etc.)

### ⚠️ Points à améliorer
- Nettoyage des event listeners à revoir
- Tests unitaires manquants sur les conversions import/export
- Documentation JSDoc absente

---

**Fin de l'analyse** - Aucun fichier modifié
