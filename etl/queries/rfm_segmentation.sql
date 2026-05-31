-- RFM Segment Customer Aggregations
WITH user_metrics AS (
    SELECT
        f.user_id,
        DATEDIFF('day', CAST(MAX(f.event_time) AS TIMESTAMP), (SELECT MAX(CAST(event_time AS TIMESTAMP)) FROM fact_events WHERE event_type = 'purchase')) as recency_days,
        COUNT(*) as purchase_count,
        SUM(p.price) as total_spend
    FROM fact_events f
    JOIN dim_products p
      ON f.product_id = p.product_id
     AND f.event_time >= p.valid_from
     AND f.event_time < p.valid_to
    WHERE f.event_type = 'purchase'
    GROUP BY f.user_id
),
rfm_scores AS (
    SELECT
        user_id,
        recency_days,
        purchase_count,
        total_spend,
        ntile(5) OVER (ORDER BY recency_days DESC) as r,
        ntile(5) OVER (ORDER BY purchase_count ASC) as f,
        ntile(5) OVER (ORDER BY total_spend ASC) as m
    FROM user_metrics
),
user_segments AS (
    SELECT
        user_id,
        recency_days,
        purchase_count,
        total_spend,
        r, f, m,
        CASE
            WHEN r >= 4 AND f >= 4 AND m >= 4 THEN 'Champions'
            WHEN r >= 3 AND f >= 3 AND m >= 3 THEN 'Loyal'
            WHEN r >= 4 AND f >= 1 AND m >= 2 THEN 'Potential Loyalist'
            WHEN r = 5 AND f = 1 THEN 'New Customers'
            WHEN r = 4 AND f = 1 THEN 'Promising'
            WHEN r = 3 AND f <= 2 THEN 'About to Sleep'
            WHEN r <= 2 AND f >= 3 AND m >= 3 THEN 'At Risk'
            WHEN r <= 2 AND f >= 4 AND m = 5 THEN 'Cant Lose Them'
            WHEN r = 2 AND f <= 2 THEN 'Hibernating'
            WHEN r = 1 AND f <= 1 THEN 'Lost'
            ELSE 'Needs Attention'
        END as segment
    FROM rfm_scores
)
SELECT
    segment,
    COUNT(*) as user_count,
    AVG(recency_days) as avg_recency,
    AVG(purchase_count) as avg_frequency,
    AVG(total_spend) as avg_monetary,
    SUM(total_spend) as segment_revenue
FROM user_segments
GROUP BY segment
ORDER BY user_count DESC
