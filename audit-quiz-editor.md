# Audit Complet du Quiz Editor - Quiz Blocks

**Date d'audit** : 2026-04-07  
**Fichiers analysés** : 11 fichiers JavaScript + styles.css  
**Méthodologie** : Simulation utilisateur + analyse statique du code

---

## 1. Vue d'ensemble de l'architecture

### Pattern utilisé : Factory + Injection de Contexte (ctx)
Le Quiz Editor utilise un pattern sophistiqué où chaque module est une factory qui reçoit le contexte partagé (`ctx`) :

```javascript
module.exports = function createEditorFormHandlers(ctx) {
    // ctx contient view, app, plugin, questions, etc.
    return { renderEditor, _field, ... };
};
```

**Avantage** : Dépendances explicites, testabilité  
**Risque potentiel** : Références circulaires possibles via ctx

---

## 2. Flux utilisateur simulé - Scénario "Création d'un quiz complet"

### Scénario A : Ouverture du Quiz Editor

**Action** : Commande "Ouvrir le Quiz Editor" ou clic sur icône latérale

**Flux exécuté** :
1. `plugin.js:181-194` → Enregistrement de la view
2. `editor.js:21-139` → Instanciation QuizBuilderView
3. `editor.js:145-149` → `onOpen()` → `buildUI()` → `render()`

**Comportement observé** :
- Panneaux par défaut : sidebar, editor, preview visibles
- Question par défaut créée (type "single")
- Aperçu vide tant que pas de prompt saisi

**⚠️ POTENTIEL BUG** : Si aucune question n'est initialisée, `this.questions = [makeDefault("single")]` à la ligne 25 de editor.js devrait toujours créer au moins une question. C'est OK.

---

### Scénario B : Ajout d'une question

**Action** : Clic sur bouton "+" dans la sidebar

