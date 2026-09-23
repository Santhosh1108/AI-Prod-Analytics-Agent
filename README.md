# MetricLens — AI Product Analytics Reporting Agent

Cloud-first product analytics reporting workflow.

Google Sheets → Apps Script → KPI/funnel/segment/trend analysis → Gemini → product insights → Google Docs → PDF → Google Drive.

## Google Sheet tabs
- `users`: user_id, platform, acquisition_channel, plan
- `events`: user_id, event_name, event_timestamp
- `feature_usage`: feature, users, usage_pct
- `historical_metrics`: period, activation_pct, retention_pct

## Setup
1. Create the tabs above and import the CSVs in `data/`.
2. Google Sheet → Extensions → Apps Script.
3. Add `Code.gs` and `index.html`.
4. Project Settings → Script Properties → add `GEMINI_API_KEY`.
5. Deploy → New deployment → Web app → Execute as Me → Anyone with link.
6. Open the web app and generate a report.

The dataset is synthetic. Numerical calculations are deterministic; Gemini interprets the calculated evidence.
