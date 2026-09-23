# AI-Prod-Analytics-Agent  — AI Product Analytics Reporting Agent

Cloud-first product analytics reporting workflow inspired by the architecture of the reference AI Financial Reporting Agent, but built for product analytics.

## Architecture

Google Sheets
→ Apps Script
→ deterministic KPI/funnel/segment/feature/trend analysis
→ Gemini
→ evidence + hypotheses + experiment recommendations
→ Google Docs
→ PDF
→ Google Drive

## Google Sheet tabs

### users
`user_id, platform, acquisition_channel, plan`

### events
`user_id, event_name, event_timestamp`

Supported funnel:
`signup → onboarding_started → onboarding_step_1_completed → onboarding_step_2_completed → onboarding_step_3_completed → core_action_completed`

### feature_usage
`feature, users, usage_pct`

### historical_metrics
`period, activation_pct, retention_pct`

## Setup

1. Create the four tabs and import the CSVs in `data/`.
2. Open Extensions → Apps Script.
3. Add `Code.gs` and `index.html`.
4. Add `GEMINI_API_KEY` under Project Settings → Script Properties.
5. Deploy as a Web App.
6. Open the web app and generate the report.

## Reliability

The Gemini call includes retries for temporary 429/5xx failures and model fallback. Model availability is account/API dependent; the preferred list can be edited in `CONFIG.preferredModels`.

## Output

Each run creates:
- executive summary
- KPI snapshot
- complete 6-step funnel table
- segment analysis
- feature adoption table
- historical metrics
- Gemini analysis
- evidence vs hypotheses
- experiment recommendation
- primary metric + guardrails
- Google Doc
- PDF

## Data integrity

Numerical analytics are calculated deterministically in Apps Script. Gemini is instructed to interpret those calculations and not invent KPI values.

The included dataset is synthetic and should be labeled as such in a portfolio.
