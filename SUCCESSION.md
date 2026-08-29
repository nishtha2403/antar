# Succession

**Adopted 30 August 2026 by Nishtha Sharma, founder.**

## What this document is, and what it is not

This is a **statement of intent, not a constraint**.

Two of its provisions say so together. No person or body can currently remove
the founder (§1), and the founder can amend this document alone (§4). A clause
its subject can rewrite at will binds nobody, and this one is no exception.

It is written now anyway, for two reasons. It costs nothing today and becomes
contested exactly when it is needed. And a person being asked to join a project
of this kind will reasonably want to read it before saying yes — including
reading, honestly, that the constraints do not yet exist.

§5 states what has to happen for this to become binding.

---

## 1. Removal of the founder

**No person or body can presently remove the founder.** This is a gap, recorded
as a gap.

The founder undertakes to name a removal authority **before Gate 4 begins, or by
31 August 2027, whichever is earlier**. Gate 4 is the scale to 543
constituencies: the point at which the project stops being one person checking
every figure by hand and starts publishing at a volume no individual can verify.
Concentrating that much unreviewed output in one unremovable person is the
condition this deadline exists to prevent.

The removal authority should be a panel of at least three named people, deciding
by majority, none of whom is the founder. The public finance researcher the
project is recruiting is the natural first member.

**If the deadline passes without a removal authority named, the project does not
proceed to Gate 4.** Scope limits get enforced by real founders; this is one.

## 2. Publication authority

**If the founder is unavailable, publication halts.**

This follows from the code rather than sitting alongside it. Rule 6 — no
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

A second verifier may be registered at any time and this section revisited. Until
then, the single point of failure is real, is known, and is the price of the rule.

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
unfulfilled. It should be secured on the same timetable as §1.

Wind-down is declared by the founder, or by the removal authority once one
exists.

## 4. Amendment

**The founder may amend this document alone.**

Amendments are appended, never edited in place, and every version stays readable
— the same rule the project applies to targets it reports on. A quiet revision to
this document would be the precise thing Antar exists to make visible elsewhere.

This provision is what makes the document a statement of intent rather than a
constraint. It is chosen knowingly, and §5 records what changing it would take.

## 5. What would make this binding

Three changes, in order of how much they cost:

1. **Name a removal authority (§1).** Requires people willing to be named.
2. **Name an archive custodian (§3).** Requires an institution's commitment.
3. **Move amendment authority (§4) to that removal authority.** Requires nothing
   but the founder's signature, and is the one that will cost something one day —
   which is the point.

Until step 3, this document describes what the founder intends to do, not what
the founder can be held to.

---

## Amendment history

| Date | Change | By |
|---|---|---|
| 2026-08-30 | Adopted. §1 records no removal authority, with a sunset of 31 August 2027 or the start of Gate 4. §3 custodian unnamed. | Nishtha Sharma |
