# Recherche — configuration Stripe sandbox et propriété des plans

_Sources vérifiées le 5 septembre 2026. Cette note s'appuie uniquement sur la documentation officielle Stripe et sur le code courant de Get Some Proof. Elle ne contient aucun credential et ne prouve pas encore qu'un sandbox externe a été configuré._

## Résumé exécutif

La configuration propre sépare trois choses :

1. **Le Dashboard Stripe** configure le sandbox, le catalogue Product/Price, Checkout, le Customer Portal, le webhook et les accès de l'équipe.
2. **Les secrets du runtime** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) sont injectés exclusivement dans l'environnement serveur Convex. Ils ne doivent jamais être saisis dans l'interface Get Some Proof, stockés dans Git, exposés sous `NEXT_PUBLIC_*`, ni partagés dans un ticket ou une conversation.
3. **Le code applicatif** reste propriétaire du sens du plan : identifiant stable `pro`, fonctionnalités, quotas, permissions et règles d'accès. Stripe devient propriétaire des données commerciales et de facturation : Product/Price actif, montant, devise, cadence, Customer, Subscription, Invoice et état de paiement.

Pour le MVP à un seul plan, la configuration initiale dans le Dashboard Stripe est appropriée et plus simple qu'un provisionnement par API. Dès qu'il existe plusieurs sandboxes, plusieurs plans ou des changements fréquents, un manifeste/script idempotent contrôlé par Git devient préférable pour éviter la dérive. Les credentials restent malgré tout dans le gestionnaire de secrets du runtime, jamais dans ce manifeste.

Le prix affiché et facturé doit bien venir de Stripe. En revanche, les quotas et entitlements ne doivent pas venir des `metadata` ou `marketing_features` Stripe : ces champs sont utiles pour les surfaces commerciales Stripe, pas comme autorité d'autorisation de l'application.

## État actuel du dépôt

### Ce qui est déjà correctement séparé

