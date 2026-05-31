-- Overview KPI Global Aggregation
WITH purchase_rev AS (
    SELECT 
        SUM(p.price) as total_revenue,
        COUNT(*) as purchase_count,
        COUNT(DISTINCT f.user_session) as purchase_sessions
    FROM fact_events f
    JOIN dim_products p 
      ON f.product_id = p.product_id 
     AND f.event_time >= p.valid_from 
     AND f.event_time < p.valid_to
    WHERE f.event_type = 'purchase'
),
counts AS (
    SELECT
        COUNT(DISTINCT user_id) as total_users,
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'view' THEN 1 END) as view_count,
        COUNT(CASE WHEN event_type = 'cart' THEN 1 END) as cart_count
    FROM fact_events
)
SELECT
    c.total_users,
    c.total_events,
    c.view_count,
    c.cart_count,
    r.total_revenue,
    r.purchase_count,
    r.purchase_sessions,
    (r.total_revenue / r.purchase_sessions) as avg_order_value,
    (r.purchase_count::DOUBLE / c.view_count) as conversion_rate
FROM counts c, purchase_rev r
