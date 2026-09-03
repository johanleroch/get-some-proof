# Recherche UI — Billing Stripe par Organization

_Sources vérifiées le 1er septembre 2026. Cette note alimente la conception de l’intégration ; ce n’est ni une implémentation ni une copie d’interface tierce._

## Résumé exécutable

Le bon modèle pour ce boilerplate est une page dédiée `Organization > Billing` qui sert de **tableau de contrôle**, tandis que Stripe prend en charge les écrans sensibles :

- l’application affiche le plan courant, le vrai tarif Stripe, la cadence, la prochaine échéance et les états demandant une action ;
- un Owner choisit mensuel ou annuel puis est redirigé vers Stripe Checkout pour souscrire ;
- un Owner ouvre une session Stripe Customer Portal à la demande pour gérer paiement, factures, informations de facturation et résiliation ;
- un Admin peut lire l’état de Billing, mais ne voit pas de faux bouton désactivé : le texte lui indique qu’un Owner doit effectuer l’action financière ;
- la réussite affichée après Checkout reste transitoire jusqu’à la confirmation serveur issue des webhooks ;
- les états `past_due`, `cancel_at_period_end` et `unavailable` ont chacun une présentation et une action distinctes.

Cette séparation donne bien une intégration déclenchée et pilotée depuis l’UI sans reconstruire un formulaire de carte bancaire dans le boilerplate. Les secrets du compte Stripe global restent nécessairement côté serveur.

## Limite de la recherche

Mobbin était demandé comme première source d’inspiration, mais aucun outil Mobbin appelable n’était disponible dans cette session. La recherche a donc été limitée à des sources primaires publiques : documentation et samples officiels Stripe, puis documentation officielle Linear comme référence SaaS Organization-scoped. Les recommandations ci-dessous sont adaptées au shell réel du dépôt ; elles ne prétendent pas reproduire un écran observé dans Mobbin.

Les mentions suivantes distinguent le niveau de preuve :

- **Fait** : comportement décrit par la source qui possède le produit ou directement observé dans le dépôt.
- **Implication** : conséquence du comportement Stripe pour notre flow.
- **Recommandation** : choix d’interface proposé pour ce boilerplate.

## Ce que les sources Stripe imposent au flow

### 1. Souscription : choisir dans l’application, payer dans Checkout

