# MetricLens — Gemini Product Analytics Reporting Agent

Cloud-first product analytics reporting workflow.

## Workflow

Google Sheets (product data)
→ Google Apps Script
→ deterministic KPI / funnel / segment analysis
→ Gemini API
→ AI product commentary
→ Google Docs report
→ PDF saved to Google Drive

No local Python, Streamlit, or Ollama is required.

## Setup

1. Create a Google Sheet.
2. Create sheets named `users` and `events`.
3. Put your product data in those sheets.
4. Open **Extensions → Apps Script**.
5. Paste `Code.gs`.
6. In Apps Script, add your Gemini API key as a Script Property:
   - Project Settings → Script properties
   - Property: `GEMINI_API_KEY`
7. Deploy → New deployment → Web app.
8. Execute as yourself and choose the access level you want.
9. Open the web-app URL and click **Generate Report**.

## Expected columns

`users`:
- user_id
- platform
- acquisition_channel
- plan

`events`:
- user_id
- event_name
- event_timestamp

The included demo data uses a simulated onboarding change on 2026-08-15.

## Important

The included data is synthetic portfolio data. Do not present its metrics as real company results.

Gemini is used for narrative interpretation. Core KPI calculations are performed deterministically in Apps Script.
