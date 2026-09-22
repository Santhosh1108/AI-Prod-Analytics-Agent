const CONFIG = {
  changeDate: '2026-08-15',
  model: 'gemini-2.5-flash'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('MetricLens — Product Analytics Reporting Agent');
}

function generateReport() {
  const data = buildAnalytics();
  const commentary = callGemini(data);
  const report = buildReport(data, commentary);

  const doc = DocumentApp.create('MetricLens Product Analytics Report');
  doc.getBody().setText(report);
  doc.saveAndClose();

  const pdf = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
  const pdfFile = DriveApp.createFile(pdf).setName('MetricLens Product Analytics Report.pdf');

  return {
    documentUrl: doc.getUrl(),
    pdfUrl: pdfFile.getUrl(),
    summary: data.summary
  };
}

function readSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function buildAnalytics() {
  const users = readSheet_('users');
  const events = readSheet_('events');

  const change = new Date(CONFIG.changeDate + 'T00:00:00');
  const userMap = {};
  users.forEach(u => userMap[String(u.user_id)] = u);

  const before = new Set();
  const after = new Set();
  const eventsByPeriod = {before: [], after: []};

  events.forEach(e => {
    const d = new Date(e.event_timestamp);
    const period = d < change ? 'before' : 'after';
    const id = String(e.user_id);
    if (period === 'before') before.add(id); else after.add(id);
    eventsByPeriod[period].push({
      user_id: id,
      event_name: String(e.event_name)
    });
  });

  function activation(periodEvents, cohort) {
    const activated = new Set(
      periodEvents.filter(e => e.event_name === 'core_action_completed')
        .map(e => e.user_id)
    );
    return cohort.size ? +(activated.size / cohort.size * 100).toFixed(2) : 0;
  }

  const beforeAct = activation(eventsByPeriod.before, before);
  const afterAct = activation(eventsByPeriod.after, after);

  const steps = [
    'signup',
    'onboarding_started',
    'onboarding_step_1_completed',
    'onboarding_step_2_completed',
    'onboarding_step_3_completed',
    'core_action_completed'
  ];

  function funnel(periodEvents, cohort) {
    return steps.map(step => {
      const n = new Set(periodEvents.filter(e => e.event_name === step)
        .map(e => e.user_id)).size;
      return {step, users: n, rate: cohort.size ? +(n/cohort.size*100).toFixed(2) : 0};
    });
  }

  function segmentAnalysis(period, cohort) {
    const result = [];
    ['platform', 'acquisition_channel', 'plan'].forEach(dim => {
      const values = [...new Set(users.map(u => u[dim]))];
      values.forEach(value => {
        const ids = new Set(users.filter(u => u[dim] === value).map(u => String(u.user_id)));
        const scopedCohort = new Set([...cohort].filter(id => ids.has(id)));
        const scopedEvents = eventsByPeriod[period].filter(e => scopedCohort.has(e.user_id));
        result.push({
          dimension: dim,
          segment: String(value),
          users: scopedCohort.size,
          activation_pct: activation(scopedEvents, scopedCohort)
        });
      });
    });
    return result;
  }

  const summary = {
    users: users.length,
    events: events.length,
    before_activation_pct: beforeAct,
    after_activation_pct: afterAct,
    change_pp: +(afterAct - beforeAct).toFixed(2),
    change_date: CONFIG.changeDate
  };

  return {
    summary,
    funnel_before: funnel(eventsByPeriod.before, before),
    funnel_after: funnel(eventsByPeriod.after, after),
    segments_before: segmentAnalysis('before', before),
    segments_after: segmentAnalysis('after', after),
    caveat: 'Synthetic portfolio dataset. Pre/post comparison is descriptive and not causal proof.'
  };
}

function callGemini(data) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('Set GEMINI_API_KEY in Apps Script Project Settings.');

  const prompt = `You are a product analytics reporting assistant.
Write a concise professional product analytics report from the calculated data below.

Rules:
- Use only the supplied numbers.
- Do not invent metrics.
- Distinguish measured findings from hypotheses.
- Include: executive summary, key findings, likely drivers, recommended experiment, primary metric, guardrails, limitations.
- The dataset is synthetic; do not claim real business impact.

CALCULATED DATA:
${JSON.stringify(data, null, 2)}`;

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
              CONFIG.model + ':generateContent?key=' + encodeURIComponent(key);

  const payload = {
    contents: [{parts: [{text: prompt}]}],
    generationConfig: {temperature: 0.2}
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  if (code >= 300) throw new Error(JSON.stringify(body));

  return body.candidates[0].content.parts[0].text;
}

function buildReport(data, commentary) {
  const s = data.summary;
  return [
    'METRICLENS — PRODUCT ANALYTICS REPORT',
    '',
    'EXECUTIVE SUMMARY',
    commentary,
    '',
    'STRUCTURED METRICS',
    JSON.stringify(data, null, 2),
    '',
    'DATA NOTE',
    s.users + ' synthetic users and ' + s.events + ' synthetic events were analyzed.',
    'Activation changed by ' + s.change_pp + ' percentage points around ' + s.change_date + '.',
    'This pre/post analysis is descriptive and not causal proof.'
  ].join('\n');
}
