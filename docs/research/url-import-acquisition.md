# URL import acquisition measurement

The shared service records conversions in the same transaction as the action
that actually succeeds. The report is internal-only (`importAcquisition:report`)
and accepts `from` and `through` as UTC `YYYY-MM-DD` dates, at most 31 days
inclusive. Its output is one count per UTC day, channel and stage.

| Stage     | Meaning                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| started   | An anonymous preview request passed admission limits, or an owned source was retrieved and its preview is being persisted. These are import attempts, not page views or unique visitors. |
| previewed | The source snapshot was stored successfully.                                                                                                                                             |
| claimed   | A verified Owner attached an anonymous preview to an eligible Project. This includes existing users; it is not a signup count.                                                           |
| saved     | At least one new text testimonial was saved as Pending, or a video copy was accepted for processing. This does not mean a video is ready.                                                |
| published | The first imported testimonial from that preview was actually published after the Owner's attestation.                                                                                   |

Each stage counts at most once per preview flow, including repeated confirmation,
claim retries, multiple selected testimonials and repeated publication. Counts
are recorded on the day the stage occurs, so daily ratios are not cohort
conversion rates. New previews are new flows; the report does not count people.

Channels are `public-web`, `workspace` and `chatgpt`. Anonymous entry defaults to
`public-web`; its supplied channel is attribution data, not an authorization or
verified statement of ChatGPT distribution. The ChatGPT adapter remains a
separate delivery requirement.

The aggregate tables contain no source URL, quotation, name, email, account,
browser token or conversation. The per-flow record contains only an opaque ID,
channel, reached stages and expiration time. It expires after 90 days; later
publications still work but fall outside the attribution window. Anonymous
source content separately retains its existing 24-hour expiration. Anonymous
daily counts remain available after flow expiration.

## Evidence

The anonymous service regression follows preview, repeat claim, explicit save
and two publications from one flow. It verifies stage counts of one, absence of
source/customer/token data, expiration of the flow and preservation of anonymous
aggregates. The existing authorization tests still govern claim and publication.
No production acquisition, traffic, signup rate or ChatGPT listing is claimed by
these tests.
