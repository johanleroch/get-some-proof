# Architecture d’authentification, de multi-tenancy et d’autorisation

_État des sources vérifié le 30 août 2026. Ce document est une recherche d’architecture, pas une implémentation ni un audit de sécurité formel._

## Résumé exécutif

**Verdict : `@convex-dev/better-auth` et `@djpanda/convex-authz` sont compatibles par composition, mais ils n’offrent pas une intégration dédiée entre eux.** Better Auth fournit une identité et une session validées à Convex ; `convex-authz` accepte ensuite un `userId` et un `tenantId` sous forme de chaînes pour prendre une décision d’autorisation. La fiche officielle du composant indique explicitement que `convex-authz` fonctionne après n’importe quel système d’authentification Convex. ([Convex Components](https://www.convex.dev/components/djpanda/convex-authz#frequently-asked-questions), [source `Authz`](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/client/index.ts#L499-L575))

La structure recommandée pour la première version commercialisable du template est :

- **Better Auth + le composant Convex** gèrent les utilisateurs, comptes, fournisseurs OAuth, sessions, validation JWT et éventuellement MFA.
- **Le domaine de l’application** gère les organisations, adhésions et invitations dans des tables Convex de premier niveau.
- **`convex-authz`** est la source d’autorité pour les rôles et permissions effectifs au sein de chaque organisation.
- **Une couche serveur unique** dérive l’acteur et le tenant, puis appelle `authz.withTenant(verifiedOrganizationId).require(...)`. Ni `userId` ni `tenantId` reçus du navigateur ne constituent une preuve d’accès.

Il est déconseillé d’inclure le plugin Organization de Better Auth dans le socle initial. Il n’est pas dans la liste des plugins officiellement supportés « out of the box » par l’intégration Convex, il impose une installation locale et une régénération de schéma, et un bug ouvert reproduit l’échec des invitations avec les versions étudiées. ([plugins supportés](https://labs.convex.dev/better-auth/supported-plugins), [installation locale](https://labs.convex.dev/better-auth/features/local-install), [issue #407](https://github.com/get-convex/better-auth/issues/407))

Enfin, les versions sont compatibles, mais le template doit les verrouiller : `@convex-dev/better-auth@0.12.5` refuse Better Auth 1.7, alors que `better-auth@latest` vaut actuellement `1.7.2`. La dernière branche compatible observée est `1.6.x`, actuellement `1.6.30`. ([peer dependencies publiées](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/package.json#L101-L106), [issue de compatibilité 1.7 #433](https://github.com/get-convex/better-auth/issues/433))

## Méthode et niveau de preuve

Les affirmations ci-dessous sont classées ainsi :

- **Fait** : comportement ou contrainte affirmé par une source primaire actuelle, ou directement visible dans le code publié.
- **Inférence** : conclusion tirée de plusieurs faits ; elle n’est pas une garantie fournie par les mainteneurs.
- **Recommandation** : choix proposé pour ce template.

Les sources obligatoires ont toutes été consultées : la [documentation Convex + Better Auth](https://labs.convex.dev/better-auth), son [dépôt](https://github.com/get-convex/better-auth), la [fiche Convex de `convex-authz`](https://www.convex.dev/components/djpanda/convex-authz), son [dépôt](https://github.com/dbjpanda/convex-authz), les métadonnées npm en direct, et les Markdown fournis dans la conversation.

Context7 a été utilisé comme index de découverte avec les identifiants `/websites/labs_convex_dev_better-auth`, `/get-convex/better-auth` et `/dbjpanda/convex-authz`. Il n’est pas utilisé comme preuve finale : une partie de son corpus `convex-authz` pointait encore vers un ancien dossier `_autodocs`. Chaque API et version importante a donc été recoupée avec le paquet npm, les sources GitHub au commit publié et la documentation officielle en direct.

Le Markdown `convex-authz` fourni par l’utilisateur correspond bien à la version `2.4.1`, mais décrit encore `withTenant()` principalement comme une opération cross-tenant exceptionnelle. Le README actuel de `2.4.1` le présente désormais comme le mécanisme principal de routage par tenant ; la source actuelle prévaut. ([changement documenté](https://github.com/dbjpanda/convex-authz/commit/9aa89f60f2d655a693647fb47896c7a331673840), [README actuel](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/README.md#L1320-L1350))

## Compatibilité réelle des versions

Les commandes npm suivantes ont été exécutées le 30 août 2026 :

```text
npm view @convex-dev/better-auth version peerDependencies
npm view better-auth version
npm view better-auth@1.6 version
npm view @djpanda/convex-authz version peerDependencies
npm view convex version engines
```

| Paquet                    |                                  Version observée | Contrainte utile                                                  | Conclusion                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------: | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@convex-dev/better-auth` |                                          `0.12.5` | `better-auth >=1.6.11 <1.7.0`, `convex ^1.25.0`, React 18.3 ou 19 | Better Auth 1.7 est exclu. ([package publié](https://www.npmjs.com/package/@convex-dev/better-auth/v/0.12.5), [source exacte](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/package.json#L101-L106))     |
| `better-auth`             | `1.7.2` latest ; `1.6.30` dernier `1.6.x` observé | Le composant demande `<1.7.0`                                     | Utiliser et verrouiller `1.6.30`, pas `latest`. ([1.6.30](https://www.npmjs.com/package/better-auth/v/1.6.30), [1.7.2](https://www.npmjs.com/package/better-auth/v/1.7.2), [régression 1.7](https://github.com/get-convex/better-auth/issues/433)) |
| `@djpanda/convex-authz`   |                                           `2.4.1` | `convex ^1.29.3`, React 18.3 ou 19                                | Compatible avec la même application. ([package publié](https://www.npmjs.com/package/@djpanda/convex-authz/v/2.4.1), [source exacte](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/package.json#L72-L76)) |
| `convex`                  |                                          `1.45.0` | Node `>=20`, npm `>=7`                                            | Appartient aux deux plages `^1.25.0` et `^1.29.3`. ([package](https://www.npmjs.com/package/convex/v/1.45.0))                                                                                                                                      |

**Fait.** L’intersection des contraintes Convex est `>=1.29.3 <2.0.0`; `1.45.0` satisfait cette intersection. Les deux packages partagent également les mêmes plages React.

**Fait.** La documentation de migration du composant Better Auth recommande `better-auth@~1.6.15`; cette plage reste dans `1.6.x`. ([migration 0.12](https://labs.convex.dev/better-auth/migrations/migrate-to-0-12))

**Recommandation.** Pour un template reproductible, verrouiller au départ :

```text
@convex-dev/better-auth  0.12.5
better-auth              1.6.30
@djpanda/convex-authz    2.4.1
convex                   1.45.0
Node.js                  >=20
```

Tous les plugins Better Auth installés séparément doivent rester sur la même ligne `1.6.x`. Les mises à jour de ces quatre dépendances doivent passer par une PR dédiée avec tests d’intégration auth et d’isolation tenant.

## Responsabilités de chaque couche

### Better Auth et `@convex-dev/better-auth`

**Fait.** Better Auth gère l’authentification : création des utilisateurs, identifiants, mots de passe, comptes OAuth, sessions et fonctionnalités telles que le second facteur. Le composant Convex fournit l’adaptateur de persistance, les routes HTTP, le pont JWT vers `ctx.auth` et les helpers serveur. ([présentation officielle](https://github.com/get-convex/better-auth#readme), [guide React](https://labs.convex.dev/better-auth/framework-guides/react))

**Fait.** `ctx.auth.getUserIdentity()` expose l’identité du JWT, mais la documentation de l’intégration précise que cet appel ne revalide pas la session. `authComponent.getAuthUser(ctx)` vérifie que la session existe et n’est pas expirée avant de charger l’utilisateur. ([documentation d’autorisation](https://labs.convex.dev/better-auth/basic-usage/authorization), [implémentation publiée](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/src/client/create-client.ts#L144-L188))

**Recommandation.** Toute fonction sensible doit commencer par un helper `requirePrincipal(ctx)` fondé sur `authComponent.getAuthUser(ctx)`. L’identifiant d’acteur transmis à `convex-authz` doit être l’identifiant stable du document utilisateur Better Auth retourné (`authUser._id`), sérialisé comme chaîne. Un miroir `users` applicatif n’est nécessaire que pour des données de profil métier, pas pour inventer un second identifiant d’autorisation.

### Domaine de tenancy de l’application

**Inférence.** Ni Better Auth de base ni `convex-authz` ne constituent à eux seuls le domaine complet d’une organisation commerciale. `convex-authz` stocke des attributions de rôles et des permissions partitionnées par `tenantId`, mais ne définit pas le cycle de vie métier d’une organisation, ses invitations, son abonnement ou ses règles de propriété. Better Auth peut ajouter ces concepts via son plugin Organization, mais ce plugin apporte aussi son propre RBAC et une seconde source possible de rôles. ([modèle Organization Better Auth 1.6](https://github.com/better-auth/better-auth/blob/v1.6.23/docs/content/docs/plugins/organization.mdx), [tables `convex-authz`](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/component/schema.ts))

**Recommandation.** Le domaine applicatif possède les tables :

```text
organizations
  id, slug, name, createdByAuthUserId, lifecycle/status, timestamps

memberships
  organizationId, authUserId, status, joinedAt
  index unique logique: (organizationId, authUserId)
  index: (authUserId, organizationId)

invitations
  organizationId, normalizedEmail, intendedRole, tokenHash,
  invitedByAuthUserId, expiresAt, acceptedAt/revokedAt
```

`memberships` prouve l’appartenance au tenant. Les rôles effectifs restent dans `convex-authz`. `intendedRole` n’est qu’une intention tant que l’invitation n’est pas acceptée et que le rôle n’a pas été attribué.

### `@djpanda/convex-authz`

**Fait.** `convex-authz` fournit RBAC, ABAC et ReBAC, des rôles scopés, des grants expirables, des overrides et un journal d’audit des changements. Il pré-calcule des tables de permissions et expose `can`, `require`, `assignRole`, `revokeRole`, `hasRole` et `withTenant`. ([catalogue Convex](https://www.convex.dev/components/djpanda/convex-authz), [API publiée](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/client/index.ts#L499-L780))

**Fait.** Le composant ne connaît pas la session de l’application. Les composants Convex n’ont pas accès à `ctx.auth`; l’application doit authentifier l’appelant puis transmettre explicitement son identifiant. ([documentation Convex sur les composants](https://docs.convex.dev/components/authoring#authentication-via-ctxauth))

**Recommandation.** `convex-authz` est la source d’autorité des rôles et permissions, mais ne doit jamais être exposé directement à un argument `userId` ou `tenantId` contrôlé par le navigateur. Les fonctions publiques de l’application sont son périmètre de confiance.

## Organisations, memberships et tenants : choix recommandé

| Concept                        | Propriétaire recommandé                           | Motif                                                                    |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Utilisateur, compte, session   | Better Auth                                       | C’est son domaine natif.                                                 |
| Organisation                   | Tables applicatives Convex                        | Cycle de vie métier stable et indépendant du fournisseur d’auth.         |
| Membership                     | Tables applicatives Convex                        | Sert de preuve serveur d’appartenance et de jointure utilisateur/tenant. |
| Invitation                     | Tables applicatives Convex, pour la v1            | Évite le chemin Organization non supporté par défaut et son bug ouvert.  |
| `tenantId` d’autorisation      | `_id` canonique de l’organisation, dérivé serveur | Un seul identifiant de partition, jamais une valeur libre du client.     |
| Rôles et permissions effectifs | `convex-authz`                                    | Évite deux moteurs RBAC concurrents.                                     |
| Tenant actuellement affiché    | État UX côté client ou préférence serveur         | Ce n’est qu’un sélecteur ; chaque requête revalide le membership.        |

### Pourquoi ne pas faire de Better Auth Organization la valeur par défaut ?

**Fait.** Le plugin Organization n’est pas dans la liste des plugins supportés sans modification de schéma. La documentation indique que les plugins non listés qui modifient le schéma nécessitent une installation locale du composant et une génération de schéma. ([liste officielle](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/docs/content/docs/supported-plugins.mdx#L6-L30), [local install](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/docs/content/docs/features/local-install.mdx#L6-L31))

**Fait.** L’issue ouverte #407 reproduit sur `@convex-dev/better-auth@0.12.5`, `better-auth@1.6.23` et une installation locale un échec HTTP 500 de `invite-member`. Un contournement communautaire est proposé, mais l’issue reste ouverte. ([issue #407](https://github.com/get-convex/better-auth/issues/407))

**Inférence.** Ajouter Organization dans le socle rendrait le template plus fragile et créerait un choix difficile entre ses rôles `owner/admin/member` et ceux de `convex-authz`.

**Recommandation.** Garder Organization comme recette optionnelle future, après résolution des issues et tests dédiés. Si cette option est proposée, Better Auth devrait alors posséder organisations et memberships, tandis que `convex-authz` recevrait une projection transactionnelle des rôles ; les deux moteurs ne doivent jamais être modifiés indépendamment.

## Mapping d’un utilisateur Better Auth vers un acteur `convex-authz`

Le mapping recommandé est direct et déterministe :

```text
session Better Auth validée
        ↓
authComponent.getAuthUser(ctx)
        ↓
actorId = String(authUser._id)
        ↓
membership (actorId, organizationId) vérifié dans l’app
        ↓
authz.withTenant(String(organizationId)).require(ctx, actorId, permission, scope)
```

**Fait.** `Authz` valide seulement que `tenantId` et `userId` sont des chaînes non vides de longueur acceptable ; il ne vérifie pas qu’ils correspondent à une session ou à un membership. `withTenant()` copie le client avec le nouvel identifiant après cette validation syntaxique. ([constructeur et `withTenant`](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/client/index.ts#L499-L575), [validateurs](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/client/validation.ts#L28-L65))

**Recommandation.** Centraliser ce mapping dans un seul helper serveur. Ne jamais employer l’adresse email comme `actorId` : elle peut changer, sa casse doit être normalisée et elle constitue une donnée personnelle. Ne pas employer non plus un identifiant utilisateur envoyé par le client pour décider des droits de l’appelant.

## Dériver le tenant sans faire confiance au client

Le navigateur peut choisir une organisation à afficher, mais sa valeur n’est qu’un **sélecteur non fiable**.

### Requête à l’échelle d’une organisation

1. Valider la session avec `getAuthUser` et obtenir `actorId`.
2. Recevoir éventuellement `organizationId` ou un slug comme sélecteur.
3. Charger côté serveur le membership exact `(organizationId, actorId)` via un index composé.
4. Refuser si le membership n’existe pas ou n’est pas actif.
5. Prendre le véritable `_id` du document d’organisation/membership comme `verifiedOrganizationId`.
6. Appeler `authz.withTenant(verifiedOrganizationId)` et utiliser un scope organisation identique.
7. Lire les données applicatives avec des indexes dont `organizationId` est le premier champ.

### Requête visant une ressource existante

1. Valider la session.
2. Charger la ressource par son identifiant côté serveur.
3. Dériver `verifiedOrganizationId` depuis `resource.organizationId`.
4. Vérifier le membership puis la permission sur cette organisation/ressource.
5. Ne jamais comparer la ressource à un `tenantId` séparé fourni par le client pour « confirmer » son tenant.

**Fait.** Le README de `convex-authz` distingue `tenantId`, frontière de partition des données du composant, et `scope`, cible de ressource au sein du tenant. `withTenant()` est le mécanisme de routage documenté. ([multi-tenancy](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/README.md#L1286-L1350))

**Limite importante.** Cette isolation ne protège que les tables internes de `convex-authz`. Elle ne filtre pas automatiquement `organizations`, `memberships`, documents, factures ou autres tables de l’application. Les tables applicatives doivent avoir leurs propres champs et indexes `organizationId`, et chaque fonction doit les utiliser.

**Écart documentaire.** Le README affirme que `tenantId` est requis dans chaque table interne, mais le schéma publié le déclare encore optionnel sur plusieurs tables, vraisemblablement pour compatibilité/migration ; les indexes commencent bien par `tenantId`, et l’API `Authz` exige une chaîne non vide. ([README](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/README.md#L1286-L1298), [schéma publié](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/component/schema.ts#L5-L80))

**Recommandation.** Utiliser exclusivement le client public `Authz`, ne pas appeler les fonctions brutes du composant avec un tenant arbitraire, et ajouter des tests négatifs croisés A/B pour chaque famille d’endpoint.

## Modèle RBAC recommandé

Les quatre rôles sont des rôles d’organisation. Par défense en profondeur, l’attribution et les checks utilisent à la fois :

```text
tenantId = organizationId
scope    = { type: "organization", id: organizationId }
```

`scope` restera utile plus tard pour des rôles propres à un projet ou une ressource. Le code publié supporte l’héritage de rôles et les permissions scopées. ([rôles et héritage](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/README.md#L66-L133), [checks scopés](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/client/index.ts#L630-L752))

| Permission métier indicative                             |  Viewer   |  Editor   |   Admin   | Owner |
| -------------------------------------------------------- | :-------: | :-------: | :-------: | :---: |
| `dashboard:view`, `records:read`                         |     ✓     |     ✓     |     ✓     |   ✓   |
| `records:create`, `records:update`                       |           |     ✓     |     ✓     |   ✓   |
| `records:delete`                                         |           | à décider |     ✓     |   ✓   |
| `members:view`                                           | à décider | à décider |     ✓     |   ✓   |
| `members:invite`, `members:remove`                       |           |           |     ✓     |   ✓   |
| `members:change_role` hors owner                         |           |           |     ✓     |   ✓   |
| `audit:view`, `settings:update`                          |           |           |     ✓     |   ✓   |
| `billing:view`, `billing:manage`                         |           |           | à décider |   ✓   |
| `organization:transfer_ownership`, `organization:delete` |           |           |           |   ✓   |

Hiérarchie suggérée : `editor` hérite de `viewer`, `admin` hérite de `editor`, `owner` hérite de `admin`. Les capacités irréversibles restent des permissions explicites d’owner ; ne pas utiliser un wildcard `*` dans les rôles de base.

**Recommandation.** Le membership prouve « cet utilisateur appartient à cette organisation » ; l’attribution `convex-authz` répond « que peut-il y faire ? ». Lors de l’acceptation d’une invitation, créer le membership et attribuer le rôle dans une seule mutation applicative. Convex garantit un commit transactionnel à travers les appels de composants. ([transactions des composants](https://docs.convex.dev/components/understanding), [transactions des mutations](https://docs.convex.dev/functions/mutation-functions#transactions))

`convex-authz` peut rester la source des rôles. Pour garantir qu’une organisation conserve au moins un owner, la mutation de rétrogradation/suppression doit compter les owners via le composant avant d’écrire et refuser le retrait du dernier owner. Toute vue dénormalisée du rôle dans `memberships` doit être marquée comme read model, pas comme deuxième autorité.

## Placement des contrôles d’accès

### Queries publiques

Ordre obligatoire : authentifier, résoudre le tenant, `require` la permission, puis lire les données avec l’index du tenant. Une query servant seulement à masquer un bouton dans React ne sécurise pas la query métier.

### Mutations publiques

Même ordre, puis vérification des invariants métier avant toute écriture : appartenance de la cible au même tenant, interdiction de supprimer le dernier owner, restrictions de self-demotion, idempotence des invitations. Les changements de membership et les attributions/retraits de rôle doivent vivre dans une seule mutation, afin que l’échec d’un appel composant annule le tout. ([atomicité Convex](https://docs.convex.dev/components/understanding))

### Actions et HTTP actions

`ActionCtx` expose `ctx.auth`, et `Authz.require` accepte un contexte d’action. L’autorisation doit être vérifiée **avant** l’appel externe. Une action n’étant pas une transaction, toute écriture finale doit passer par une mutation interne qui revalide les invariants et utilise une clé d’idempotence. Pour limiter les vues incohérentes, regrouper les lectures d’autorisation dans une seule query interne et les écritures dans une seule mutation interne. ([auth dans les fonctions](https://docs.convex.dev/auth/functions-auth), [actions](https://docs.convex.dev/functions/actions))

### Fonctions internes et tâches planifiées

Les fonctions internes réduisent la surface publique mais ne rendent pas leurs arguments vrais par magie. Elles doivent recevoir un contexte d’acteur/tenant produit par une fonction publique autorisée ou une identité de service explicitement définie, puis valider leurs invariants. ([fonctions internes](https://docs.convex.dev/functions/internal-functions))

### Interface React

`PermissionGate` et les hooks `useCanUser` sont utiles pour l’UX réactive, mais le code publié transmet `userId`, permission et scope à une query fournie par l’application. Ils ne constituent donc pas une frontière de sécurité. La query publique utilisée par l’UI doit dériver l’utilisateur courant elle-même, sauf écran d’administration déjà autorisé à inspecter une cible. ([source React](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/react/index.ts#L23-L36), [hook](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/react/index.ts#L82-L120))

**Recommandation structurante.** Créer des builders/wrappers applicatifs `tenantQuery`, `tenantMutation` et `tenantAction` qui appliquent toujours ce pipeline. `convex-authz` ne fournit pas encore de middleware automatique ; la demande correspondante reste ouverte. ([issue #12](https://github.com/dbjpanda/convex-authz/issues/12))

## Risques, limites et fonctionnalités à ne pas mettre dans le socle

### 1. Décalage Better Auth 1.7 — risque élevé, contrôlable

`@convex-dev/better-auth@0.12.5` dépend encore d’un plugin retiré dans Better Auth 1.7 ; installer `better-auth@latest` casse le bundling. La mitigation est un pin strict `1.6.30`, un lockfile versionné et une CI qui refuse une résolution `>=1.7.0`. ([issue #433](https://github.com/get-convex/better-auth/issues/433))

### 2. Lookup `_id` de l’adaptateur Better Auth — à traiter avant une promesse « production-ready »

L’issue ouverte #410 montre qu’un `findOne`/`findMany` par `_id` peut retourner un document d’un autre modèle, car le code publié appelle `ctx.db.get(id)` sans borner la table. Le même chemin est encore présent sur la branche principale inspectée. L’exploitabilité dépend des endpoints et des IDs accessibles ; il ne faut pas présenter ce rapport comme la preuve d’une vulnérabilité exploitable de bout en bout. En revanche, aucun contrôle de tenant ne doit dépendre d’un lookup Better Auth générique par ID tant que ce point n’est pas corrigé/testé. ([issue #410](https://github.com/get-convex/better-auth/issues/410), [code publié concerné](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/src/client/adapter-utils.ts#L512-L545))

### 3. Plugin Organization — hors baseline

Support non « out of the box », installation locale, double RBAC potentiel et bug d’invitation ouvert. Le mettre derrière une option expérimentale séparée, pas dans le chemin par défaut.

### 4. `convex-authz` ne dérive pas actor/tenant — risque critique si mal enveloppé

`withTenant()` valide une chaîne, pas un membership. Une fonction publique du type `checkPermission({ userId, tenantId, ... })` peut permettre à un client de demander une décision pour un autre acteur ou tenant. Les wrappers serveur et tests d’isolation sont obligatoires.

### 5. « O(1) » est un raccourci pour le fast path exact

Le catalogue et le README annoncent des lookups O(1), mais l’implémentation exacte peut scanner jusqu’à 4 000 lignes pour rechercher des denies wildcard, et les policies différées sont évaluées à la lecture. Pour le socle, préférer des permissions exactes, peu de overrides et aucun wildcard global. ([fast path et scans](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/src/component/unified.ts#L366-L455), [ABAC au read-time](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/README.md#L165-L176))

### 6. Features à différer

- ABAC : les types `static` et `deferred` n’ont actuellement pas de différence comportementale et sont évalués à la lecture.
- ReBAC : utile pour partage de documents/héritage complexe, inutile pour les quatre rôles initiaux.
- Custom roles : fonctionnalité récente de `2.4.x`; garder les quatre rôles codés en dur pour la v1.
- JWT caching et static JWKS : explicitement documentés comme expérimentaux dans l’intégration Better Auth. ([fonctionnalités expérimentales](https://labs.convex.dev/better-auth/experimental))
- Permission UI prenant un `userId` libre : uniquement pour affichage ou écrans d’administration déjà autorisés.

### 7. Maturité et statut

**Fait.** `@convex-dev/better-auth` est en `0.12.5` et sa documentation est hébergée sous `labs.convex.dev`; les sources consultées ne l’étiquettent toutefois pas explicitement « beta ». `convex-authz` est en `2.4.1` et son auteur le décrit « production-ready » ; il n’est pas étiqueté beta non plus. Le numéro de version et la formulation marketing ne remplacent pas les tests du template.

**Recommandation.** Le template peut être publié comme starter/opinionated reference, à condition de documenter les pins, de ne pas promettre une conformité automatique, et de livrer une suite de tests d’autorisation. Les deux packages sont Apache-2.0 dans leur métadonnée publiée ; conserver leurs notices pour une distribution commerciale. ([Better Auth package](https://github.com/get-convex/better-auth/blob/c628916b451a6b4cff0f5464f134475464b1a6da/package.json), [`convex-authz` package](https://github.com/dbjpanda/convex-authz/blob/0717b7fbc0c0a6760261f454ba8000124a670019/package.json))

## Architecture de référence pour le template

```text
React dashboard
  ├─ Better Auth client: sign-in, sign-out, OAuth, MFA, session UX
  └─ Convex hooks: données et UX de permissions
                 │
                 ▼
Fonction Convex publique
  1. requirePrincipal(ctx) -> Better Auth session validée -> actorId
  2. resolveTenant(ctx, actorId, selector/resource) -> membership actif
  3. tenantAuthz = authz.withTenant(verifiedOrganizationId)
  4. tenantAuthz.require(ctx, actorId, permission, organization/resource scope)
  5. lecture/écriture applicative filtrée par organizationId
                 │
       ┌─────────┴──────────┐
       ▼                    ▼
Tables applicatives       Composant convex-authz
organizations             roles/permissions/effective cache
memberships               audit des changements authz
invitations
ressources tenantées

Better Auth component
users/accounts/sessions/JWT
```

### Invariants à rendre impossibles à contourner

1. Toute donnée tenantée possède `organizationId` et un index commençant par ce champ.
2. Toute fonction publique sensible dérive `actorId` de la session validée.
3. Tout tenant est dérivé d’un membership ou d’une ressource chargée côté serveur.
4. Toute décision d’accès combine membership actif + permission `convex-authz`.
5. Aucun bouton caché, rôle dans le JWT ou `activeTenantId` du navigateur n’est une autorisation.
6. Aucun admin ne peut retirer le dernier owner.
7. L’acceptation d’invitation crée membership + rôle atomiquement et une seule fois.
8. La révocation d’un membership retire toutes les autorisations de ce tenant dans la même mutation, avec un mécanisme de réconciliation testé.
9. Les erreurs d’authentification et d’autorisation échouent fermées avec des codes structurés, sans fuite de données d’un autre tenant.
10. Chaque endpoint possède des tests `unauthenticated`, `non-member`, `wrong tenant`, `wrong role` et `allowed`.

## Tests minimum avant de commercialiser

- Matrice complète des quatre rôles sur chaque permission.
- Utilisateur membre de A mais pas de B : tous les endpoints B refusent et ne retournent aucune donnée.
- `organizationId`, `userId`, scope et resource ID falsifiés indépendamment.
- Session expirée/révoquée malgré un JWT encore présenté.
- Rétrogradation et suppression du dernier owner refusées.
- Acceptation concurrente d’une invitation idempotente.
- Suppression d’un membership révoquant immédiatement les permissions.
- Upgrade automatique interdit vers Better Auth 1.7 tant que le composant ne le supporte pas.
- Régression dédiée au lookup inter-modèle décrit dans l’issue #410.
- Tests de migration/recompute des permissions lors d’un changement de définition de rôle.

## Décisions à trancher pendant `grill-with-docs`

1. **Framework React** : Vite SPA, TanStack Start ou Next.js ? Le flux SSR et les adaptateurs Better Auth diffèrent.
2. **Méthodes de connexion v1** : email/mot de passe, magic link, Google/GitHub, MFA obligatoire ou optionnel ?
3. **Création d’organisation** : automatique au signup, explicite après onboarding, ou invitation-only ?
4. **Appartenance multi-org** : un utilisateur peut-il appartenir à plusieurs organisations et comment choisit-il l’organisation active ?
5. **Invitations** : email réel dans le template, invitation copiable, expiration, renvoi et révocation ?
6. **Rôle initial du créateur** : owner unique ou plusieurs owners autorisés ? Quelle procédure de transfert ?
7. **Droits exacts des rôles** : l’editor peut-il supprimer des données ? Viewer/editor voient-ils la liste des membres ? Admin voit-il/gère-t-il la facturation ?
8. **Self-service admin** : un admin peut-il modifier son propre rôle ou retirer son propre membership ?
9. **Custom roles** : exclus de la v1 recommandée, ou exigence commerciale dès le lancement ?
10. **Permission overrides** : interdits dans la v1, ou nécessaires pour des exceptions temporaires ?
11. **Ressources scopées** : uniquement organisation-wide au départ, ou rôles par projet/équipe dès la v1 ?
12. **Platform admin** : existe-t-il un rôle opérateur cross-tenant ? Si oui, comment est-il séparé et audité sans utiliser un tenant client ?
13. **Suppression/offboarding** : soft delete, durée de rétention, transfert des ressources et droit à l’effacement ?
14. **Audit** : quelles actions doivent être visibles, quelle rétention, et l’audit des simples checks est-il requis ?
15. **Politique de version** : pins exacts et mises à jour manuelles, ou plage mineure avec CI de compatibilité ?
16. **Positionnement commercial** : starter avec limites documentées, ou promesse production-ready impliquant audit externe et SLA de maintenance ?
17. **Seuil de sortie Better Auth 0.12.5** : attendre la résolution de #410 / le support 1.7, appliquer un patch maintenu, ou accepter le risque avec tests compensatoires ?
18. **Option Organization** : rester sur le domaine applicatif recommandé, ou fournir ultérieurement une variante locale Better Auth clairement expérimentale ?
