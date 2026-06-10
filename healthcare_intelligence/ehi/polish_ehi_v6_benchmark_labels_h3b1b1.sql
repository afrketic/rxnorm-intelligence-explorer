UPDATE ehi_v6_enterprise_percentiles_v1
SET overall_benchmark_label =
    'Top ' ||
    CASE
        WHEN overall_top_share_pct < 0.01 THEN ROUND(overall_top_share_pct, 4)
        WHEN overall_top_share_pct < 1 THEN ROUND(overall_top_share_pct, 2)
        ELSE ROUND(overall_top_share_pct, 1)
    END ||
    '% of evaluated medications';

DROP TABLE IF EXISTS ehi_v6_disease_benchmarks_executive_v1;

CREATE TABLE ehi_v6_disease_benchmarks_executive_v1 AS
SELECT *
FROM ehi_v6_disease_benchmarks_v1
WHERE LOWER(disease_name) NOT LIKE '%hypersensitivity%'
  AND LOWER(disease_name) NOT LIKE '%adverse%'
  AND LOWER(disease_name) NOT LIKE '%poisoning%'
  AND LOWER(disease_name) NOT LIKE '%toxicity%'
  AND LOWER(disease_name) NOT LIKE '%neoplasm%'
  AND LOWER(disease_name) NOT LIKE '%carcinoma%'
  AND LOWER(disease_name) NOT LIKE '%endocrine neoplasia%';