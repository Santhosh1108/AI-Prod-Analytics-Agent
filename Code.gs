const CONFIG = {
  changeDate: '2026-08-15',
  preferredModels: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  retryCount: 3,
  retryDelayMs: 4000
};

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
  const body = doc.getBody();

  body.appendParagraph('METRICLENS').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('AI PRODUCT ANALYTICS REPORT').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Generated: ' + stamp);
  body.appendParagraph('');

  body.appendParagraph('EXECUTIVE SUMMARY').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(ai);

  body.appendParagraph('KPI SNAPSHOT').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const k = analytics.summary;
  const kt = body.appendTable([
    ['Metric','Before','After','Change'],
    ['Activation', k.before_activation_pct+'%', k.after_activation_pct+'%', k.activation_change_pp+' pp'],
    ['Users analyzed', String(k.before_users), String(k.after_users), '-'],
    ['Change date', k.change_date, '-', '-']
  ]);
  kt.getRow(0).editAsText().setBold(true);

  body.appendParagraph('COMPLETE FUNNEL').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const ft = [['Step','Before Users','Before %','After Users','After %','After Step Drop-off %']];
  analytics.funnel.after.forEach((a,i) => {
    const b=analytics.funnel.before[i];
    const prev=i===0 ? a.rate_pct : analytics.funnel.after[i-1].rate_pct;
    ft.push([a.step,String(b.users),b.rate_pct+'%',String(a.users),a.rate_pct+'%',i===0?'-':(prev-a.rate_pct).toFixed(2)+'%']);
  });
  const table=body.appendTable(ft);
  table.getRow(0).editAsText().setBold(true);

  body.appendParagraph('SEGMENT ANALYSIS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const st=[['Dimension','Segment','Users','Activation %']];
  analytics.segments.forEach(x=>st.push([x.dimension,x.segment,String(x.users),x.activation_pct+'%']));
  const stbl=body.appendTable(st); stbl.getRow(0).editAsText().setBold(true);

  body.appendParagraph('FEATURE ADOPTION').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const av=[['Feature','Users','Usage %']];
  analytics.feature_usage.forEach(x=>av.push([x.feature,String(x.users),x.usage_pct+'%']));
  const at=body.appendTable(av); at.getRow(0).editAsText().setBold(true);

  body.appendParagraph('HISTORICAL METRICS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  const ht=[['Period','Activation %','Retention %']];
  analytics.historical_metrics.forEach(x=>ht.push([x.period,x.activation_pct+'%',x.retention_pct+'%']));
  const htb=body.appendTable(ht); htb.getRow(0).editAsText().setBold(true);

  body.appendParagraph('AI ANALYSIS').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(ai);
  body.appendParagraph('');
  body.appendParagraph('DATA LIMITATION').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(analytics.caveat);

  doc.saveAndClose();

  const pdfBlob=DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF)
    .setName('MetricLens Product Analytics Report - '+stamp+'.pdf');
  const pdfFile=DriveApp.createFile(pdfBlob);

  return {documentUrl:doc.getUrl(), pdfUrl:pdfFile.getUrl(), summary:k};
}

function readSheet_(name) {
  const sh=SpreadsheetApp.getActive().getSheetByName(name);
  if(!sh) return [];
  const values=sh.getDataRange().getValues();
  if(values.length<2) return [];
  const headers=values.shift().map(String);
  return values.map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]);return o;});
}
function pct_(n,d){return d?+(n/d*100).toFixed(2):0;}
function unique_(a){return [...new Set(a)];}