- L'ADR de lancement fixe un seul plan Pro à 29 EUR/mois, sans essai, annuel, coupon ou prorata applicatif, via Checkout et Customer Portal ([ADR 0021](../adr/0021-launch-with-one-monthly-stripe-plan.md)).
- Un compte Stripe Platform global facture chaque Organization ; Stripe Connect est explicitement exclu ([ADR 0031](../adr/0031-bill-organizations-through-platform-stripe.md)).
- `SITE_URL`, `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont des variables du runtime Convex, toutes serveur uniquement ([`convex/convex.config.ts`](../../convex/convex.config.ts)).
- Le navigateur ne choisit jamais un `priceId`. Il demande seulement la clé allowlistée `pro_monthly`; le serveur résout le Price et ne renvoie au frontend que le montant, la devise, la cadence et la lookup key ([`convex/billingService.ts`](../../convex/billingService.ts)).
- Checkout est créé côté serveur avec `mode: "subscription"`, le Customer déjà lié à l'Organization, le Price résolu, des metadata de corrélation et une clé d'idempotence ([`convex/stripeBillingProvider.ts`](../../convex/stripeBillingProvider.ts)).
- Le Customer Portal est ouvert par une nouvelle session temporaire à chaque action. Le flow de récupération `past_due` cible `payment_method_update`; aucune URL de portail n'est conservée ([`convex/stripeBillingProvider.ts`](../../convex/stripeBillingProvider.ts)).
- L'accès Pro dépend d'un abonnement synchronisé qui correspond au Customer et au Price persistés par le serveur pendant Checkout, pas d'un paramètre d'URL ou d'une metadata seule ([ADR 0021](../adr/0021-launch-with-one-monthly-stripe-plan.md)).
- Le guide existant décrit déjà un rehearsal sandbox complet, y compris le faux retour Checkout, le paiement, le Portal, `past_due`, la récupération et la résiliation ([`docs/stripe-billing.md`](../stripe-billing.md)).

### Ce qui reste hardcodé ou fragile

- `pro_monthly` est correctement allowlisté dans l'application, mais le montant `2_900`, la devise `eur` et la cadence `month` sont aussi imposés dans l'adaptateur Stripe. Toute modification du tarif dans Stripe rendrait l'offre indisponible jusqu'à un déploiement du code ([`convex/stripeBillingProvider.ts`](../../convex/stripeBillingProvider.ts)).
- L'UI charge le montant depuis Stripe, mais le nom `Pro monthly` et les quatre bénéfices sont codés dans le composant Billing ([`src/components/billing/organization-billing.tsx`](../../src/components/billing/organization-billing.tsx)).
- `.env.example` et `.env.convex.example` ne donnent pas de placeholders Stripe. Le guide est exact, mais le template d'environnement ne permet pas de découvrir les variables au même endroit que les autres intégrations ([`.env.example`](../../.env.example), [`.env.convex.example`](../../.env.convex.example)).
- La recherche historique `stripe-billing-ui-flows.md` évoque encore un mensuel et un annuel, alors que l'ADR finale et le code n'autorisent plus que `pro_monthly`. Cette note doit être explicitement marquée historique ou mise à jour pour ne pas concurrencer l'ADR ([recherche UI historique](stripe-billing-ui-flows.md)).

## Configuration recommandée

### 1. Créer et isoler le sandbox

Créer un sandbox depuis le sélecteur de compte Stripe, puis vérifier son nom et son contexte avant toute action. Stripe définit un sandbox comme un environnement isolé : les paiements n'atteignent pas les réseaux de cartes et les changements ne touchent pas l'intégration live. Les utilisateurs peuvent recevoir un accès au sandbox sans obtenir l'accès aux données live ([Sandboxes](https://docs.stripe.com/sandboxes), [gestion des accès sandbox](https://docs.stripe.com/sandboxes/dashboard/manage-access)).

Pour Get Some Proof :

- un sandbox nommé sans ambiguïté, par exemple `Get Some Proof — Development` ;
- un seul sandbox associé à un seul déploiement Convex development ;
- accès humain attribué par les rôles Stripe, sans partage de secret API ;
- aucun objet live et aucun credential live pendant ce rehearsal.

Le Dashboard convient ici. La Stripe CLI est utile ensuite pour les webhooks locaux, fixtures et automatisations, mais elle ne remplace pas la vérification visuelle du compte/sandbox ciblé.

### 2. Créer le catalogue Product/Price dans Stripe

Dans le sandbox :

- Product : `Get Some Proof Pro` ;
- code fiscal Product : `txcd_10103001` (`Software as a service (SaaS) - business use`), admissible pour Managed Payments ;
- Price : récurrent mensuel, devise par défaut EUR, montant commercial courant ;
- lookup key stable : `pro_monthly` ;
- un seul Price actif résolu par cette lookup key.

Stripe recommande les lookup keys précisément pour éviter de coder un Price ID ou un montant dans le frontend : l'application récupère le Price par clé, l'affiche, puis facture ce même Price. Lors d'un changement de tarif, Stripe recommande de créer un nouveau Price — le montant d'un Price existant n'est pas modifiable — puis de transférer la lookup key avec `transfer_lookup_key=true`. Les anciens abonnements restent associés à leur Price historique ([gestion des Products et Prices](https://docs.stripe.com/products-prices/manage-prices)).

Les nouveaux comptes peuvent aussi avoir Managed Payments activé par défaut. Stripe exige alors un code fiscal Product admissible avant de créer Checkout ; `txcd_10103001` correspond au SaaS cloud destiné à un usage professionnel ([configuration Managed Payments](https://docs.stripe.com/payments/managed-payments/set-up), [codes admissibles](https://docs.stripe.com/payments/managed-payments/how-it-works)).

Conséquence pour Get Some Proof :

- conserver `pro_monthly` comme contrat applicatif stable ;
- charger depuis Stripe `price.id`, `unit_amount`, `currency`, `recurring.interval`, `active` et le Product associé ;
- utiliser exactement le `price.id` résolu pour Checkout et conserver le mapping serveur existant ;
- afficher le montant réel du Price historique pour un abonnement existant ;
- ne plus exiger `unit_amount === 2900` pour qu'un Price soit valide si l'objectif est de changer le tarif sans redéployer ;
- conserver les invariants produit réellement intentionnels, par exemple `currency === "eur"` et `interval === "month"`, tant que l'offre annuelle ou multidevise n'est pas approuvée.

Stripe recommande aussi de mettre les Prices en cache pour réduire la latence et le risque de rate limiting. Pour ce MVP, un cache serveur court ou une matérialisation contrôlée dans Convex suffit ; le Checkout doit néanmoins résoudre ou revalider le Price côté serveur avant de créer la session ([gestion des Products et Prices](https://docs.stripe.com/products-prices/manage-prices)).

### 3. Stocker les credentials dans l'environnement Convex

Le code actuel utilise uniquement l'API serveur et Stripe-hosted Checkout. Aucune clé publishable n'est nécessaire dans le navigateur.

| Variable                | Fournisseur                                    | Runtime                                    | Usage                                                                           | Placement exact                                      |
| ----------------------- | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | API keys du sandbox Stripe                     | Actions serveur Convex et composant Stripe | Lire les Prices, créer Customer/Checkout/Portal, relire Subscription et Invoice | Environnement du déploiement Convex development      |
| `STRIPE_WEBHOOK_SECRET` | Secret unique de l'endpoint webhook du sandbox | Route HTTP Convex                          | Vérifier `Stripe-Signature` avant toute synchronisation                         | Environnement du même déploiement Convex development |
| `SITE_URL`              | Configuration de déploiement Get Some Proof    | Actions serveur Convex                     | Construire les URLs de succès, annulation et retour Portal                      | Environnement du même déploiement Convex development |

Stripe exige que les secret keys restent dans l'environnement serveur et recommande un vault ou, à défaut, des variables d'environnement. Stripe recommande aussi des restricted keys, la rotation et l'audit des request logs ([bonnes pratiques des clés](https://docs.stripe.com/keys-best-practices), [types de clés](https://docs.stripe.com/keys)).

Pour le premier rehearsal, une secret key standard du sandbox est acceptable afin de valider tout le périmètre du composant Stripe. Avant la production, relever dans les request logs les ressources réellement utilisées et tester une restricted key avec les droits minimaux. Le périmètre probable inclut Products/Prices en lecture, Customers, Checkout Sessions, Billing Portal Sessions, Subscriptions et les objets de synchronisation d'Invoices ; il faut le confirmer par un rehearsal complet, pas le deviner.

Le webhook signing secret n'est pas une API key. Il est propre à un endpoint et à un contexte Stripe ; même avec un même URL, test et live ont des secrets distincts ([webhooks Stripe](https://docs.stripe.com/webhooks)).

### 4. Configurer Checkout et Customer Portal dans Stripe

Checkout ne nécessite pas de formulaire de paiement dans l'application. Le code actuel transmet le Customer, le Price, `mode=subscription`, les URLs et la metadata attendue : c'est le bon périmètre applicatif.

Dans le Dashboard du sandbox :

- configurer le nom public, le logo, la couleur, le support et les liens légaux ;
- activer le Customer Portal ;
- activer la mise à jour du moyen de paiement et l'historique des factures ;
- autoriser la résiliation à la fin de la période ;
- laisser le changement de plan désactivé tant qu'il n'existe qu'un seul plan ;
- définir le profil commercial et l'URL de retour par défaut.

Stripe permet de configurer le Portal dans le Dashboard ou par API. Le Portal gère les données de facturation, moyens de paiement, factures, changements et résiliations ; les sessions sont temporaires et doivent être recréées à la demande ([Customer Portal](https://docs.stripe.com/customer-management), [configuration du Portal](https://docs.stripe.com/customer-management/configure-portal), [deep links](https://docs.stripe.com/customer-management/portal-deep-links)).

### 5. Enregistrer le webhook du sandbox

Créer dans Stripe Workbench un endpoint vers :

```text
https://<development-deployment>.convex.site/stripe/webhook
```

Le host est le site Convex public, pas l'origin Next.js. Sélectionner seulement les événements réellement consommés par le composant et l'application ; la liste actuelle est documentée dans [`docs/stripe-billing.md`](../stripe-billing.md).

Stripe impose :

- endpoint HTTPS publiquement accessible pour un endpoint enregistré ;
- vérification de la signature avec le body brut, le header `Stripe-Signature` et le secret `whsec_` ;
- déduplication par Event ID ;
- tolérance aux événements hors ordre ;
- réponse `2xx` rapide et traitement asynchrone ;
- abonnement limité aux types d'événements nécessaires.

Stripe réessaie les événements d'un sandbox trois fois sur quelques heures, ne garantit pas leur ordre et peut envoyer des doublons ([comportement et bonnes pratiques webhook](https://docs.stripe.com/webhooks)). L'architecture courante — événement durable, déduplication, génération et relecture de l'état complet — est alignée avec ces contraintes.

Les abonnements sont intrinsèquement asynchrones : Stripe recommande de piloter les changements d'accès depuis les événements de Subscription/Invoice ou ses Entitlements, et non depuis la page de retour Checkout ([webhooks d'abonnement](https://docs.stripe.com/billing/subscriptions/webhooks), [fonctionnement des abonnements](https://docs.stripe.com/billing/subscriptions/overview)).

## Qui possède quoi ?

| Donnée ou règle                                           | Source d'autorité recommandée                                     | Pourquoi                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identifiant sémantique `free` / `pro`                     | Application                                                       | Stable dans le domaine, les permissions, l'analytics et les migrations                                                                                                  |
| Lookup key `pro_monthly` autorisée                        | Application                                                       | Empêche le navigateur de demander un Price arbitraire et forme le pont stable vers Stripe                                                                               |
| Product ID / Price ID courant                             | Stripe, résolu côté serveur                                       | Identifiants provider ; ne doivent pas être saisis par le client                                                                                                        |
| Montant, devise, cadence, statut actif                    | Stripe Price                                                      | Ce sont les termes effectivement facturés et affichés par Checkout                                                                                                      |
| Nom/description visibles dans Checkout, facture et Portal | Stripe Product                                                    | Cohérence des surfaces Stripe hébergées                                                                                                                                 |
| Nom court `Pro` dans la navigation produit                | Application                                                       | Terme de domaine stable, indépendant d'un libellé commercial modifiable                                                                                                 |
| Copy marketing longue de la page Billing                  | Application ou CMS versionné                                      | Doit être relue, localisée et déployée avec l'expérience produit                                                                                                        |
| `marketing_features` Stripe                               | Miroir facultatif de la copy commerciale                          | Stripe les affiche dans ses pricing tables ; elles ne doivent pas accorder de droits ([Product object](https://docs.stripe.com/api/products/object))                    |
| Quotas, limites, capacités, RBAC                          | Application                                                       | Ce sont des règles d'autorisation testables et versionnées avec le code                                                                                                 |
| Metadata `orgId`, `planKey`, corrélation                  | Stripe comme index secondaire, application comme autorité         | Stripe décrit metadata comme des paires pour référence ; elles sont modifiables et ne remplacent pas la base applicative ([metadata](https://docs.stripe.com/metadata)) |
| Customer, Subscription, Invoice, paiement, échéance       | Stripe, synchronisé dans Convex                                   | Stripe possède le cycle de facturation ; Convex matérialise l'état nécessaire au produit                                                                                |
| Entitlement effectif                                      | Application à partir d'un état Stripe signé et du mapping serveur | Permet la grace period, les règles Free et le contrôle Organization-scoped                                                                                              |

### Réponse directe à « afficher les plans depuis Stripe ? »

**Oui pour les données facturables, non pour les règles produit.**

L'UI doit afficher le montant, la devise et la cadence renvoyés par le serveur après résolution du Price Stripe. Elle peut aussi utiliser le nom et la description du Product Stripe sur les surfaces commerciales si cela apporte une cohérence utile. Mais l'application doit continuer à définir que `pro_monthly` correspond au plan `pro`, et que `pro` donne, par exemple, 25 vidéos Ready et retire l'attribution.

Charger les quotas depuis `Product.metadata` créerait une dépendance d'autorisation à une édition manuelle du Dashboard Stripe, sans revue de code ni migration coordonnée. Les `marketing_features` sont conçues pour l'affichage dans les pricing tables Stripe, pas pour l'application de quotas ([Product object](https://docs.stripe.com/api/products/object), [pricing table](https://docs.stripe.com/payments/checkout/pricing-table)).

## Migration recommandée du code actuel

### Étape 1 — clarifier le contrat du plan

Créer une définition applicative versionnée qui contient uniquement :

- `planKey: "pro"` ;
- `lookupKey: "pro_monthly"` ;
- invariants acceptés : récurrent, mensuel, EUR ;
- entitlements et quotas ;
- copy produit locale.

Ne pas y stocker de `priceId` ni de montant.

### Étape 2 — rendre le montant réellement Stripe-owned

- supprimer la validation `unit_amount === 2900` pour l'offre courante ;
- supprimer cette même hypothèse lors de la lecture du Price historique d'un abonnement ;
- continuer à rejeter un Price absent, ambigu, inactif pour une nouvelle vente, non récurrent, non mensuel ou non EUR ;
- résoudre le Product avec le Price et vérifier qu'il est actif pour une nouvelle vente ;
- conserver le mapping exact Customer/Price déjà persisté lors du Checkout ;
- conserver une réponse frontend sans `priceId`.

Cette migration permet de passer de 29 EUR à un nouveau prix par création d'un Price et transfert de `pro_monthly`, sans déployer du code, tout en laissant les abonnés existants sur leur Price historique.

### Étape 3 — ajouter un contrôle de dérive

Ajouter une commande read-only ou un health check administrateur qui échoue si :

- `pro_monthly` ne résout pas exactement un Price de nouvelle vente ;
- le Product ou le Price est inactif ;
- la devise/cadence ne respecte pas le contrat applicatif ;
- le Portal sandbox n'est pas configuré ;
- le webhook attendu ou ses événements sont absents.

Le check ne doit jamais imprimer une clé, un secret de webhook, une URL de session Checkout/Portal ou des données de carte.

### Étape 4 — compléter la documentation d'environnement

Ajouter des placeholders non secrets à `.env.convex.example` pour `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `SITE_URL`, avec les commandes d'import vers le déploiement Convex. Ne pas dupliquer ces secrets dans `.env.local`.

