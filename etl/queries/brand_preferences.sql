-- Brand Market Preference Aggregations
SELECT
    p.brand,
    COUNT(CASE WHEN f.event_type = 'view' THEN 1 END) as view_count,
    COUNT(CASE WHEN f.event_type = 'cart' THEN 1 END) as cart_count,
    COUNT(CASE WHEN f.event_type = 'purchase' THEN 1 END) as purchase_count,
    SUM(CASE WHEN f.event_type = 'purchase' THEN p.price ELSE 0 END) as total_revenue,
    AVG(CASE WHEN f.event_type = 'purchase' THEN p.price END) as avg_price,
    (COUNT(CASE WHEN f.event_type = 'purchase' THEN 1 END)::DOUBLE / NULLIF(COUNT(CASE WHEN f.event_type = 'view' THEN 1 END), 0)) as conversion_rate
FROM fact_events f
JOIN dim_products p
  ON f.product_id = p.product_id
 AND f.event_time >= p.valid_from
 AND f.event_time < p.valid_to
GROUP BY p.brand
ORDER BY total_revenue DESC
