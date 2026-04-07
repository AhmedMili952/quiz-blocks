# Correction du promptHtml

Voici le champ `promptHtml` corrigé avec les balises `<pre><code>` pour afficher correctement le bloc de commande :

```javascript
promptHtml: 'Reportez-vous à l\'illustration. Un PC d\'utilisateur a réussi à transmettre des paquets à www.cisco.com. Quelle adresse IP le PC de l\'utilisateur cible-t-il afin de transmettre ses données hors du réseau local ?<br><br><pre><code>PC&gt;tracert www.cisco.com<br>Tracing route to 172.24.2.1 over a maximum of 30 hops:<br><br>  1     1 ms     0 ms     0 ms  172.20.0.254<br>  2     0 ms     0 ms     0 ms  172.20.1.18<br>  3     1 ms     1 ms     1 ms  172.20.1.1<br>  4     2 ms     0 ms     1 ms  172.20.1.22<br>  5     2 ms     2 ms     2 ms  172.24.255.17<br>  6     2 ms     2 ms     3 ms  172.24.255.13<br>  7     2 ms     1 ms     2 ms  172.24.255.4<br>  8     3 ms     1 ms     1 ms  172.24.2.1<br><br>Trace complete.</code></pre>',
```

## Explication des changements

| Avant | Après | Pourquoi |
|-------|-------|----------|
| `PC&gt;tracert...` collé | `<pre><code>PC&gt;tracert...<br>...</code></pre>` | Bloc code séparé du texte |
| Pas de `<br>` | `<br>` entre chaque ligne | Sauts de ligne visibles |
| Tout sur une ligne | Structure HTML propre | Affichage lisible |

## Résultat attendu

Le texte s'affichera ainsi :

---

Reportez-vous à l'illustration. Un PC d'utilisateur a réussi à transmettre des paquets à www.cisco.com. Quelle adresse IP le PC de l'utilisateur cible-t-il afin de transmettre ses données hors du réseau local ?

```
PC>tracert www.cisco.com
Tracing route to 172.24.2.1 over a maximum of 30 hops:

  1     1 ms     0 ms     0 ms  172.20.0.254
  2     0 ms     0 ms     0 ms  172.20.1.18
  3     1 ms     1 ms     1 ms  172.20.1.1
  4     2 ms     0 ms     1 ms  172.20.1.22
  5     2 ms     2 ms     2 ms  172.24.255.17
  6     2 ms     2 ms     3 ms  172.24.255.13
  7     2 ms     1 ms     2 ms  172.24.255.4
  8     3 ms     1 ms     1 ms  172.24.2.1

Trace complete.
```

---

## Nouvelles fonctionnalités du Quiz Editor

Avec les modifications apportées au plugin, vous pouvez maintenant :

1. **Basculer entre édition texte et HTML** : Un toggle dans l'éditeur vous permet de choisir si vous voulez éditer le texte brut ou le HTML directement.

2. **Préserver le formatage HTML existant** : Lors de l'import d'un quiz avec `promptHtml`, l'éditeur active automatiquement le mode HTML pour préserver le formatage.

3. **Éditer le HTML directement** : Vous pouvez modifier le HTML existant sans qu'il soit converti en texte brut.

## Note

Si tu utilises l'éditeur visuel du plugin, tu peux aussi écrire en Markdown avec des triples backticks (```) et l'éditeur convertira automatiquement en `<pre><code>` à l'export. Avec la nouvelle fonctionnalité, vous avez maintenant le choix entre ces deux approches selon vos besoins.