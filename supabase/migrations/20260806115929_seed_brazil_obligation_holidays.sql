-- Fixed Brazilian national holidays used by the obligation business-day engine.
-- State, municipal and movable dates remain organization-specific records.
WITH years AS (
  SELECT generate_series(2026, 2035) AS year_number
), fixed_holidays(month_number, day_number, holiday_name) AS (
  VALUES
    (1, 1, 'Confraternizacao Universal'),
    (4, 21, 'Tiradentes'),
    (5, 1, 'Dia Mundial do Trabalho'),
    (9, 7, 'Independencia do Brasil'),
    (10, 12, 'Nossa Senhora Aparecida'),
    (11, 2, 'Finados'),
    (11, 15, 'Proclamacao da Republica'),
    (11, 20, 'Dia Nacional de Zumbi e da Consciencia Negra'),
    (12, 25, 'Natal')
)
INSERT INTO public.obligation_business_holidays (organization_id,holiday_date,name,scope)
SELECT NULL,make_date(years.year_number,fixed_holidays.month_number,fixed_holidays.day_number),fixed_holidays.holiday_name,'national'
FROM years CROSS JOIN fixed_holidays
ON CONFLICT (organization_id,holiday_date,name) DO NOTHING;
