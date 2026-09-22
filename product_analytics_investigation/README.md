# MetricLens — AI Product Analytics Agent

MetricLens is a portfolio project demonstrating how an AI analytics agent can turn product event data into a product diagnosis and experiment proposal.

## What it does

```text
Product data + business question
        ↓
AI analytics agent
        ↓
Schema inspection → SQL / funnel / segmentation tools
        ↓
Evidence gathering
        ↓
Hypothesis
        ↓
Product diagnosis
        ↓
Experiment proposal
```

The agent can use a local Ollama model (default: `qwen3:4b`) to choose tools dynamically. If Ollama is unavailable, the project uses a deterministic fallback that follows the same investigation tool workflow so the demo remains runnable.

## Example question

> Why did activation drop after the onboarding change?

The agent investigates the synthetic event dataset, compares activation before/after the 2026-08-15 change, drills into the funnel and platform segments, and produces an evidence-vs-hypothesis-aware recommendation.

## Data note

The dataset is synthetic and created for portfolio demonstration. Findings must not be represented as real company or production-user results.

## Run

```bash
pip install -r requirements.txt
streamlit run app/app.py
```

### Optional local AI agent

Install and run Ollama, then pull the configured model:

```bash
ollama pull qwen3:4b
```

The app will attempt to use Ollama automatically. Without it, the deterministic analytics-agent fallback runs.

## Portfolio positioning

**AI Product Analytics Agent | Python, SQL, DuckDB, Streamlit, Ollama**

Built an AI analytics agent that investigates product metric changes by selecting analytical tools, querying event data, drilling into funnels and segments, separating evidence from hypotheses, and translating findings into experiment proposals.