**Flux exécuté** :
1. `sidebar.js:121` → `addBtn.addEventListener("click", () => showTypeModal())`
2. `ui.js:312-321` → TypePickerModal ouvert
3. Utilisateur sélectionne un type
4. `editor.js:284-364` → `convertParsedToInternal()` appelé (lors de l'import)
   OU `ui.js:315-318` → Création via `makeDefault(type)`

**Comportement observé** :
- Nouvelle question ajoutée avec titre auto "Question N"
- Navigation automatique vers la nouvelle question
- Preview mise à jour

**⚠️ COMPORTEMENT NON VOULU POTENTIEL** :
Dans `sidebar.js:55-56`, après déplacement ou suppression, les titres sont re-numérotés :
```javascript
ctx.questions.forEach((qq, idx) => { 
    if (/^Question \d+$/.test(qq.title)) qq.title = `Question ${idx + 1}`; 
});
```

**Problème** : Si l'utilisateur a intentionnellement nommé une question "Question 5", elle sera renommée automatiquement ! C'est une perte de données utilisateur intentionnelles.

---

### Scénario C : Édition du prompt avec markdown

**Action** : Saisie dans le champ "Énoncé"

**Flux exécuté** :
1. `editor-form.js:28-31` → `_field()` pour le prompt
2. Événement `input` → `onChange(ta.value)` → `onEdit()`
3. `onEdit()` appelle `view.schedulePreview()` et `view.scheduleSave()`

**Ancien comportement (bug)** :
```javascript
// AVANT (bug):
q._promptHtml = v.replace(/\n/g, '<br>');  // Stockait des <br>
```

**Nouveau comportement (corrigé)** :
```javascript
// APRÈS (fix):
q._promptHtml = v;  // Garde les \n natifs
```

**✅ CORRECTION APPLIQUÉE** : Plus de balises `<br>` visibles dans l'aperçu. `md2html()` gère la conversion.

---

### Scénario D : Collage d'image dans le prompt

**Action** : Ctrl+V d'une image dans le champ textarea

**Flux exécuté** :
1. `editor-form.js:116-143` → Gestionnaire d'événement paste
2. Détection du type MIME `image/*`
3. Création nom fichier : `Pasted image YYYYMMDDHHMMSS.png`
4. Écriture dans le vault via `ctx.plugin.app.vault.adapter.writeBinary()`
5. Insertion wiki-link : `![[Pasted image ...]]`

**⚠️ RISQUE IDENTIFIÉ** :
Ligne 133-134 :
```javascript
const attachFolder = ctx.plugin.app.vault.getConfig("attachmentFolderPath") || "";
const filePath = attachFolder ? attachFolder + "/" + fileName : fileName;
```

**Problème** : Si `attachmentFolderPath` contient des variables comme `${file}` ou `${date}`, elles ne sont pas interprétées. Le fichier sera écrit dans un dossier littéralement nommé avec `${file}`.

**Impact** : Les images ne s'afficheront pas dans l'aperçu si le chemin est invalide.

---

### Scénario E : Prévisualisation du quiz

**Action** : Saisie dans n'importe quel champ

**Flux exécuté** :
1. `editor-form.js:9-11` → `onEdit()` → `view.schedulePreview()`
2. `preview.js:7-10` → Debounce 150ms puis `renderPreview()`
3. `preview.js:35-53` → Rendu du prompt

**Logique de rendu du prompt** :
```javascript
if (q._promptHtml) {
    promptEl.innerHTML = q._promptHtml;  // Utilise directement
} else if (q.prompt) {
    promptEl.innerHTML = md2html(q.prompt);  // Convertit depuis markdown
}
```

**⚠️ COMPORTEMENT** : Si `q._promptHtml` existe, il est utilisé directement sans passer par `md2html()`. Cela signifie que les liens wiki `![[...]]` dans `_promptHtml` ne seront PAS convertis en vraies images dans l'aperçu !

**Vérification dans preview.js:35-52** :
- `_promptHtml` : utilisé directement (risque : contient des entités HTML non résolues)
- `prompt` : converti via `md2html()` puis images résolues

**Impact** : Si on colle une image dans `_promptHtml`, elle ne s'affichera pas dans l'aperçu car `_resolveImagesInHtml` n'est appelé que pour `q.prompt`, pas pour `q._promptHtml`.

---

### Scénario F : Affichage de l'indice

**Action** : Clic sur "Indice" dans l'aperçu

**Flux exécuté** :
1. `preview.js:139-141` → `hintBtn.addEventListener("click", () => view._openHint(q.hint))`
2. `hint.js:72-98` → `_openHint(text)`
3. Ligne 76 : `body.innerHTML = view._resolveImagesInHtml(md2html(text))`

**✅ COMPORTEMENT CORRECT** : L'indice passe bien par `md2html()` pour la conversion.

**⚠️ POTENTIEL PROBLÈME** : Dans `hint.js:31-36`, le gestionnaire Escape est ajouté au document :
```javascript
view._hintEscHandler = e => {
    const o = document.getElementById("qb-hint-overlay");
    if (!o || !o.classList.contains("is-open")) return;
    if (e.key === "Escape") _closeHint();
};
document.addEventListener("keydown", view._hintEscHandler);
```

**Problème** : Ce gestionnaire est ajouté à CHAQUE ouverture de modal (ligne 36), mais n'est supprimé que dans `onClose()` de la view (ligne 153-158 de editor.js). Si la view est fermée alors que le modal est ouvert, le gestionnaire reste actif !

---

### Scénario G : Export du quiz

**Action** : Clic sur "Exporter"

**Flux exécuté** :
1. `ui.js:73-89` → Bouton export avec copie vers clipboard
2. `export.js:96-102` → `exportAll()` génère le JSON5

**Logique d'export du prompt** (export.js:13-23) :
```javascript
// Priorité au prompt modifié par l'utilisateur, _promptHtml est fallback
if (q._useHtmlPrompt && q._promptHtml) {
    L.push(`\t\tpromptHtml: '${e(q._promptHtml)}',`);
} else if (q.prompt) {
    const hasMd = q.prompt && (/[*#`>\-]/.test(q.prompt) || q.prompt.includes("\n"));
    if (hasMd) L.push(`\t\tpromptHtml: '${e(md2html(q.prompt))}',`);
    else L.push(`\t\tprompt: '${e(q.prompt)}',`);
} else if (q._promptHtml) {
    L.push(`\t\tpromptHtml: '${e(q._promptHtml)}',`);
}
```

**⚠️ COMPORTEMENT ÉTRANGE** :
- Si `_useHtmlPrompt` est true, exporte `_promptHtml` brut (qui contient des `\n` maintenant)
- Si `q.prompt` existe et a du markdown, il est converti via `md2html()` puis exporté

**Problème potentiel** : L'export mélange des données pré-traitées (`promptHtml` avec HTML) et brutes (`prompt` sans HTML). Cela pourrait causer des incohérences lors de l'import.

---

### Scénario H : Import d'un quiz existant

**Action** : Clic sur "Importer" puis sélection d'un fichier

**Flux exécuté** :
1. `ui.js:66-71` → `ImportQuizModal` ouvert
2. `modals.js:121-176` → Parsing et conversion
3. `modals.js:178-258` → `convertToInternalFormat()`

**Logique de conversion du prompt** (modals.js:195-203) :
```javascript
if (q.prompt) {
    question.prompt = q.prompt;
} else if (q.promptHtml) {
    question.prompt = q.promptHtml.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
if (q.promptHtml) {
    question._promptHtml = q.promptHtml;
    question._useHtmlPrompt = true;
}
```

**⚠️ COMPORTEMENT DANGEREUX** :
Ligne 198 : `question.prompt = q.promptHtml.replace(/<[^>]+>/g, "")` — cela supprime TOUTES les balises HTML, y compris `<pre>`, `<code>`, etc. !

**Exemple** :
- Exporté : `promptHtml: 'Texte <pre><code>code</code></pre>'`
- Importé : `prompt = 'Texte '` (le code a disparu !)

**Impact** : Perte de données lors de l'import/export si on utilise l'éditeur HTML.

---

## 3. Analyse des champs textarea - Uniformité

### Champ "Énoncé" (prompt)
- ✅ Toolbar entités HTML
- ✅ Auto-resize (min 100px)
- ✅ Collage d'images
- ✅ Raccourci ```

### Champ "Indice" (hint)
- ✅ Toolbar entités HTML
- ✅ Auto-resize (min 100px)
- ✅ Collage d'images
- ✅ Raccourci ```

### Champ "Explication" (explain)
- ✅ Toolbar entités HTML
- ✅ Auto-resize (min 100px)
- ✅ Collage d'images
- ✅ Raccourci ```

**✅ CORRECTION APPLIQUÉE** : Tous les champs ont maintenant le même comportement.

---

## 4. Problèmes identifiés - Synthèse

### 🔴 CRITIQUE - Perte de données

1. **Re-numérotation automatique des titres** (`sidebar.js:55-56`)
   - Si titre = "Question 5", devient "Question 2" après suppression
   - Perte de l'intention utilisateur

2. **Import détruit le HTML** (`modals.js:198`)
   - `replace(/<[^>]+>/g, "")` supprime toutes les balises
   - Un prompt avec `<pre><code>` perd son code

### 🟠 MAJEUR - Affichage incorrect

3. **Images dans `_promptHtml` ne s'affichent pas** (`preview.js:35-37`)
   - `_resolveImagesInHtml` n'est pas appelé pour `_promptHtml`
   - Les wiki-links restent en texte brut

4. **Gestionnaire Escape persistant** (`hint.js:31-36`, `editor.js:153-158`)
   - Reste actif après fermeture de la view
   - Fuite mémoire potentielle

### 🟡 MINEUR - Comportements étranges

5. **Chemin des images** (`editor-form.js:133-134`)
   - Ne gère pas les variables `${file}` dans attachmentFolderPath

6. **Débounce du preview** (`preview.js:7-10`)
   - 150ms pourrait être trop court pour de grosses images

---

## 5. Scénarios non testés (edge cases)

### Scénario I : Questions avec images
**Non testé** : Performance avec 10+ images  
**Risque** : Les appels `getResourcePath()` sont synchrones, pourraient bloquer l'UI

### Scénario J : Mode examen
**Non testé** : Activation/désactivation du mode examen  
**Vérifier** : Les options d'examen sont bien exportées et ré-importées

### Scénario K : Redimensionnement des panneaux
**Non testé** : Drag rapide des séparateurs  
**Risque** : Le RAF (requestAnimationFrame) pourrait ne pas suivre

### Scénario L : Réponses avec images
**Non testé** : Options de réponse contenant des images  
**Risque** : L'input simple ligne ne permet pas de voir l'image entière

---

## 6. Recommandations

### Priorité Haute

1. **Corriger la perte de données HTML lors de l'import**
   - Ne pas supprimer les balises avec regex
   - Utiliser un parser HTML léger ou conserver le HTML tel quel

2. **Résoudre les images dans `_promptHtml`**
   - Appeler `_resolveImagesInHtml` pour tous les cas

3. **Gestionnaire d'événements propre**
   - Centraliser l'ajout/suppression des listeners
   - Utiliser `AbortController` pour un cleanup facile

### Priorité Moyenne

4. **Gestion des chemins d'images**
   - Parser `attachmentFolderPath` pour interpréter les variables

5. **Titres des questions**
   - Ne pas re-numéroter si le titre a été modifié par l'utilisateur
   - Ajouter un flag `_userModifiedTitle`

### Priorité Faible

6. **Optimisation du rendu**
   - Virtualisation pour les quiz avec 50+ questions
   - Lazy loading des images dans le preview

---

## 7. Conclusion

Le Quiz Editor est globalement bien conçu avec une architecture modulaire solide. Les récents correctifs (champs textarea uniformisés, gestion des `<br>`) ont résolu les problèmes majeurs d'affichage.

**Points forts** :
- Architecture Factory avec injection de dépendances claire
- Debouncing approprié pour les previews
- Support complet du markdown avec md2html
- Interface utilisateur réactive et bien stylisée

**Points de vigilance** :
- Risque de perte de données lors de l'import/export
- Gestion mémoire des événements à surveiller
- Quelques incohérences entre `_promptHtml` et `prompt`

**Statut global** : ✅ Fonctionnel pour l'usage standard, ⚠️ Attention aux imports/exports avec HTML