**Fait.** Stripe présente la page hébergée Checkout comme un flow à faible effort où le client quitte l’application, saisit ses informations de paiement sur une page Stripe, puis revient dans l’application. Le guide officiel de souscription couvre explicitement un prix fixe, un bouton de Checkout, des URLs de réussite et d’annulation, les événements d’abonnement et le Customer Portal. ([Checkout hébergé](https://docs.stripe.com/payments/checkout), [guide d’abonnement Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions?payment-ui=stripe-hosted))

**Fait.** Stripe permet de personnaliser la page hébergée avec le nom, le logo ou l’icône, le fond, la couleur du bouton, la police et la forme des contrôles. La page reste toutefois volontairement moins personnalisable qu’un formulaire construit sur mesure. ([apparence de Checkout](https://docs.stripe.com/payments/checkout/customization/appearance?integration=api&payment-ui=stripe-hosted))

**Recommandation.** L’écran interne ne doit pas imiter Checkout. Il doit préparer une décision simple :

1. afficher Free et Premium ;
2. sélectionner `Monthly` ou `Annual` ;
3. afficher le montant et la devise chargés depuis Stripe ;
4. lancer `Continue to secure checkout` ;
5. rediriger vers l’URL de session retournée par le serveur.

Le bouton peut inclure une icône de lien externe et une courte aide « You’ll finish securely on Stripe ». Il ne faut pas ajouter de formulaire de carte, de champ d’adresse complet ou de faux récapitulatif fiscal dans l’application.

### 2. Retour de Checkout : un message, pas une preuve d’accès

**Fait.** Stripe prévient qu’une page de réussite ne suffit pas à provisionner un achat : un client peut payer sans jamais charger cette page. Les webhooks sont le moyen fiable de confirmer le paiement, et Stripe les réessaie en cas d’échec de livraison. ([page de réussite Checkout](https://docs.stripe.com/payments/checkout/custom-success-page), [fulfillment Checkout](https://docs.stripe.com/checkout/fulfillment))

**Implication.** `?success=true` ou un `session_id` dans l’URL ne doit jamais transformer localement l’Organization en Premium.

**Recommandation.** Au retour de Checkout :

- afficher `Payment received. Confirming your Premium plan…` dans un message `role="status"` ;
- laisser la requête Convex réactive mettre à jour l’écran dès que le webhook a synchronisé l’abonnement ;
- si le retour est annulé, afficher `Checkout canceled. No changes were made.` et conserver la sélection de cadence ;
- après un délai raisonnable, remplacer le message d’attente par une aide non alarmiste et un bouton `Refresh status`, sans accorder Premium par anticipation.

Le sample officiel `checkout-single-subscription` confirme le passage `pricing -> Checkout -> success -> Manage Billing`, mais son HTML est une démonstration minimale et non une référence visuelle à copier. ([sample Stripe officiel](https://github.com/stripe-samples/checkout-single-subscription), [écran success du sample](https://github.com/stripe-samples/checkout-single-subscription/blob/master/client/success.html))

### 3. Une Organization, un abonnement

**Fait.** Stripe permet de limiter un Customer à un abonnement et de rediriger un client ayant déjà un abonnement vers le Customer Portal plutôt que vers un deuxième Checkout. ([limiter les abonnements](https://docs.stripe.com/payments/checkout/limit-subscriptions))

**Recommandation.** Dès qu’une souscription non terminale existe pour l’Organization, remplacer toute action `Upgrade` par `Manage billing in Stripe`. La prévention définitive des doublons reste côté serveur ; masquer un bouton dans l’UI n’est pas un contrôle suffisant.

### 4. Gestion : ouvrir une session Customer Portal à la demande

**Fait.** Le portail hébergé permet de mettre à jour les informations de facturation et moyens de paiement, gérer ou résilier l’abonnement, et consulter ou télécharger les factures. Une session de portail fournit une URL temporaire ; Stripe recommande de créer une nouvelle session lorsque le client demande à gérer sa facturation et de l’authentifier avant cette création. ([capacités du portail](https://docs.stripe.com/customer-management), [intégration du portail](https://docs.stripe.com/customer-management/integrate-customer-portal))

**Fait.** Les deep links du portail peuvent cibler directement `payment_method_update`, `subscription_cancel`, `subscription_update` ou une confirmation de changement, puis revenir vers l’application. ([deep links du portail](https://docs.stripe.com/customer-management/portal-deep-links))

**Recommandation.** Ne pas reconstruire dans la v1 un tableau de factures ou un formulaire de carte :

- le CTA normal est `Manage billing in Stripe` vers l’accueil du portail ;
- l’état `past_due` utilise un CTA plus précis, `Update payment method`, vers le deep link correspondant ;
- le portail doit être configuré pour afficher l’historique des factures, les informations de facturation et la résiliation à fin de période ;
- le portail est une destination Stripe hébergée ouverte par redirection, pas une iframe à intégrer dans la carte Billing ;
- chaque clic crée une nouvelle session ; ne jamais stocker ni réutiliser l’URL temporaire.

### 5. Prix mensuel et annuel

**Fait.** Stripe recommande les `lookup_key` lorsqu’un produit doit afficher et facturer des prix gérés dans Stripe sans coder en dur leur montant. Une lookup key peut servir à récupérer le Price utilisé à la fois pour l’affichage et pour la facturation. ([gestion des prix et lookup keys](https://docs.stripe.com/products-prices/manage-prices?dashboard-or-api=api))

**Recommandation.** Le sélecteur ne transmet jamais un `priceId` arbitraire. Il choisit seulement l’une des deux valeurs autorisées : `premium_monthly` ou `premium_annual`. Le serveur résout le Price Stripe, et l’UI affiche le montant, la devise et l’intervalle renvoyés. Si un gain annuel est affiché, il doit être calculé depuis ces deux Price actuels ; ne pas coder en dur « Save 20% ».

## Référence SaaS utile : Linear

**Fait.** La documentation Linear place la facturation d’un workspace dans `Settings > Administration > Billing`. Cet écran regroupe plan, modification du plan, moyen de paiement, email de facturation, historique, échecs de charge et retards de paiement. Linear explique aussi explicitement la cadence mensuelle ou annuelle et l’effet d’une résiliation à la fin de la période. ([Billing and plans — Linear](https://linear.app/docs/billing-and-plans))

**Recommandation.** Retenir la hiérarchie, pas le branding :

- Billing appartient au contexte de l’Organization, à côté de Settings et Audit Log ;
- le plan et son état arrivent avant les détails administratifs ;
- les problèmes de paiement sont visibles sur cette même page, sans créer un écran d’erreur séparé ;
- cadence, échéance et conséquence d’une résiliation sont écrites en langage clair.

Le modèle de tarification Linear est à la place et diffère du forfait fixe retenu ici ; il ne faut pas reprendre ses contrôles de quantité ou sa logique de prorata.

La documentation officielle Slack confirme un second pattern utile : regrouper sous un même espace de facturation un aperçu du plan et de la cadence, les informations de facturation et l’historique, tout en séparant le droit de consulter d’un contact Billing du droit de modifier le paiement. ([Manage your Slack plan and billing details](https://slack.com/help/articles/218915087-Manage-your-Slack-plan-and-billing-details))

Pour ce boilerplate, ces sous-sections ne justifient pas encore des onglets locaux : Checkout et le portail Stripe possèdent déjà paiement et historique. Le pattern à retenir est la distinction nette entre **résumé lisible dans l’application** et **actions financières réservées**, pas la structure complète de Slack.

## Adaptation au shell shadcn existant

### Emplacement

**Fait observé dans le dépôt.** `AppShell` possède déjà un contexte `Organization` séparé avec `Organization settings` et `Audit Log`. Les pages utilisent un titre `dashboard-page-title`, une description `dashboard-page-description`, des cartes `bg-card rounded-xl border ... shadow-xs`, des messages sémantiques et une mise en page responsive.

**Recommandation.** Ajouter :

- route : `/org/[organizationSlug]/billing` ;
- item : `Billing` avec une icône de carte bancaire, entre `Organization settings` et `Audit Log` ;
- visibilité : Owner et Admin ;
- largeur du contenu : `max-w-4xl`, afin de conserver la densité des écrans Settings sans étirer les prix et textes sur tout le dashboard.

Il faut étendre la détection `organizationContext` à la route Billing ; sinon le shell retournera sur la navigation Workspace au lieu d’afficher la section Organization.

### Composition recommandée

Ordre vertical de la page :

1. **En-tête** — `Billing` et « Manage this Organization’s plan and billing details. »
2. **Bannière d’état conditionnelle** — uniquement pour confirmation en cours, `past_due`, fin programmée ou indisponibilité.
3. **Current plan** — carte principale avec badge textuel, prix/cadence, date de renouvellement ou fin d’accès, puis action Owner.
4. **Choose a plan** — seulement quand l’Organization est Free et Stripe disponible : sélecteur Monthly/Annual, carte Free actuelle et carte Premium.
5. **Billing contact** — résumé de l’identité de facturation de l’Organization ; édition Owner dans l’application si ce champ appartient au domaine applicatif.
6. **Secure billing note** — texte discret indiquant que paiement et factures sont gérés sur Stripe.

Pour Premium actif, masquer le comparateur Free/Premium : l’écran est un résumé de gestion, pas une page marketing permanente.

### Blueprint desktop

```text
Billing
Manage this Organization’s plan and billing details.

[conditionnel : bannière Payment needs attention / Premium ends…]

┌ Current plan ─────────────────────────────────────────────┐
│ Premium  [Active]             €XX / month                 │
│ Renews on 12 Oct 2026         [Manage billing in Stripe]  │
└────────────────────────────────────────────────────────────┘

Free uniquement :
                           [ Monthly | Annual ]
┌ Free ────────────────────┐  ┌ Premium ───────────────────┐
│ Current plan             │  │ €XX / month               │
│ View projects            │  │ Create and manage projects│
│ [Current]                │  │ [Continue to checkout]    │
└──────────────────────────┘  └────────────────────────────┘

┌ Billing contact ──────────────────────────────────────────┐
│ Organization name / billing email / address       [Edit] │
└────────────────────────────────────────────────────────────┘
```

La liste de bénéfices doit rester liée à des entitlements réellement implémentés. Pour la première preuve, `Create and manage projects` suffit ; ne pas inventer une longue grille de fonctionnalités Premium.

### Blueprint mobile

- conserver le même ordre sémantique ;
- empiler toutes les cartes sur une colonne ;
- rendre le sélecteur Monthly/Annual et les CTA pleine largeur ;
- mettre le prix sous le nom du plan plutôt qu’à droite ;
- éviter tout tableau horizontal : Stripe gère les factures dans son portail responsive ;
- garder la bannière et l’action prioritaire visibles avant le comparateur de plans.

## Matrice des états de l’écran

| État métier affiché                                        | Présentation recommandée                                                                                  | Action Owner                                                                  | Vue Admin                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| Free                                                       | Badge neutre `Free`, aucune échéance                                                                      | `Upgrade to Premium` après choix de cadence                                   | `An Owner can upgrade this Organization.`    |
| Checkout en cours de confirmation                          | Message neutre `Confirming your Premium plan…`, Free reste effectif                                       | `Refresh status` après délai                                                  | Même état, sans action financière            |
| `active` ou `trialing`                                     | Badge positif `Premium · Active`, prochaine échéance et cadence                                           | `Manage billing in Stripe`                                                    | Statut et échéance en lecture seule          |
| `past_due`                                                 | Bannière ambre `Payment needs attention`; préciser que Premium reste temporairement disponible            | `Update payment method` vers un deep link portail                             | `Ask an Owner to update the payment method.` |
| `cancel_at_period_end=true` sur un abonnement encore actif | Badge/bannière ambre douce `Premium ends on <date>` ; ne pas afficher `Canceled` avant la date            | `Manage plan in Stripe`                                                       | Date de fin en lecture seule                 |
| `unpaid`, `canceled`, `incomplete_expired`                 | Plan effectif `Free` avec explication courte ; ne pas exposer seulement le statut API brut                | `Subscribe to Premium` si une nouvelle souscription est autorisée             | Free en lecture seule                        |
| Stripe non configuré ou indisponible                       | Bannière neutre `Billing is unavailable. This Organization remains on Free.` ; le reste de l’app continue | aucune action de paiement ; éventuellement `Retry` pour une panne transitoire | Même information                             |

Stripe définit officiellement les statuts `trialing`, `active`, `incomplete`, `incomplete_expired`, `past_due`, `canceled`, `unpaid` et `paused`, et recommande de prévenir le client puis de lui faire mettre à jour ses informations de paiement lorsque l’abonnement devient `past_due`. ([cycle et statuts d’abonnement](https://docs.stripe.com/billing/subscriptions/overview), [webhooks d’abonnement et échecs de paiement](https://docs.stripe.com/billing/subscriptions/webhooks))

Pour une résiliation programmée, Stripe garde l’abonnement jusqu’à la fin de la période déjà payée et permet de stopper la résiliation avant cette date. `customer.subscription.updated` signale le passage de `cancel_at_period_end`; `customer.subscription.deleted` signale la fin effective. ([résiliation Stripe](https://docs.stripe.com/billing/subscriptions/cancel))

## Permissions et affordances

### Owner

L’Owner peut :

- démarrer Checkout ;
- créer une session Customer Portal ;
- ouvrir un deep link de mise à jour du paiement ;
- modifier le contact de facturation de l’Organization.

### Admin

L’Admin peut voir :

- Free ou Premium ;
- cadence et tarif ;
- prochaine échéance ou fin programmée ;
- problème de paiement ou indisponibilité ;
- contact de facturation si cette donnée est déjà considérée lisible par les Admins.

L’Admin ne doit pas recevoir une URL de portail : cette URL donne accès à des actions financières. Préférer une phrase claire à un bouton désactivé, par exemple `Only an Owner can change the plan or payment details.`

Les contrôles doivent également être appliqués côté Convex ; la visibilité conditionnelle n’est qu’une affordance d’interface.

## Détails de langage et d’accessibilité

- Employer les libellés produit `Free` et `Premium`, puis traduire les statuts Stripe en phrases humaines.
- Ne jamais s’appuyer sur la couleur seule : badge + texte + date/conséquence.
- Utiliser `role="alert"` pour un paiement nécessitant une action immédiate et `role="status"` pour une confirmation ou réussite non bloquante.
- Le bouton de redirection passe à `Opening secure checkout…` ou `Opening Stripe…` pendant la création de session et empêche le double clic.
- En cas d’erreur de création de session, rester sur place, rendre le bouton à nouveau disponible et afficher une erreur précise mais non technique.
- Après une résiliation programmée, écrire `Premium remains available until <date>` plutôt qu’un badge ambigu `Canceled`.
- Sur `past_due`, éviter le rouge destructif tant que Premium est conservé pendant les relances ; l’ambre indique mieux un problème récupérable. Réserver le style destructif aux états terminaux qui ont effectivement retiré l’accès.
- Vérifier light/dark et les deux viewports Playwright du dépôt ; conserver les tokens du thème plutôt qu’une couleur Stripe violette ou bleue injectée dans l’application.

## Ce qu’il ne faut pas construire dans cette première intégration

- un écran Stripe Connect ou OAuth par Organization : le compte Stripe est global à la société qui exploite le SaaS ;
- un formulaire de paiement custom avec Elements ;
- une table locale de factures qui duplique le Customer Portal ;
- un écran local de modification de carte ;
- plusieurs abonnements parallèles pour une Organization ;
- une tarification par siège ou des contrôles de quantité ;
- un badge Premium déduit de l’URL de retour Checkout ;
- des montants, pourcentages d’économie ou `priceId` codés en dur dans le navigateur ;
- le branding d’un produit observé : seuls l’ordre de l’information et les patterns comportementaux sont réutilisés.

## Checklist de preuve UI pour l’implémentation

La livraison visuelle devra couvrir au minimum, en desktop et mobile :

- Free Owner, cadence mensuelle ;
- Free Owner, cadence annuelle ;
- Free Admin en lecture seule ;
- Premium actif ;
- Premium `past_due` avec action de récupération ;
- Premium avec `cancel_at_period_end` et date explicite ;
- Stripe indisponible ;
- retour Checkout en attente de synchronisation.

Le test de bout en bout en Stripe sandbox doit en plus prouver le passage réel vers Checkout, le retour dans Billing, la mise à jour réactive après webhook et l’ouverture d’une nouvelle session Customer Portal. Les captures de l’application ne doivent pas inclure de données de carte ou d’URL de session Stripe.
