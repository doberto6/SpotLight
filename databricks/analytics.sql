-- Upload actions.csv as main.spotlight.actions first.
SELECT location_id,
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
FROM main.spotlight.actions
GROUP BY location_id
ORDER BY failed / total DESC;
