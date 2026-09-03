# Parcours produit MVP de Senja et Testimonial.to

_Recherche effectuée le 3 septembre 2026. Périmètre : sources officielles et pages publiques accessibles sans compte. Les comportements décrits depuis le tableau de bord sont documentés par les centres d'aide officiels, mais n'ont pas été reproduits dans un compte authentifié._

## Résumé exécutable

Les deux produits organisent le même cycle de valeur :

1. créer un conteneur de marque (`Project` chez Senja, `Space` chez Testimonial.to) ;
2. générer une page publique de collecte ;
3. proposer le choix texte ou vidéo, avec questions guidées et identité du répondant ;
4. recevoir la soumission dans une boîte privée ;
5. la relire puis la rendre publiable ;
6. composer un Wall of Love ou un widget ;
7. partager une page hébergée ou copier un code d'intégration.

Le noyau crédible d'un MVP tient donc dans **un espace, un formulaire public texte/vidéo, une file de modération, un Wall of Love et un widget intégrable**. Les imports sociaux, les invitations automatisées, les récompenses, l'IA, les analytics avancées et les multiples modèles d'affichage sont des extensions et non des prérequis du premier cycle de valeur.

La différence de modèle la plus importante est la suivante :

- **Senja** limite le gratuit à **15 témoignages texte et vidéo combinés**, puis rend les offres payantes illimitées. Les projets regroupent formulaires, témoignages, widgets, membres et Walls of Love ([tarifs Senja](https://senja.io/pricing), [utilisation des projets](https://support.senja.io/using-projects-in-senja-1p6h8)).
- **Testimonial.to** sépare les quotas : **2 vidéos et 10 textes** en gratuit, puis textes illimités mais toujours 2 vidéos sur Starter. L'illimité vidéo commence sur Ultimate à 50 $/mois/espace en facturation annuelle ([tarifs Testimonial.to](https://testimonial.to/pricing/)).

## Comparatif des parcours

| Étape               | Senja                                                                                             | Testimonial.to                                                                          | Conséquence MVP                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Conteneur           | Un `Project` sépare témoignages, formulaires, widgets, membres et Walls                           | Un `Space` possède sa page de collecte, sa boîte de réception, ses réglages et son Wall | Adopter un seul concept métier, par exemple `espace`, rattaché à une organisation                   |
| Premier formulaire  | Chaque compte possède un formulaire de collecte par défaut ; on peut aussi créer depuis un modèle | La création d'un Space génère automatiquement une page de collecte                      | Générer un formulaire par défaut pendant l'onboarding                                               |
| Collecte            | Texte, image et vidéo ; questions texte, vidéo et note ; formulaire simple ou multistep           | Texte et vidéo par défaut ; questions, note, email et champs personnalisés              | Pour le MVP : texte ou vidéo, note, identité, rôle/entreprise, avatar et consentement               |
| Modération          | Nouvelle soumission `unapproved` par défaut ; approbation manuelle ou automatique                 | Nouvelle soumission dans l'Inbox ; ajout au Wall par un cœur, ou auto-population        | Conserver un statut explicite `pending / approved / rejected` et publier seulement `approved`       |
| Présentation        | Studio avec widgets et Walls séparés, sélection manuelle ou auto-add par filtres                  | Wall hébergé et embeds alimentés par les témoignages « liked »                          | Livrer un Wall hébergé et un widget masonry utilisant la même sélection                             |
| Dépassement gratuit | Les formulaires restent ouverts ; les nouvelles entrées sont cachées jusqu'à l'upgrade            | Les soumissions continuent ; le surplus est verrouillé jusqu'à l'upgrade                | Ne jamais casser le formulaire public au quota : accepter, stocker et verrouiller côté propriétaire |

## Senja

### 1. Onboarding et organisation

Le conteneur principal est le **Project**. Senja indique qu'un projet regroupe les témoignages, formulaires, widgets, membres et Walls of Love, et recommande un projet par marque, client ou ligne de produit ([Using projects in Senja](https://support.senja.io/using-projects-in-senja-1p6h8)). La création manuelle demande un nom, un slug et l'URL du site ([How do I add or create a new project?](https://support.senja.io/how-do-i-add-or-create-a-new-project-28iki)).

Le parcours exact juste après inscription n'est pas décrit écran par écran dans une source publique récente. En revanche, Senja affirme que chaque compte inclut un formulaire de collecte par défaut ([How do I collect testimonials with Senja?](https://support.senja.io/how-do-i-collect-testimonials-with-senja-k8mqd)). Il est donc raisonnable de retenir pour le MVP : création d'organisation → espace par défaut → formulaire par défaut, tout en considérant l'ordre exact de l'onboarding Senja comme **non vérifié sans compte**.

### 2. Création et configuration du formulaire

Depuis `Forms`, l'utilisateur crée un formulaire à partir d'un exemple ou d'un modèle, le nomme, puis configure les onglets Reward, Form et Settings. Les questions peuvent être de type texte, vidéo ou notation et peuvent être réordonnées ([How to create Senja form](https://support.senja.io/how-to-create-senja-form-pg4sw)).

Le formulaire permet notamment de personnaliser le texte, les questions, le type de témoignage, le logo, les couleurs, les polices, la disposition, l'URL et la page de remerciement. Les réglages comprennent aussi l'approbation automatique, les tags, les notifications et l'arrêt de la collecte ([How do I customize my form design?](https://support.senja.io/how-do-i-customize-my-form-design-xscki)).

Sur la page `About you`, le nom est obligatoire. Les autres champs peuvent être activés et rendus obligatoires ou facultatifs ([Setting up questions in my form](https://support.senja.io/setting-up-questions-in-my-form-imkvy)). Une page `About company` peut recueillir le poste, l'entreprise, le site et le logo de l'entreprise ([Where is the job title/company name field on forms?](https://support.senja.io/where-is-the-job-title-company-name-field-on-forms-8520p)). Senja permet également des champs personnalisés et cachés transmis dans l'URL ([How do I collect custom information from my customers?](https://support.senja.io/how-do-i-collect-custom-information-from-my-customers-4mvlk)).

Un formulaire peut être limité au texte ou à la vidéo ([texte uniquement](https://support.senja.io/how-do-i-collect-text-testimonials-only-njb7a), [vidéo uniquement](https://support.senja.io/how-do-i-collect-video-testimonials-only-umgk2)). Le parcours public peut aussi proposer les deux choix, comme le montre cette [page publique Senja texte + vidéo](https://senja.io/p/framer-PH7/r/badejo).

À noter pour la robustesse : une soumission n'apparaît normalement dans `Proof` qu'après le clic final sur Submit et un répondant ne peut pas reprendre un formulaire incomplet ([Does Senja receive partial form submissions?](https://support.senja.io/does-senja-receive-partial-form-submissions-6v09k)).

### 3. Gestion et modération

Une nouvelle soumission est marquée **unapproved** par défaut. Un témoignage approuvé peut être utilisé dans Studio et partagé ; un témoignage non approuvé reste visible dans le compte, mais n'est pas disponible dans Studio. Le propriétaire peut approuver en masse ou activer une approbation automatique depuis les réglages du formulaire ([What do approved and unapproved mean?](https://support.senja.io/what-do-approved-and-unapproved-mean-rfswt)).

La page de gestion s'appelle `Proof`. La documentation publique liste la recherche, les filtres, le tri, les tags, l'édition, les téléchargements et les actions en masse ([Manage testimonials](https://support.senja.io/manage-testimonials-h516k)). La disposition exacte de la page, ses états vides et ses interactions détaillées sont **non vérifiables directement sans compte** ; les captures intégrées au centre d'aide restent toutefois consultables publiquement.

### 4. Wall of Love

Un Wall of Love est une page complète hébergée par Senja, distincte des widgets compacts. Il peut contenir texte et vidéo, être stylé à partir de modèles, réordonné et filtré par tags. Senja annonce un nombre illimité de Walls sur tous les plans, avec jusqu'à 120 témoignages par Wall ([What is Wall of Love?](https://support.senja.io/what-is-wall-of-love-3whg8), [tarifs Senja](https://senja.io/pricing)).

Dans Studio, la création consiste à choisir un modèle, nommer le Wall, puis sélectionner ses témoignages : soit manuellement, soit par auto-add et filtres. Le Wall peut ensuite être partagé par URL ou intégré à un site ([How do I create Wall of Love?](https://support.senja.io/how-do-i-create-wall-of-love-7ryjl)).

### 5. Widgets et intégration

Studio propose plus de 20 styles de widgets. L'utilisateur choisit un modèle, nomme le widget, sélectionne les témoignages manuellement ou automatiquement, puis modifie les couleurs, polices, espacements et disposition ([How do I create widget?](https://support.senja.io/how-do-i-create-widget-e7dsl)).

L'intégration publique utilise un script et un `div` identifié :

```html
<div
  class="senja-embed"
  data-id="WIDGET_ID"
  data-lazyload="false"
  data-mode="shadow"
></div>
<script
  async
  type="text/javascript"
  src="https://static.senja.io/dist/platform.js"
></script>
```

Ce format est documenté officiellement dans le [guide Angular de Senja](https://support.senja.io/how-to-add-testimonials-to-angular-jb84m) et dans sa [documentation d'intégration à une application](https://support.senja.io/add-senja-testimonials-to-your-app-byv55). Les widgets sont disponibles sur tous les plans, avec certaines personnalisations réservées au payant ([How to embed a testimonial widget](https://support.senja.io/how-to-embed-a-testimonial-widget-in-my-website-in1cl)).

### 6. Quotas et comportement au dépassement

| Plan Senja | Prix public |               Témoignages | Formulaires | Projets | Sièges | Différenciation utile                                              |
| ---------- | ----------: | ------------------------: | ----------: | ------: | -----: | ------------------------------------------------------------------ |
| Free       |         0 $ | 15 texte + vidéo combinés |           1 |       1 |      1 | Branding Senja, exports vidéo SD                                   |
| Starter    |   29 $/mois |                 Illimités |           3 |       1 |      2 | Branding retirable, domaine personnalisé, exports HD, API/webhooks |
| Pro        |   59 $/mois |                 Illimités |   Illimités |       5 |      5 | Rich snippets, traduction, projets et sièges additionnels          |

Sources : [pricing Senja](https://senja.io/pricing) et [comparatif officiel des plans](https://support.senja.io/what-are-the-differences-between-the-free-and-paid-plans-sdcfs).

Les 15 témoignages gratuits sont comptés à vie et incluent les entrées approuvées et non approuvées ; supprimer ou désapprouver une ancienne entrée ne libère pas de place. À la limite, le formulaire continue de recevoir des réponses, mais les nouvelles entrées sont cachées et absentes des widgets jusqu'à l'upgrade ([What happens after I collect more than 15 testimonials?](https://support.senja.io/what-happens-after-i-collect-more-than-15-testimonials-sar4p)). Les formulaires, au contraire, sont comptés en temps réel et une suppression libère un emplacement ([What are collection forms?](https://support.senja.io/what-are-collection-forms-7eke8)).

## Testimonial.to

### 1. Onboarding et organisation

Le conteneur principal est le **Space**, défini comme l'espace de collecte et d'affichage pour un produit, une marque ou un client. Après inscription, l'utilisateur arrive sur `Create your Space`. La création manuelle exige quatre éléments : nom du Space, logo, titre de la page et message personnalisé, avec aperçu en direct. Une assistance IA peut partir de l'URL du site ([Introduction to Testimonial.to](https://help.testimonial.to/en/articles/8115178-introduction-to-testimonial-to), [Create a new space](https://help.testimonial.to/en/articles/6222904-all-in-one-create-a-new-space)).

La création du Space génère automatiquement deux destinations : une page publique de collecte et un Wall of Love ([Introduction to Testimonial.to](https://help.testimonial.to/en/articles/8115178-introduction-to-testimonial-to)). La disposition exacte du dashboard et les micro-interactions du premier onboarding restent **non vérifiées sans compte**.

### 2. Formulaire texte et vidéo

La page de collecte peut être partagée par URL ou intégrée comme widget. Elle reprend les réglages du Space : titre, message, questions, types de témoignage, couleur, thème, intégration du Wall et langue ([Collecting Testimonials](https://help.testimonial.to/en/articles/7913812-collecting-testimonials)).

Par défaut, le visiteur voit deux actions : `Record a video` et `Send in text`. Les libellés sont modifiables, le consentement est configurable et la durée maximale dépend du plan ([Extra settings for your space](https://help.testimonial.to/en/articles/6813923-all-in-one-extra-settings-for-your-space)). La page de pricing indique que le propriétaire peut recueillir nom, photo, email, poste et entreprise, lien social, ainsi que jusqu'à cinq champs personnalisés ([pricing Testimonial.to](https://testimonial.to/pricing/)).

Pour la vidéo, le répondant peut enregistrer dans le navigateur ou téléverser un fichier. La sortie est limitée à 1080p et la vidéo est traitée par Mux ([Maximum Video Quality](https://help.testimonial.to/en/articles/6906604-maximum-video-quality)). Le parcours détaillé après autorisation caméra, les écrans de reprise et les messages d'erreur ne sont pas documentés de façon exhaustive et sont donc **à vérifier par essai avec un compte et un navigateur**.

### 3. Inbox, modération et publication

Les témoignages reçus arrivent dans l'`Inbox`. Par défaut ils ne sont pas publiés sur le Wall : le propriétaire clique sur le cœur pour les y ajouter, ou active `Auto-populate testimonials to the Wall of Love` ([Add to Wall of Love](https://help.testimonial.to/en/articles/6223033-add-to-wall-of-love)).

Cette mécanique est une **curation par inclusion**, pas simplement une colonne publique listant toutes les entrées. Le produit distingue également le retrait du Wall, qui conserve le témoignage dans le Space, de la suppression définitive et irréversible ([Deleting a Testimonial](https://help.testimonial.to/en/articles/8180591-deleting-a-testimonial)).

Depuis l'Inbox, les témoignages texte peuvent être édités sur le contenu, le nom, l'avatar, le poste/entreprise, les liens, la date et les images ([Edit text testimonials](https://help.testimonial.to/en/articles/6814422-edit-text-testimonials)). Pour une vidéo, le propriétaire peut modifier l'identité, la miniature, l'extrait et les liens ([How to edit video testimonials](https://help.testimonial.to/en/articles/6223092-how-to-edit-video-testimonials)). Les écrans authentifiés eux-mêmes sont **visibles seulement via les captures des articles ou avec un compte**.

### 4. Wall of Love

Le Wall est une page publique hébergée et un widget, alimenté par les témoignages ajoutés manuellement ou automatiquement. Il accepte les témoignages texte, vidéo et les preuves importées. Le propriétaire peut réordonner les cartes, mettre des favoris en avant, filtrer par tags et suivre le trafic ([What is the Wall of Love?](https://help.testimonial.to/en/articles/7970916-what-is-the-wall-of-love)).

L'éditeur d'embed propose trois familles de disposition : masonry animée, masonry fixe et carousel. Les réglages publics documentés couvrent notamment thème sombre, largeur de carte, animations, ordre aléatoire, sous-titres, nombre initial de cartes et chargement progressif. Sous 500 px, la masonry fixe passe à une colonne et les cartes prennent toute la largeur ([Embed a Wall of Love](https://help.testimonial.to/en/articles/6223121-embed-a-wall-of-love)).

### 5. Widgets et intégration

Testimonial.to propose des widgets de Wall, carousel, vidéo unique, texte unique, badges, formulaire de collecte et boutons de collecte ([Testimonial widgets](https://testimonial.to/widgets/)). Le Wall public de la marque expose l'intégration suivante :

```html
<script
  async
  type="text/javascript"
  src="https://testimonial.to/js/widget-embed.js"
></script>
<div
  class="testimonial-to-embed"
  data-url="https://embed-v2.testimonial.to/w/wall-of-love-for-testimonial?theme=light&card=base"
  data-resize="true"
></div>
```

Source : [page d'accueil Testimonial.to](https://testimonial.to/).

Le collecting widget peut avoir plusieurs variantes nommées, chacune avec ses propres questions, options et style. Une modification ultérieure est reflétée sans remplacer le code d'intégration ([Collecting Widget](https://help.testimonial.to/en/articles/6223129-collecting-widget)). Cette gestion multi-variante est utile, mais peut attendre après le MVP : une URL stable et un seul formulaire par espace suffisent pour valider le cycle.

### 6. Quotas et comportement au dépassement

| Plan Testimonial.to | Prix public annuel ramené au mois |     Vidéos |      Textes |                     Spaces | Formulaires/espace | Durée vidéo |
| ------------------- | --------------------------------: | ---------: | ----------: | -------------------------: | -----------------: | ----------: |
| Free                |                               0 $ | 2 au total | 10 au total |                          1 |                  1 |       2 min |
| Starter             |                              25 $ | 2 au total |   Illimités |                          1 |                  1 |       2 min |
| Ultimate            |                        50 $/space | Illimitées |   Illimités | 1, espaces payants en plus |          Illimités |       5 min |
| Ultimate+           |                        95 $/space | Illimitées |   Illimités | 1, espaces payants en plus |          Illimités |       5 min |

Source : [pricing Testimonial.to](https://testimonial.to/pricing/).

Après épuisement des crédits gratuits, les visiteurs peuvent continuer à soumettre : l'excédent est conservé mais verrouillé jusqu'à l'upgrade. Starter débloque les textes illimités, Ultimate les textes et vidéos illimités ([pricing Testimonial.to](https://testimonial.to/pricing/)). Free et Starter ne peuvent afficher que deux vidéos par Wall ; Ultimate et Ultimate+ sont illimités ([download, collection et downgrade](https://help.testimonial.to/en/articles/7970905-can-i-download-video-testimonials-on-the-free-plan-or-after-downgrading)).

## URLs publiques à capturer sans compte

### Priorité haute : écrans produit réels

| Produit        | URL                                                                                                        | Écran capturable                                                     | Précaution                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Senja          | [Formulaire texte + vidéo](https://senja.io/p/framer-PH7/r/badejo)                                         | Hero du formulaire et choix `Record a video` / `Write a testimonial` | Ne pas soumettre ; l'étape caméra peut demander une permission navigateur                                    |
| Senja          | [Formulaire texte + vidéo alternatif](https://senja.io/p/mranand/r/ChrwTJ)                                 | Variante de contenu avec les deux CTA                                | Page publique d'un utilisateur hébergée par Senja                                                            |
| Senja          | [Wall officiel de Senja](https://love.senja.io/)                                                           | Hero, grille/masonry, mélange de preuves et CTA                      | Page officielle liée depuis le footer de Senja                                                               |
| Senja          | [Wall public texte dense](https://senja.io/p/markpcolgan/testimonials)                                     | Grille de cartes, avatars et titres                                  | Contenu d'un utilisateur ; masquer les données personnelles si la capture sort du cahier des charges interne |
| Senja          | [Pricing](https://senja.io/pricing)                                                                        | Free, Starter, Pro et limites                                        | Capturer la date car les prix peuvent évoluer                                                                |
| Testimonial.to | [Formulaire officiel de Testimonial](https://cname.testimonial.to/)                                        | Page de collecte, questions et choix vidéo/texte                     | Domaine personnalisé officiel utilisé par Testimonial.to                                                     |
| Testimonial.to | [Wall officiel](https://testimonial.to/wall-of-love/)                                                      | Wall hébergé et cards vidéo/texte                                    | Le contenu embarqué exige JavaScript                                                                         |
| Testimonial.to | [Widget Wall direct](https://embed-v2.testimonial.to/w/wall-of-love-for-testimonial?theme=light&card=base) | Rendu isolé du widget sans navigation marketing                      | Idéal pour comparer la masonry et le responsive                                                              |
| Testimonial.to | [Widgets](https://testimonial.to/widgets/)                                                                 | Galerie des formats et étapes d'intégration                          | Marketing produit, pas éditeur authentifié                                                                   |
| Testimonial.to | [Pricing](https://testimonial.to/pricing/)                                                                 | Les quatre plans et le tableau comparatif                            | Capturer la date car les prix peuvent évoluer                                                                |

### Priorité moyenne : captures officielles du back-office dans l'aide

Ces pages sont publiques et contiennent des captures authentiques de l'interface, mais la capture obtenue montrera **l'article d'aide**, pas une session interactive :

- Senja : [créer un formulaire](https://support.senja.io/how-to-create-senja-form-pg4sw), [approuver des témoignages](https://support.senja.io/what-do-approved-and-unapproved-mean-rfswt), [créer un Wall](https://support.senja.io/how-do-i-create-wall-of-love-7ryjl), [créer un widget](https://support.senja.io/how-do-i-create-widget-e7dsl).
- Testimonial.to : [créer un Space](https://help.testimonial.to/en/articles/6222904-all-in-one-create-a-new-space), [ajouter au Wall](https://help.testimonial.to/en/articles/6223033-add-to-wall-of-love), [éditer un Wall embed](https://help.testimonial.to/en/articles/6223121-embed-a-wall-of-love), [configurer le collecting widget](https://help.testimonial.to/en/articles/6223129-collecting-widget).

## Ce qui n'est pas vérifiable sans compte

- le parcours d'inscription exact, les écrans vides et les checklists d'activation ;
- la navigation complète et actuelle des dashboards ;
- le comportement réel des permissions d'équipe et des rôles ;
- les états d'upload vidéo, progression, reprise, échec et traitement ;
- l'expérience complète d'autorisation caméra/micro sur desktop et mobile ;
- les messages exacts de quota dans le produit ;
- les analytics et leur granularité ;
- la mise à jour temps réel d'un widget après approbation ;
- les écrans Stripe de souscription, upgrade et downgrade.

Ces éléments nécessitent soit deux comptes gratuits de benchmark, soit des captures fournies par un utilisateur déjà connecté. Il ne faut pas les déduire des seules pages marketing.

## Implications pour le cahier des charges MVP

Le benchmark justifie le périmètre fonctionnel suivant, sans reprendre les extensions accumulées par les concurrents :

1. **Onboarding** : créer une organisation, puis un espace et son formulaire par défaut ; afficher immédiatement le lien public.
2. **Formulaire public** : écran d'accueil brandé, choix texte ou vidéo, note 1–5, une question principale, identité, avatar, poste/entreprise et consentement explicite.
3. **Vidéo** : enregistrer ou importer, afficher la progression, permettre de recommencer et appliquer une durée maximale par offre.
4. **Inbox** : liste `pending`, prévisualisation, approbation, refus/suppression et filtres type/statut.
5. **Publication** : seule une entrée `approved` est disponible dans le Wall et le widget.
6. **Wall** : page publique responsive, masonry, thème clair/sombre, ordre manuel simple et branding du produit en gratuit.
7. **Embed** : un script + un `div`, identifiant stable par Wall, chargement différé et aucune lecture vidéo automatique.
8. **Quotas** : deux compteurs séparés pour texte et vidéo ; les soumissions excédentaires restent acceptées mais sont verrouillées côté propriétaire.
9. **Free recommandé par la discussion produit** : 2 vidéos + 13 textes, une limite plus généreuse en volume total que Testimonial.to tout en conservant la troisième vidéo comme déclencheur d'upgrade.

À repousser après validation : imports sociaux, Chrome extension, email invitations, récompenses, réponses publiques, custom domains, analytics avancées, multi-questions vidéo, montage, transcription exploitable, IA, API publique, webhooks clients, équipes avancées, tags automatiques, multiples modèles de widgets et rich snippets.

## Sources principales

### Senja

- [Pricing](https://senja.io/pricing)
- [Plan comparison](https://support.senja.io/what-are-the-differences-between-the-free-and-paid-plans-sdcfs)
- [Using projects](https://support.senja.io/using-projects-in-senja-1p6h8)
- [Create a form](https://support.senja.io/how-to-create-senja-form-pg4sw)
- [Approved and unapproved testimonials](https://support.senja.io/what-do-approved-and-unapproved-mean-rfswt)
- [Create a Wall of Love](https://support.senja.io/how-do-i-create-wall-of-love-7ryjl)
- [Create a widget](https://support.senja.io/how-do-i-create-widget-e7dsl)

### Testimonial.to

- [Pricing](https://testimonial.to/pricing/)
- [Introduction and Spaces](https://help.testimonial.to/en/articles/8115178-introduction-to-testimonial-to)
- [Collecting testimonials](https://help.testimonial.to/en/articles/7913812-collecting-testimonials)
- [Add to Wall of Love](https://help.testimonial.to/en/articles/6223033-add-to-wall-of-love)
- [What is the Wall of Love?](https://help.testimonial.to/en/articles/7970916-what-is-the-wall-of-love)
- [Embed a Wall of Love](https://help.testimonial.to/en/articles/6223121-embed-a-wall-of-love)
- [Collecting Widget](https://help.testimonial.to/en/articles/6223129-collecting-widget)
