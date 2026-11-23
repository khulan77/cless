-- PROMPT 11: footer — BR-ийн бүтэц (Дэлгүүр · Салон ба үйлчилгээ · CLÉSS-ийн тухай · Мэдээлэл авах).
-- ЗӨВХӨН seed-ийн анхны утгатай ЯГ тэнцүү JSON хэсгийг солино — админы засварласан баганад хүрэхгүй.
-- Нууцлалын бодлого footer-ийн доод (хууль эрх зүйн) мөрөнд шилжсэн тул "Компани" баганаас Холбоо барих болно.

UPDATE "SiteSetting" SET "value" = (replace(replace("value"::text,
    '{"links": [{"href": "/services", "label": "Салоны үйлчилгээ"}, {"href": "/services", "label": "Арьсны оношлогоо"}], "title": "Үйлчилгээ"}',
    '{"links": [{"href": "/services", "label": "Салоны үйлчилгээ"}, {"href": "/services", "label": "Арьсны оношлогоо"}], "title": "Салон ба үйлчилгээ"}'),
    '{"links": [{"href": "/about", "label": "Бидний тухай"}, {"href": "/privacy", "label": "Нууцлалын бодлого"}], "title": "Компани"}',
    '{"links": [{"href": "/about", "label": "Бидний тухай"}, {"href": "/contact", "label": "Холбоо барих"}], "title": "CLÉSS-ийн тухай"}'))::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer'
  AND ("value"::text LIKE '%{"links": [{"href": "/services", "label": "Салоны үйлчилгээ"}, {"href": "/services", "label": "Арьсны оношлогоо"}], "title": "Үйлчилгээ"}%'
    OR "value"::text LIKE '%{"links": [{"href": "/about", "label": "Бидний тухай"}, {"href": "/privacy", "label": "Нууцлалын бодлого"}], "title": "Компани"}%');