### Étape 5 — automatiser seulement quand cela devient rentable

Pour un catalogue d'un seul plan, une checklist Dashboard vérifiée est suffisante. Si le catalogue grandit, ajouter un script idempotent qui :

- retrouve le Product par une clé métier versionnée ;
- crée ou vérifie le Price attendu ;
- transfère la lookup key lors d'un changement de tarif ;
- archive l'ancien Price pour les nouvelles ventes sans toucher aux abonnements existants ;
- configure ou vérifie le Portal et le webhook ;
- produit un rapport redacted et ne manipule les secrets qu'à travers l'environnement.

## Checklist de configuration et de vérification

### Cible et accès

- [ ] Le nom du nouveau compte Stripe, du sandbox et du déploiement Convex development est enregistré sans secret.
- [ ] Le Dashboard est explicitement dans ce sandbox avant toute création.
- [ ] Les collaborateurs utilisent des rôles Stripe ; aucune clé n'a été partagée par email, chat, issue ou capture.
- [ ] Aucun mode live ni déploiement Convex production n'est dans le périmètre.

### Catalogue

- [ ] Le Product `Get Some Proof Pro` existe et est actif.
- [ ] Le Product utilise `txcd_10103001`, code fiscal SaaS business admissible pour Managed Payments.
- [ ] `pro_monthly` résout exactement un Price actif, récurrent, mensuel et EUR.
- [ ] Le montant affiché dans Get Some Proof correspond au Price Stripe observé.
- [ ] Le `priceId` n'est ni fourni par le navigateur ni exposé dans l'offre publique.
- [ ] Les quotas et fonctionnalités restent définis et testés dans l'application.

