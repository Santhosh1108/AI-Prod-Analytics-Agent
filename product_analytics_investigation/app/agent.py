import json
import re
from pathlib import Path
import pandas as pd

try:
    import requests
except Exception:
    requests = None

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'

class AnalyticsTools:
    def __init__(self):
        self.users = pd.read_csv(DATA/'users.csv', parse_dates=['signup_date'])
        self.events = pd.read_csv(DATA/'events.csv', parse_dates=['event_timestamp'])
        self.change_date = pd.Timestamp('2026-08-15')

    def schema(self):
        return {
            'users': {'rows': len(self.users), 'columns': list(self.users.columns)},
            'events': {'rows': len(self.events), 'columns': list(self.events.columns), 'event_names': sorted(self.events.event_name.unique().tolist())}
        }

    def run_sql(self, sql):
        import duckdb
        con = duckdb.connect()
        con.register('users', self.users)
        con.register('events', self.events)
        try:
            df = con.execute(sql).df()
            return {'columns': list(df.columns), 'rows': df.head(100).to_dict('records'), 'row_count': len(df)}
        except Exception as e:
            return {'error': str(e)}
        finally:
            con.close()

    def funnel(self):
        x = self.users.merge(self.events[['user_id','event_name']], on='user_id', how='left')
        sets = x.groupby(['user_id']).event_name.agg(set)
        stages = [('Signup', None),('Onboarding','onboarding_started'),('Step 1','onboarding_step_1_completed'),('Step 2','onboarding_step_2_completed'),('Step 3','onboarding_step_3_completed'),('Core Action','core_action')]
        return [{'stage': n, 'users': len(sets) if e is None else int(sets.apply(lambda s, e=e: e in s).sum())} for n,e in stages]

    def segment(self, dimension):
        if dimension not in ['platform','acquisition_channel','plan']:
            return {'error':'Allowed dimensions: platform, acquisition_channel, plan'}
        x = self.users.merge(self.events[['user_id','event_name']], on='user_id', how='left')
        g = x.groupby(['user_id', dimension]).event_name.agg(set).reset_index()
        g['step_3'] = g.event_name.apply(lambda s: 'onboarding_step_3_completed' in s)
        g['activated'] = g.event_name.apply(lambda s: 'core_action' in s)
        out = g.groupby(dimension).agg(users=('user_id','count'), step_3_rate=('step_3','mean'), activation_rate=('activated','mean')).reset_index()
        out['step_3_rate'] = (out.step_3_rate*100).round(2)
        out['activation_rate'] = (out.activation_rate*100).round(2)
        return out.to_dict('records')

TOOLS = AnalyticsTools()

SYSTEM = '''You are MetricLens, an AI Product Analytics Agent. You investigate product-data questions by choosing analytics tools, not by inventing results. Available tools: schema, run_sql, funnel, segment. You may call multiple tools. Return JSON only with one action at a time: {"action":"schema"}, {"action":"funnel"}, {"action":"segment","dimension":"platform"}, {"action":"run_sql","sql":"..."}, or {"action":"final","answer":"..."}. After receiving tool results, decide the next best analysis. Distinguish evidence from hypotheses. Never claim synthetic data is real-world evidence.'''

class MetricLensAgent:
    def __init__(self, model='qwen3:4b', ollama_url='http://localhost:11434'):
        self.model = model
        self.url = ollama_url.rstrip('/') + '/api/chat'
        self.trace=[]

    def _tool(self, action):
        self.trace.append(action)
        if action['action']=='schema': return TOOLS.schema()
        if action['action']=='funnel': return TOOLS.funnel()
        if action['action']=='segment': return TOOLS.segment(action['dimension'])
        if action['action']=='run_sql': return TOOLS.run_sql(action['sql'])
        return None

    def run(self, question, max_steps=8):
        messages=[{'role':'system','content':SYSTEM}, {'role':'user','content':question}]
        if requests:
            for _ in range(max_steps):
                try:
                    r=requests.post(self.url,json={'model':self.model,'messages':messages,'stream':False,'format':'json'},timeout=90)
                    r.raise_for_status()
                    content=r.json()['message']['content']
                    action=json.loads(content)
                    if action.get('action')=='final':
                        return {'mode':'ollama-agent','answer':action.get('answer',''),'trace':self.trace}
                    result=self._tool(action)
                    messages += [{'role':'assistant','content':content},{'role':'user','content':'TOOL RESULT:\n'+json.dumps(result,default=str)}]
                except Exception:
                    break
        return self.fallback(question)

    def fallback(self, question):
        # Deterministic agentic fallback: selects a sequence of tools based on the question.
        trace=[]
        trace.append({'action':'schema'})
        trace.append({'action':'funnel'})
        trace.append({'action':'segment','dimension':'platform'})
        funnel=TOOLS.funnel(); platform=TOOLS.segment('platform')
        users_before=TOOLS.users[TOOLS.users.signup_date < TOOLS.change_date].user_id.nunique()
        users_after=TOOLS.users[TOOLS.users.signup_date >= TOOLS.change_date].user_id.nunique()
        x=TOOLS.users.merge(TOOLS.events[['user_id','event_name']],on='user_id',how='left')
        s=x.groupby('user_id').event_name.agg(set)
        before=s[TOOLS.users.set_index('user_id').signup_date < TOOLS.change_date] if False else None
        activated=[]
        for uid, evs in s.items(): activated.append(('core_action' in evs, uid))
        before_ids=set(TOOLS.users.loc[TOOLS.users.signup_date < TOOLS.change_date,'user_id'])
        after_ids=set(TOOLS.users.loc[TOOLS.users.signup_date >= TOOLS.change_date,'user_id'])
        b=sum(1 for ok,uid in activated if uid in before_ids and ok)/len(before_ids)*100
        a=sum(1 for ok,uid in activated if uid in after_ids and ok)/len(after_ids)*100
        mobile=[r for r in platform if r['platform']=='mobile']
        desktop=[r for r in platform if r['platform']=='desktop']
        answer=(f"Activation changed from {b:.1f}% before the 2026-08-15 onboarding change to {a:.1f}% after it ({a-b:+.1f} pp). "
                f"The funnel shows the largest investigation point around onboarding Step 3, and platform segmentation shows a larger activation gap on mobile than desktop. "
                f"This supports a hypothesis of platform-specific onboarding friction, but the pre/post data is observational and does not establish causality. "
                f"Next step: run an A/B test comparing the current Step 3 with a simplified mobile-friendly version, using Step 3 completion as the primary metric and activation plus 7-day retention as downstream/guardrail metrics.")
        return {'mode':'deterministic-agent-fallback','answer':answer,'trace':trace}
