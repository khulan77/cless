-- PROMPT 10: storefront-ийн текстийг богино, тайван болгоно (BR-ийн өнгө аяс).
-- ЗӨВХӨН seed-ийн анхны утгатай ЯГ тэнцүү JSON string-ийг солино ("…" бүтнээр) — админы засварласан текстэд хүрэхгүй.

UPDATE "SiteSetting" SET "value" = (replace(replace("value"::text, '"Салон дээр арьсны оношлогоо — утсаар цаг аваарай"', '"Салон дээр арьсны оношлогоо"'), '"Гоо сайханчийн зөвлөгөөтэйгөөр арчилгаагаа сонгоорой"', '"Арчилгаагаа гоо сайханчтайгаа сонгоорой"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'announcement' AND ("value"::text LIKE '%"Салон дээр арьсны оношлогоо — утсаар цаг аваарай"%' OR "value"::text LIKE '%"Гоо сайханчийн зөвлөгөөтэйгөөр арчилгаагаа сонгоорой"%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютер — СПА салон ба онлайн дэлгүүр."', '"Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютор. Салон ба арчилгааны бүтээгдэхүүн."'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'brand' AND ("value"::text LIKE '%"Biologique Recherche-ийн Монгол дахь албан ёсны дистрибьютер — СПА салон ба онлайн дэлгүүр."%');

UPDATE "SiteSetting" SET "value" = (replace(replace(replace("value"::text, '"Арьс бүр өвөрмөц"', '"Арьс бүр өөр"'), '"Арчилгаа ч мөн адил"', '"арчилгаа ч өөр"'), '"Дэлгүүр үзэх"', '"Сонголтыг үзэх"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'hero' AND ("value"::text LIKE '%"Арьс бүр өвөрмөц"%' OR "value"::text LIKE '%"Арчилгаа ч мөн адил"%' OR "value"::text LIKE '%"Дэлгүүр үзэх"%');

UPDATE "SiteSetting" SET "value" = (replace(replace(replace(replace(replace("value"::text, '"Арьсны тэнцвэрийг сэргээх брэндийн хамгийн алдартай лосьон."', '"Арьсны тэнцвэрийг сэргээх лосьон."'), '"Арьсны асуудал бүрт зориулсан өндөр идэвхт серумууд."', '"Арьсны хэрэгцээ бүрт тохирсон серум."'), '"Серум үзэх"', '"Үзэх"'), '"Хайртай хүмүүстээ зориулсан тусгай хайрцагтай бэлэг."', '"Хайртай хүмүүстээ — арчилгааны багц."'), '"Бэлэг сонгох"', '"Сонголтыг үзэх"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'promoTrio' AND ("value"::text LIKE '%"Арьсны тэнцвэрийг сэргээх брэндийн хамгийн алдартай лосьон."%' OR "value"::text LIKE '%"Арьсны асуудал бүрт зориулсан өндөр идэвхт серумууд."%' OR "value"::text LIKE '%"Серум үзэх"%' OR "value"::text LIKE '%"Хайртай хүмүүстээ зориулсан тусгай хайрцагтай бэлэг."%' OR "value"::text LIKE '%"Бэлэг сонгох"%');

UPDATE "SiteSetting" SET "value" = (replace(replace("value"::text, '"Хүйтэн, хуурай агаарт арьсаа хамгаалах чийгшүүлэх протокол. Тоо хэмжээ хязгаартай."', '"Хүйтэн, хуурай улиралд зориулсан чийгшүүлэх арчилгаа."'), '"Багц үзэх"', '"Үзэх"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'splitPromo' AND ("value"::text LIKE '%"Хүйтэн, хуурай агаарт арьсаа хамгаалах чийгшүүлэх протокол. Тоо хэмжээ хязгаартай."%' OR "value"::text LIKE '%"Багц үзэх"%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Иконик бүтээгдэхүүн"', '"Сонгодог бүтээгдэхүүн"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'iconicCarousel' AND ("value"::text LIKE '%"Иконик бүтээгдэхүүн"%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Улаанбаатарын төвд байрлах манай салонд брэндийн протоколоор мэргэшсэн гоо сайханчид үйлчилнэ."', '"Брэндийн эмчилгээнд мэргэшсэн гоо сайханчид."'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'salonBanner' AND ("value"::text LIKE '%"Улаанбаатарын төвд байрлах манай салонд брэндийн протоколоор мэргэшсэн гоо сайханчид үйлчилнэ."%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Арьсны асуудлаар сонгох"', '"Арьсны хэрэгцээгээр"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'concernGrid' AND ("value"::text LIKE '%"Арьсны асуудлаар сонгох"%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Ангиллаар сонгох"', '"Ангиллаар"'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'categoryGrid' AND ("value"::text LIKE '%"Ангиллаар сонгох"%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Арьсны оношлогооноос эхлэн бүрэн протокол хүртэл."', '"Оношлогооноос бүрэн эмчилгээ хүртэл."'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'servicesBanner' AND ("value"::text LIKE '%"Арьсны оношлогооноос эхлэн бүрэн протокол хүртэл."%');

UPDATE "SiteSetting" SET "value" = (replace("value"::text, '"Шинэ бүтээгдэхүүн, урамшууллын мэдээг имэйлээр аваарай."', '"Шинэ бүтээгдэхүүн, салоны мэдээ."'))::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'footer' AND ("value"::text LIKE '%"Шинэ бүтээгдэхүүн, урамшууллын мэдээг имэйлээр аваарай."%');

-- Каталог: давуу зэргийн үг (зөвхөн seed-ийн утга хэвээр бол)
UPDATE "Collection" SET "intro" = 'Арьсны тэнцвэрийг сэргээх хальслагч лосьонууд.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'lotion-p50' AND "intro" = 'Брэндийн хамгийн алдартай, арьсны тэнцвэрийг сэргээх хальслагч лосьонууд.';
UPDATE "Product" SET "description" = replace("description", 'Брэндийн хамгийн алдартай лосьон нь', 'Энэхүү лосьон нь'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'lotion-p50' AND "description" LIKE 'Брэндийн хамгийн алдартай лосьон нь%';

-- Нэр томьёо: салоны процедур = "эмчилгээ"
UPDATE "Service" SET "name" = 'Пигментацийн эмчилгээ', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'pigmentation-protocol-75' AND "name" = 'Пигментацийн протокол';