### Secrets et runtime

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et `SITE_URL` sont définis uniquement dans le déploiement Convex development visé.
- [ ] La clé API appartient bien au sandbox et n'est ni live ni exposée au frontend.
- [ ] Le secret webhook vient exactement de l'endpoint de ce sandbox.
- [ ] Aucun secret ou URL de session temporaire n'apparaît dans Git, logs partagés, captures, issues ou rapport de rehearsal.
- [ ] Un plan de rotation et d'audit des request logs existe avant le live.

### Checkout et Portal

- [ ] Checkout et le profil public Stripe ont le nom, branding, support et liens légaux attendus.
- [ ] Le Customer Portal sandbox est activé.
- [ ] Mise à jour du moyen de paiement et historique des factures sont activés.
- [ ] Résiliation à fin de période est activée ; changement de plan et résiliation immédiate sont désactivés pour le MVP.
- [ ] Chaque clic Owner crée une nouvelle session Portal et revient à la bonne Organization.

### Webhook

- [ ] L'endpoint est le `convex.site/stripe/webhook` du déploiement development exact.
- [ ] Seuls les événements requis et documentés sont sélectionnés.
- [ ] Une livraison signée réelle reçoit `2xx` dans Stripe Workbench.
- [ ] Un replay du même Event ID n'applique pas l'effet deux fois.
- [ ] Un enchaînement hors ordre converge vers l'état Stripe courant.
- [ ] Un secret faux ou provenant d'un autre endpoint est rejeté.

