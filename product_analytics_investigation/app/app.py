import streamlit as st
import pandas as pd
import plotly.express as px
from agent import MetricLensAgent

st.set_page_config(page_title="Activation Investigation", layout="wide")
st.title("MetricLens — AI Product Analytics Agent")
st.caption("Ask a product question. The agent selects analytics tools, investigates the data, and produces an evidence-based product diagnosis.")

users = pd.read_csv("data/users.csv", parse_dates=["signup_date"])
events = pd.read_csv("data/events.csv", parse_dates=["event_timestamp"])
change_date = pd.Timestamp("2026-08-15")

x = users.merge(events[["user_id","event_name"]], on="user_id", how="left")
milestones = x.groupby(
    ["user_id","signup_date","platform","acquisition_channel","plan"]
).event_name.agg(lambda s: set(s)).reset_index()

for e, col in [
    ("onboarding_started","onboarding_started"),
    ("onboarding_step_1_completed","step_1"),
    ("onboarding_step_2_completed","step_2"),
    ("onboarding_step_3_completed","step_3"),
    ("core_action","activated"),
    ("retained_day_7","retained_7d"),
    ("subscription_started","paid"),
]:
    milestones[col] = milestones.event_name.apply(lambda s, e=e: int(e in s))

milestones["period"] = milestones.signup_date.apply(
    lambda d: "Before" if d < change_date else "After"
)

before = milestones.loc[milestones.period=="Before","activated"].mean()*100
after = milestones.loc[milestones.period=="After","activated"].mean()*100
delta = after-before

c1,c2,c3 = st.columns(3)
c1.metric("Activation — Before", f"{before:.1f}%")
c2.metric("Activation — After", f"{after:.1f}%")
c3.metric("Change", f"{delta:+.1f} pp")



st.header("Ask the analytics agent")
question = st.text_input("Product question", "Why did activation drop after the onboarding change?")
if st.button("Investigate", type="primary"):
    agent = MetricLensAgent()
    result = agent.run(question)
    st.subheader("Agent diagnosis")
    st.write(result["answer"])
    with st.expander("Agent tool trace"):
        st.json(result["trace"])

st.subheader("Funnel")
funnel = pd.DataFrame({
    "Stage": ["Signup","Onboarding","Step 1","Step 2","Step 3","Core Action"],
    "Users": [
        len(milestones), milestones.onboarding_started.sum(),
        milestones.step_1.sum(), milestones.step_2.sum(),
        milestones.step_3.sum(), milestones.activated.sum()
    ]
})
st.plotly_chart(px.funnel(funnel, y="Stage", x="Users"), use_container_width=True)

st.subheader("Platform diagnosis")
p = milestones.groupby(["period","platform"]).agg(
    users=("user_id","count"),
    step_3=("step_3","mean"),
    activation=("activated","mean")
).reset_index()
p["step_3"]*=100
p["activation"]*=100
st.dataframe(p.style.format({"step_3":"{:.1f}%","activation":"{:.1f}%"}), use_container_width=True)

fig = px.bar(p, x="platform", y="activation", color="period",
             barmode="group", text_auto=".1f",
             title="Activation by platform")
st.plotly_chart(fig, use_container_width=True)

st.subheader("Product decision")
st.info(
    "The investigation is designed to identify where the activation decline is concentrated. "
    "The proposed next step is a controlled onboarding experiment, not a claim that the observed "
    "segment difference is causal."
)
