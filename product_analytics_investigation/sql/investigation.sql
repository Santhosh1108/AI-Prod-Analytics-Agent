-- Product Analytics Investigation
-- Scenario: activation declined after an onboarding change on 2026-08-15.
-- SQLite-compatible SQL. Run against data/users.csv and data/events.csv
-- after importing them as users and events tables.

-- 1. Overall activation before vs after the change
WITH milestones AS (
  SELECT
    u.user_id,
    CASE WHEN u.signup_date < '2026-08-15' THEN 'Before' ELSE 'After' END AS period,
    MAX(CASE WHEN e.event_name = 'core_action' THEN 1 ELSE 0 END) AS activated
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  GROUP BY u.user_id, period
)
SELECT period,
       COUNT(*) AS users,
       ROUND(100.0 * SUM(activated) / COUNT(*), 2) AS activation_rate_pct
FROM milestones
GROUP BY period
ORDER BY period;

-- 2. Funnel conversion
WITH user_steps AS (
  SELECT
    u.user_id,
    MAX(CASE WHEN e.event_name = 'onboarding_started' THEN 1 ELSE 0 END) AS onboarding_started,
    MAX(CASE WHEN e.event_name = 'onboarding_step_1_completed' THEN 1 ELSE 0 END) AS step_1,
    MAX(CASE WHEN e.event_name = 'onboarding_step_2_completed' THEN 1 ELSE 0 END) AS step_2,
    MAX(CASE WHEN e.event_name = 'onboarding_step_3_completed' THEN 1 ELSE 0 END) AS step_3,
    MAX(CASE WHEN e.event_name = 'core_action' THEN 1 ELSE 0 END) AS core_action
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  GROUP BY u.user_id
)
SELECT
  COUNT(*) AS signups,
  SUM(onboarding_started) AS onboarding_started,
  SUM(step_1) AS step_1,
  SUM(step_2) AS step_2,
  SUM(step_3) AS step_3,
  SUM(core_action) AS core_action
FROM user_steps;

-- 3. Segment diagnosis: platform before vs after
WITH activation AS (
  SELECT
    u.user_id,
    u.platform,
    CASE WHEN u.signup_date < '2026-08-15' THEN 'Before' ELSE 'After' END AS period,
    MAX(CASE WHEN e.event_name = 'core_action' THEN 1 ELSE 0 END) AS activated,
    MAX(CASE WHEN e.event_name = 'onboarding_step_3_completed' THEN 1 ELSE 0 END) AS step_3
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  GROUP BY u.user_id, u.platform, period
)
SELECT period, platform,
       COUNT(*) AS users,
       ROUND(100.0 * AVG(step_3), 2) AS step_3_completion_pct,
       ROUND(100.0 * AVG(activated), 2) AS activation_rate_pct
FROM activation
GROUP BY period, platform
ORDER BY period, platform;

-- 4. Acquisition channel check
WITH activation AS (
  SELECT
    u.user_id,
    u.acquisition_channel,
    CASE WHEN u.signup_date < '2026-08-15' THEN 'Before' ELSE 'After' END AS period,
    MAX(CASE WHEN e.event_name = 'core_action' THEN 1 ELSE 0 END) AS activated
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  GROUP BY u.user_id, u.acquisition_channel, period
)
SELECT period, acquisition_channel,
       COUNT(*) AS users,
       ROUND(100.0 * AVG(activated), 2) AS activation_rate_pct
FROM activation
GROUP BY period, acquisition_channel
ORDER BY period, activation_rate_pct DESC;

-- 5. Retention by activation status
WITH activation AS (
  SELECT
    u.user_id,
    MAX(CASE WHEN e.event_name = 'core_action' THEN 1 ELSE 0 END) AS activated,
    MAX(CASE WHEN e.event_name = 'retained_day_7' THEN 1 ELSE 0 END) AS retained_7d
  FROM users u
  LEFT JOIN events e ON u.user_id = e.user_id
  GROUP BY u.user_id
)
SELECT activated,
       COUNT(*) AS users,
       ROUND(100.0 * AVG(retained_7d), 2) AS retention_7d_pct
FROM activation
GROUP BY activated;
