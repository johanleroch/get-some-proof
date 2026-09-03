# Get Some Proof

Get Some Proof lets a small brand collect customer testimonials, moderate them privately, and publish selected proof on a hosted wall or an embedded wall.

## Ownership

**Owner**:
The authenticated person who operates a Brand and controls its collection, moderation, publication, and subscription.
_Avoid_: Operator, Admin, Customer

**Brand**:
The identity for which an Owner collects and publishes proof. The MVP gives each Owner one Brand.
_Avoid_: Project, Space, Client, Organization in product language

**Workspace**:
The Owner's private operating area for one Brand. It is the product-facing view of an underlying tenant boundary, not a container for multiple client accounts.
_Avoid_: Account, Organization in product language

**Public Slug**:
The unique URL name initially derived from the Brand name and shared by its collection and wall addresses. The Owner may change it once after creation, after which it becomes permanent; the former value is released and its URLs stop working.
_Avoid_: Brand ID, Workspace ID, Domain

## Collection

**Collection Form**:
The Brand's public destination for requesting text or video proof. The MVP gives each Workspace one Collection Form.
_Avoid_: Survey, Questionnaire, Campaign

**Submitter**:
A person aged 18 or over who gives proof through a Collection Form without needing an account.
_Avoid_: Customer when referring to the person submitting, Respondent

**Submission**:
A completed delivery of exactly one type of proof, text or video, together with submitter details and Publication Consent.
_Avoid_: Response, Lead, Draft

**Submission Management Link**:
The private, revocable link emailed to a Submitter for viewing their Submission, withdrawing consent, editing their own text, or replacing their own video without creating an account. It remains valid until the Testimonial is deleted. A rate-limited replacement request keeps the former link active until delivery succeeds, then atomically invalidates it; concurrent requests for the same email and Brand collapse into one delivery.
_Avoid_: Public link, Owner link, Video Retry Link

**Submission Revision**:
A replacement version of content or public identity supplied by the original Submitter through their Submission Management Link. Confirming it requires renewed Publication Consent, removes any published prior version, and returns the Testimonial to Pending without consuming another Collection Credit.
_Avoid_: Owner edit, New testimonial

**Publication Consent**:
The Submitter's affirmative, versioned permission for the named Brand to publish a specific Submission and its disclosed public identity fields. It is separate from the required private email and can be withdrawn through the Brand's disclosed contact route.
_Avoid_: Terms acceptance, Marketing opt-in

**Consent Withdrawal**:
The Submitter's revocation of Publication Consent. It removes the Testimonial from every public surface immediately and requires its content and media to be permanently deleted within 24 hours.
_Avoid_: Archive request, Unpublish request

**Collection Credit**:
A lifetime Free-plan allowance consumed when an eligible Submission is collected. Archiving or deleting genuine proof does not replenish it, while confirmed Spam does.
_Avoid_: Storage slot, Published testimonial

**Spam**:
An abusive or irrelevant Submission that does not represent genuine proof for the Brand. It is quarantined rather than Archived and may replenish a Collection Credit under the abuse policy.
_Avoid_: Rejected testimonial, Unfavorable feedback

**Spam Quarantine**:
The seven-day reversible holding period before confirmed Spam content and media are permanently deleted.
_Avoid_: Archived, Trash

## Proof lifecycle

**Testimonial**:
A collected text or video Submission held by the Brand as private proof or selected for public display.
_Avoid_: Review, Quote, Proof when referring to one record

**Pending**:
The moderation state of a newly collected Testimonial that has never been public.
_Avoid_: Unapproved, Draft

**Published**:
The moderation state of a Testimonial selected and eligible for public display.
_Avoid_: Approved, Liked

**Archived**:
The moderation state of a retained Testimonial hidden from public display.
_Avoid_: Rejected, Deleted

**Permanent Deletion**:
An explicit, irreversible removal of a Testimonial and, for video, all associated hosted media. It is a destructive action rather than a moderation state.
_Avoid_: Archive, Remove from wall

**Video Asset**:
The hosted source, renditions, thumbnails, and playback identity associated with a video Testimonial. Its upload, processing, availability, retention, and deletion lifecycle is separate from moderation.
_Avoid_: Testimonial, Attachment, File

**Video Reservation**:
A temporary hold against the applicable video allowance while an upload is in progress. It expires or is released after failure and becomes consumed capacity only when the Video Asset is ready.
_Avoid_: Video Slot, Collection Credit

**Processing**:
The Video Asset state after upload has completed but before the video is playable. A Processing video cannot be Published.
_Avoid_: Pending when referring to media availability

**Ready**:
The Video Asset state in which the hosted video is playable and may be Published.
_Avoid_: Published, Uploaded

**Failed**:
The Video Asset state in which upload or processing did not produce a playable video. It consumes no Collection Credit or Video Slot and may be retried with a new upload.
_Avoid_: Archived, Rejected

**Video Retry Link**:
A private, single-use link sent after a post-submission video failure so the Submitter can replace only the failed video within 24 hours.
_Avoid_: Collection Form, Account link

**Generated Captions**:
The optional public text track generated from the Submitter-selected spoken language of a Video Asset. Caption failure does not prevent a Ready video from being Published.
_Avoid_: Testimonial text, Transcript

## Publication

**Public Wall**:
The Brand's hosted public page containing its Published Testimonials in the same curated order as the Embedded Wall.
_Avoid_: Gallery, Feed, Landing page

**Embedded Wall**:
The version of the Public Wall placed inside another website and fed by the same published selection.
_Avoid_: Widget when referring to the published destination

**Public Projection**:
The public-safe representation of Published Testimonials shared by the Public Wall and Embedded Wall. It applies both Wall-wide and per-Testimonial visibility choices and excludes private identity, consent, tenancy, moderation, and audit data.
_Avoid_: Public database, API response

**Curated Order**:
The Owner-controlled sequence of Published Testimonials shared by both public walls. Newly Published proof begins first until the Owner changes that sequence.
_Avoid_: Sort, feed order

**Visibility Override**:
A per-Testimonial choice that replaces a Wall-wide visibility default for one optional public identity field. Submitter name is not optional and cannot receive an override.
_Avoid_: Hidden field, privacy consent

**Attribution Badge**:
The visible Get Some Proof branding required on Free public surfaces and removable on Pro.
_Avoid_: Backlink, SEO link

## Plans

**Free Plan**:
The no-cost entitlement with lifetime Collection Credits, fixed product limits, and a required Attribution Badge. Its used credits persist through upgrades and later downgrades.
_Avoid_: Trial

**Pro Plan**:
The paid entitlement with unlimited text collection, a renewable video storage allowance, removable branding, and MP4 download.
_Avoid_: Premium, Unlimited plan

**Video Slot**:
One place in the Pro Plan's simultaneous stored-video allowance. Permanently deleting a video frees its slot.
_Avoid_: Collection Credit, Published video

**Downgrade Selection**:
The Owner's choice of which Testimonials remain Published when Pro entitlements end and Free limits apply.
_Avoid_: Deletion list, Migration

**Payment Grace Period**:
The seven days after a failed Pro renewal during which existing Pro publication, branding, and download access remain available but additional video storage is blocked.
_Avoid_: Trial, Paid period

**Workspace Deletion**:
The Owner-initiated irreversible removal of the Workspace, its public surfaces, private records, and hosted media after reauthentication and explicit confirmation.
_Avoid_: Downgrade, Archive, Account closure
