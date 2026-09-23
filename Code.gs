const CONFIG = { changeDate: '2026-08-15', model: 'gemini-3.6-flash' };

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('MetricLens — AI Product Analytics Reporting Agent');
}

function generateReport() {
  const analytics = buildAnalytics();
  const ai = callGemini(analytics);
  const report = buildReport(analytics, ai);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  const doc = DocumentApp.create('MetricLens Product Analytics Report - ' + stamp);
  doc.getBody().setText(report);
  doc.saveAndClose();
  const pdf = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF)
    .setName('MetricLens Product Analytics Report - ' + stamp + '.pdf');
  const pdfFile = DriveApp.createFile(pdf);
  return {documentUrl: doc.getUrl(), pdfUrl: pdfFile.getUrl(), summary: analytics.summary};
}

function readSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift().map(String);
  return values.map(row => {
    const obj = {}; headers.forEach((h,i) => obj[h] = row[i]); return obj;
  });
}
function pct_(n,d){ return d ? +(n/d*100).toFixed(2) : 0; }
function unique_(a){ return [...new Set(a)]; }

function buildAnalytics() {
  const users=readSheet_('users'), events=readSheet_('events');
  const feature=readSheet_('feature_usage'), history=readSheet_('historical_metrics');
  const change=new Date(CONFIG.changeDate+'T00:00:00');
  const ev=events.map(e=>({user_id:String(e.user_id),event_name:String(e.event_name),timestamp:new Date(e.event_timestamp)}));
  const before=ev.filter(e=>e.timestamp<change), after=ev.filter(e=>e.timestamp>=change);
  const beforeUsers=new Set(before.map(e=>e.user_id)), afterUsers=new Set(after.map(e=>e.user_id));
  const steps=['signup','onboarding_started','onboarding_step_1_completed','onboarding_step_2_completed','onboarding_step_3_completed','core_action_completed'];
  function activation(rows,cohort){return pct_(new Set(rows.filter(e=>e.event_name==='core_action_completed').map(e=>e.user_id)).size,cohort.size);}
  function funnel(rows,cohort){return steps.map(step=>{const n=new Set(rows.filter(e=>e.event_name===step).map(e=>e.user_id)).size;return {step,users:n,rate_pct:pct_(n,cohort.size)}});}
  function segments(rows,cohort,dim){
    return unique_(users.map(u=>String(u[dim]||'')).filter(Boolean)).map(value=>{
      const ids=new Set(users.filter(u=>String(u[dim])===value).map(u=>String(u.user_id)));
      const scoped=new Set([...cohort].filter(id=>ids.has(id)));
      return {dimension:dim,segment:value,users:scoped.size,activation_pct:activation(rows.filter(e=>scoped.has(e.user_id)),scoped)};
    });
  }
  const b=activation(before,beforeUsers), a=activation(after,afterUsers);
  let seg=[]; ['platform','acquisition_channel','plan'].forEach(d=>seg=seg.concat(segments(after,afterUsers,d)));
  return {
    summary:{users:users.length,events:events.length,before_activation_pct:b,after_activation_pct:a,activation_change_pp:+(a-b).toFixed(2),change_date:CONFIG.changeDate},
    funnel:{before:funnel(before,beforeUsers),after:funnel(after,afterUsers)},
    segments:seg,
    feature_usage:feature.map(r=>({feature:String(r.feature||r.feature_name||''),users:Number(r.users||r.unique_users||0),usage_pct:Number(r.usage_pct||r.adoption_pct||0)})),
    historical_metrics:history.map(r=>({period:String(r.period||r.date||''),activation_pct:Number(r.activation_pct||r.activation||0),retention_pct:Number(r.retention_pct||r.retention||0)})),
    caveat:'Synthetic portfolio dataset. Observational comparisons are descriptive and do not establish causality.'
  };
}

function callGemini(data) {
  const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if(!key) throw new Error('Missing GEMINI_API_KEY in Script Properties.');
  const prompt=`You are MetricLens, a product analytics reporting agent. Analyze ONLY the calculated data below.
Produce: executive summary; KPI interpretation; funnel findings; segment findings; feature usage observations; trend observations; evidence-backed findings; clearly labeled hypotheses; recommended product experiment; primary metric; guardrails; limitations.
Never invent numbers. Do not claim causality. Treat data as synthetic portfolio data.
DATA:\n${JSON.stringify(data,null,2)}`;
  const url='https://generativelanguage.googleapis.com/v1beta/models/'+CONFIG.model+':generateContent?key='+encodeURIComponent(key);
  const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}}),muteHttpExceptions:true});
  const body=JSON.parse(res.getContentText());
  if(res.getResponseCode()>=300) throw new Error(JSON.stringify(body));
  return body.candidates[0].content.parts[0].text;
}

function buildReport(data,ai) {
  const s=data.summary;
  return ['METRICLENS','AI PRODUCT ANALYTICS REPORT','',ai,'','STRUCTURED KPI SNAPSHOT',
    'Users analyzed: '+s.users,'Events analyzed: '+s.events,
    'Activation before change: '+s.before_activation_pct+'%',
    'Activation after change: '+s.after_activation_pct+'%',
    'Activation change: '+s.activation_change_pp+' percentage points',
    'Change date: '+s.change_date,'','DATA LIMITATION',data.caveat,'','Generated by MetricLens'].join('\n');
}
