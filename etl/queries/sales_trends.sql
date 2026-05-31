-- Daily Sales Trends & Session Lag Aggregations (Combined Schema)
WITH daily_sales AS (
    SELECT
        CAST(f.event_time AS TIMESTAMP) as event_timestamp,
        COUNT(CASE WHEN f.event_type = 'view' THEN 1 END) as view_count,
        COUNT(CASE WHEN f.event_type = 'cart' THEN 1 END) as cart_count,
        COUNT(CASE WHEN f.event_type = 'purchase' THEN 1 END) as purchase_count,
        SUM(CASE WHEN f.event_type = 'purchase' THEN p.price ELSE 0 END) as daily_revenue
    FROM fact_events f
    LEFT JOIN dim_products p
      ON f.product_id = p.product_id
     AND f.event_time >= p.valid_from
     AND f.event_time < p.valid_to
    GROUP BY 1
),
daily_ordered AS (
    SELECT
        CAST(event_timestamp AS DATE) as event_date,
        SUM(view_count) as view_count,
        SUM(cart_count) as cart_count,
        SUM(purchase_count) as purchase_count,
        SUM(daily_revenue) as daily_revenue
    FROM daily_sales
    GROUP BY 1
    ORDER BY 1
),
daily_cumulative AS (
    SELECT
        event_date,
        view_count,
        cart_count,
        purchase_count,
        daily_revenue,
        SUM(daily_revenue) OVER (ORDER BY event_date) as cumulative_revenue,
        (purchase_count::DOUBLE / NULLIF(view_count, 0)) as conversion_rate
    FROM daily_ordered
),
session_times AS (
    SELECT
        user_session,
        MIN(CASE WHEN event_type = 'view' THEN event_time END) as first_view,
        MIN(CASE WHEN event_type = 'purchase' THEN event_time END) as first_purchase
    FROM fact_events
    GROUP BY 1
    HAVING first_view IS NOT NULL AND first_purchase IS NOT NULL
),
session_lags AS (
    SELECT
        user_session,
        epoch(CAST(first_purchase AS TIMESTAMP)) - epoch(CAST(first_view AS TIMESTAMP)) as lag_seconds
    FROM session_times
    WHERE epoch(CAST(first_purchase AS TIMESTAMP)) >= epoch(CAST(first_view AS TIMESTAMP))
),
lag_buckets AS (
    SELECT
        CASE 
            WHEN lag_seconds <= 300 THEN '0-5m'
            WHEN lag_seconds <= 900 THEN '5-15m'
            WHEN lag_seconds <= 1800 THEN '15-30m'
            WHEN lag_seconds <= 3600 THEN '30m-1h'
            ELSE '1h+'
        END as lag_bucket,
        COUNT(*) as lag_count,
        AVG(lag_seconds) as mean_lag,
        MEDIAN(lag_seconds) as median_lag
    FROM session_lags
    GROUP BY 1
),
daily_rows AS (
    SELECT
        'daily_sales' as metric_type,
        event_date,
        view_count,
        cart_count,
        purchase_count,
        daily_revenue,
        cumulative_revenue,
        conversion_rate,
        NULL as lag_bucket,
        NULL as lag_count,
        NULL as mean_lag,
        NULL as median_lag
    FROM daily_cumulative
),
lag_rows AS (
    SELECT
        'lag_distribution' as metric_type,
        NULL as event_date,
        NULL as view_count,
        NULL as cart_count,
        NULL as purchase_count,
        NULL as daily_revenue,
        NULL as cumulative_revenue,
        NULL as conversion_rate,
        lag_bucket,
        lag_count,
        mean_lag,
        median_lag
    FROM lag_buckets
)
SELECT * FROM daily_rows
UNION ALL
SELECT * FROM lag_rows