function buildAnalytics(){
  const users=readSheet_('users'), events=readSheet_('events');
  const feature=readSheet_('feature_usage'), history=readSheet_('historical_metrics');
  if(!users.length||!events.length) throw new Error('Missing users or events data.');

  const change=new Date(CONFIG.changeDate+'T00:00:00');
  const ev=events.map(e=>({user_id:String(e.user_id),event_name:String(e.event_name),timestamp:new Date(e.event_timestamp)}));
  const before=ev.filter(e=>e.timestamp<change), after=ev.filter(e=>e.timestamp>=change);
  const beforeUsers=new Set(before.map(e=>e.user_id)), afterUsers=new Set(after.map(e=>e.user_id));
  const steps=['signup','onboarding_started','onboarding_step_1_completed','onboarding_step_2_completed','onboarding_step_3_completed','core_action_completed'];

  function funnel(rows,cohort){
    return steps.map(step=>{
      const ids=new Set(rows.filter(e=>e.event_name===step).map(e=>e.user_id));
      return {step,users:ids.size,rate_pct:pct_(ids.size,cohort.size)};
    });
  }
  function activation(rows,cohort){
    return pct_(new Set(rows.filter(e=>e.event_name==='core_action_completed').map(e=>e.user_id)).size,cohort.size);
  }
  function segmentAnalysis(rows,cohort,dim){
    return unique_(users.map(u=>String(u[dim]||'')).filter(Boolean)).map(value=>{
      const ids=new Set(users.filter(u=>String(u[dim])===value).map(u=>String(u.user_id)));
      const scoped=new Set([...cohort].filter(id=>ids.has(id)));
      return {dimension:dim,segment:value,users:scoped.size,
        activation_pct:activation(rows.filter(e=>scoped.has(e.user_id)),scoped)};
    });
  }

  const b=activation(before,beforeUsers), a=activation(after,afterUsers);
  let seg=[];['platform','acquisition_channel','plan'].forEach(d=>seg=seg.concat(segmentAnalysis(after,afterUsers,d)));

  return {
    summary:{users:users.length,events:events.length,before_users:beforeUsers.size,after_users:afterUsers.size,
      before_activation_pct:b,after_activation_pct:a,activation_change_pp:+(a-b).toFixed(2),change_date:CONFIG.changeDate},
    funnel:{before:funnel(before,beforeUsers),after:funnel(after,afterUsers)},
    segments:seg,
    feature_usage:feature.map(r=>({feature:String(r.feature||r.feature_name||''),users:Number(r.users||r.unique_users||0),usage_pct:Number(r.usage_pct||r.adoption_pct||0)})),
    historical_metrics:history.map(r=>({period:String(r.period||r.date||''),activation_pct:Number(r.activation_pct||r.activation||0),retention_pct:Number(r.retention_pct||r.retention||0)})),
    caveat:'Synthetic portfolio dataset. Observational comparisons are descriptive and do not establish causality.'
  };
}

function callGemini(data){
  const key=PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if(!key) throw new Error('Missing GEMINI_API_KEY in Script Properties.');

  const prompt=`You are MetricLens, an AI product analytics reporting agent.
Analyze ONLY the calculated analytics below.
Return concise sections:
1 Executive Summary
2 KPI Findings
3 Funnel Findings
4 Segment Findings
5 Feature Adoption
6 Trend Findings
7 Evidence vs Hypotheses
8 Recommended Product Experiment
9 Primary Metric and Guardrails
10 Limitations

Rules: never invent numbers; do not claim causality from observational data; clearly label hypotheses; use only supplied data; synthetic portfolio dataset.
DATA:
${JSON.stringify(data,null,2)}`;

  let lastError='';
  for(const model of CONFIG.preferredModels){
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(key);
    for(let attempt=1;attempt<=CONFIG.retryCount;attempt++){
      try{
        const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
          payload:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2}}),
          muteHttpExceptions:true});
        const code=res.getResponseCode(), body=JSON.parse(res.getContentText()||'{}');
        if(code>=200&&code<300&&body.candidates&&body.candidates[0]) return body.candidates[0].content.parts[0].text;
        lastError=JSON.stringify(body);
        if(code!==429&&code!==500&&code!==502&&code!==503&&code!==504) break;
        Utilities.sleep(CONFIG.retryDelayMs*attempt);
      }catch(e){lastError=String(e);Utilities.sleep(CONFIG.retryDelayMs*attempt);}
    }
  }
  throw new Error('Gemini unavailable after retries/fallbacks. Last response: '+lastError);
}

function buildReport(data,ai){return ai+'\n\nKPI SNAPSHOT\n'+JSON.stringify(data.summary,null,2);}
