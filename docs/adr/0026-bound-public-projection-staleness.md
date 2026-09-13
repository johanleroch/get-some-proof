# Bound public projection staleness

**Superseded by ADR 0040:** The accepted target uses eventually propagated public publications, explicit page reload and a 24-hour maximum validity on new requests. The prior 60-second/immediate-global-removal contract below is retained as history, not the target migration requirement. Implementation and deployment status are tracked separately.

Ordinary publication, archival, visibility, and ordering changes must reach the Public Wall and Embedded Wall within 60 seconds. Consent Withdrawal and Permanent Deletion bypass normal cached staleness and remove the affected content immediately, accepting targeted invalidation complexity so a performance cache never weakens an explicit privacy or deletion action.
