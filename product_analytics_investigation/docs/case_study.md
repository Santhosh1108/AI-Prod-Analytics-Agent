# Product Analytics Investigation — Case Study

## 01 — The problem

A product team notices that new-user activation has weakened following an onboarding change.

Instead of jumping directly to a solution, I framed the investigation around five questions:

- What changed?
- Where did users drop?
- Which segment is affected?
- What is the most plausible explanation?
- What should the product team test next?

## 02 — The metric

Activation is defined as completion of the product's first meaningful core action.

This definition is fixed before segmentation so that the analysis does not change its target metric after seeing the data.

## 03 — The funnel

Signup → Onboarding → Step 1 → Step 2 → Step 3 → Core Action

The funnel identifies the first stage where meaningful additional friction appears.

## 04 — Segment diagnosis

I compare the pre-change and post-change periods across:

- platform
- acquisition channel
- plan

The purpose is to find concentration, not to declare a causal effect from an observational comparison.

## 05 — Product hypothesis

If the largest deterioration is concentrated in a specific platform and onboarding stage, the working hypothesis becomes:

> The changed onboarding step introduced platform-specific friction.

This is a hypothesis, not a proven root cause.

## 06 — Decision

Rather than redesigning the entire onboarding flow, I would test the smallest change that addresses the suspected friction.

### Experiment

Control: existing Step 3

Treatment: simplified Step 3

### Primary metric

Step 3 completion rate.

### Downstream metric

Activation rate.

### Guardrails

7-day retention, errors, and support/contact rate.

## 07 — What I learned

The important product skill is not producing a chart. It is knowing what decision the chart enables.

The analysis moves from:

**Observation → diagnosis → hypothesis → experiment**

That keeps the product recommendation tied to evidence and makes the next learning step explicit.
