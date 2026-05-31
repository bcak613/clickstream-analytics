-- Weekly Cohort Purchase-Based Retention Aggregations
WITH user_first_purchase AS (
    SELECT
        user_id,
        DATE_TRUNC('week', CAST(MIN(event_time) AS TIMESTAMP)) as cohort_week
    FROM fact_events
    WHERE event_type = 'purchase'
    GROUP BY user_id
),
user_purchases_by_week AS (
    SELECT DISTINCT
        user_id,
        DATE_TRUNC('week', CAST(event_time AS TIMESTAMP)) as purchase_week
    FROM fact_events
    WHERE event_type = 'purchase'
),
cohort_users AS (
    SELECT
        uf.cohort_week,
        up.purchase_week,
        date_diff('week', uf.cohort_week, up.purchase_week) as weeks_since_acquisition,
        uf.user_id
    FROM user_first_purchase uf
    JOIN user_purchases_by_week up ON uf.user_id = up.user_id
),
cohort_sizes AS (
    SELECT
        cohort_week,
        COUNT(DISTINCT user_id) as cohort_size
    FROM user_first_purchase
    GROUP BY cohort_week
),
retention_counts AS (
    SELECT
        cohort_week,
        weeks_since_acquisition,
        COUNT(DISTINCT user_id) as retained_users
    FROM cohort_users
    GROUP BY cohort_week, weeks_since_acquisition
)
SELECT
    r.cohort_week,
    s.cohort_size,
    r.weeks_since_acquisition,
    r.retained_users,
    (r.retained_users::DOUBLE / s.cohort_size) as retention_rate
FROM retention_counts r
JOIN cohort_sizes s ON r.cohort_week = s.cohort_week
ORDER BY r.cohort_week, r.weeks_since_acquisition
