# Succession

**Adopted 30 August 2026 by Nishtha Sharma, founder.**

## What this document is, and what it is not

This is a **statement of intent, not a constraint**.

Two of its provisions say so together. No person or body can currently remove
the founder (§1), and the founder can amend this document alone (§4). A clause
its subject can rewrite at will binds nobody, and this one is no exception.

It is written anyway. It costs nothing and becomes contested exactly when it is
needed, and anyone deciding whether to trust what Antar publishes is entitled to
know who can stop it and who cannot. The answer, currently, is nobody.

§5 states what would make it binding.

---

## 1. Removal of the founder

**No person or body can remove the founder, and none is planned.**

The 30 August 2026 version of this clause set a deadline — name a removal
authority before Gate 4 or by 31 August 2027 — on the assumption that a
co-founder would be recruited. That search has been closed without a hire
(see the amendment history). The deadline is therefore withdrawn rather than
left standing as an obligation nobody intends to meet.

What this means, stated plainly so it is not discovered later: Antar is a
single-person project with no mechanism for removing that person, operating at
whatever scale it reaches. The brief's argument for a second person was not
about workload — it was that two independent reviewers caught an ambiguity in
the founding document that neither the founder nor an AI had caught, and that
this is a recurring class of error rather than a one-off. That argument is not
answered by this clause; it is accepted as a standing risk.

Should the founder later wish to be removable, §5 records what that takes.

## 2. Publication authority

**If the founder is unavailable, publication halts. Permanently.**

This was written as an interim state pending a second verifier. With no
co-founder planned, it is the permanent design. It follows from the code rather
than sitting alongside it. Rule 6 — no
unverified figure is published — is enforced in the type system: the render path
accepts only figures a registered human has signed off, and
`src/kernel/people.ts` currently registers one person. Nothing can be published
without the founder, and nothing should be.

The consequences are accepted deliberately:

- The site freezes rather than degrading. A stale page carrying its own
  retrieval and verification dates is honest about being stale.
- The automated monthly rebuild at Gate 4 will fail rather than publish, which is
  the intended behaviour of a pipeline that fails loud.
- During an election window, a frozen site may be worse than a current one. That
  cost is accepted rather than traded against the risk of an unverified claim
  about public money going out under nobody's name.

A second verifier may be registered at any time and this section revisited. Absent
that, the single point of failure is permanent, known, and accepted: the project
ends when the founder stops, and the archive obligation in §3 is what survives it.

## 3. If the project stops

The records are worth something only if they outlive the organisation.

On wind-down, the founder undertakes to:

1. Release all collected data and methodology under a permissive open licence
   permitting redistribution and derivative work.
2. Deposit the complete archive — records, source documents, corrections log and
   version history — with a **named archive custodian**, being an institution
   under an obligation to keep it publicly reachable.

**The custodian is not yet named.** Naming one requires a commitment from an
actual institution, and until that commitment exists this obligation is
unfulfilled. With §1's deadline withdrawn, this is now the only dated obligation
left in the document, and it carries no date — which is worth fixing, because it
is the single provision that determines whether any of this work survives the
founder losing interest.

Wind-down is declared by the founder. There is no other body that can declare
it.

## 4. Amendment

**The founder may amend this document alone.**

Amendments are appended, never edited in place, and every version stays readable
— the same rule the project applies to targets it reports on. A quiet revision to
this document would be the precise thing Antar exists to make visible elsewhere.

This provision is what makes the document a statement of intent rather than a
constraint. It is chosen knowingly, and §5 records what changing it would take.

## 5. What would make this binding

Three changes, in order of how much they cost:

1. **Name a removal authority (§1).** Requires people willing to be named. No
   longer planned, so this is a change of direction rather than a pending task.
2. **Name an archive custodian (§3).** Requires an institution's commitment. Still
   outstanding, and now the only obligation here with any prospect of being met.
3. **Move amendment authority (§4) to that removal authority.** Requires nothing
   but the founder's signature, and is the one that would cost something.

Until step 3, this document describes what the founder intends to do, not what
the founder can be held to. As of the 30 August 2026 amendment, steps 1 and 3 are
not planned, so it will continue to describe intent indefinitely.

---

## Amendment history

| Date | Change | By |
|---|---|---|
| 2026-08-30 | Adopted. §1 records no removal authority, with a sunset of 31 August 2027 or the start of Gate 4. §3 custodian unnamed. | Nishtha Sharma |
| 2026-08-30 | Co-founder search closed without a hire. §1 sunset withdrawn: no removal authority is planned. §2 publication halt reclassified from interim to permanent. The risk the second person was meant to cover is accepted as standing. | Nishtha Sharma |