### Lifecycle sandbox

- [ ] Un faux `?checkout=success` laisse le Workspace Free.
- [ ] Un Checkout sandbox réussi crée un seul Customer et un seul abonnement non terminal.
- [ ] Pro n'est accordé qu'après synchronisation du webhook signé.
- [ ] Le Portal affiche factures, moyen de paiement et résiliation.
- [ ] Un renouvellement en échec passe par `past_due`, conserve la grace prévue et se rétablit après paiement.
- [ ] Une résiliation à fin de période conserve Pro jusqu'à l'échéance puis réapplique Free.
- [ ] Un changement de Price via transfert de lookup key affecte les nouvelles ventes sans casser l'affichage des abonnements historiques.
- [ ] Les simulations Stripe/Test Clocks couvrent renouvellement, échec et résiliation ([test clocks](https://docs.stripe.com/billing/testing/test-clocks)).

## Décision proposée

Adopter le split suivant :

```text
Application (versionnée)                 Stripe (sandbox puis live)
--------------------------------------   ---------------------------------
planKey, lookupKey allowlistée           Product et Price IDs
quotas, capacités, RBAC                   montant, devise, cadence
grace period et règles d'accès            Customer, Subscription, Invoice
copy produit et localisation              paiement, facture, état financier
mapping Organization -> Customer/Price <- webhooks signés et objets relus
```

La prochaine implémentation doit donc retirer seulement le montant hardcodé comme garde de validité, pas déplacer les entitlements dans Stripe. Elle doit aussi ajouter un check de catalogue redacted et compléter le template d'environnement. La configuration externe reste un rehearsal sandbox séparé, avec preuve du Checkout, Portal et webhook avant tout travail live.
