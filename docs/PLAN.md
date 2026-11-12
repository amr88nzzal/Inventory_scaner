# خطة التطوير — Development Plan

سجل مؤرَّخ لكل تغيير: ماذا ولماذا. (Dated log of every change: what and why.)

| التاريخ | التغيير | السبب |
|---|---|---|
| 2026-11-12 | حذف `inventory-app/web/` (نسخة الواجهة القديمة) وإبقاء `src/` كنسخة وحيدة؛ إنشاء هذا السجل | النسختان كانتا متباعدتين (مثلاً `Tasks.tsx` يختلف في ~1700 سطر) ولا شيء في البناء أو Docker أو `tsconfig` يستعمل القديمة، فوجودها يربك أي تعديل. `inventory-app/backend` يبقى لأن `server.ts` يستورده، و`inventory-app/mobile` يبقى لأنه تطبيق الموظف. |

## مؤجَّل بقرار (لم يُنفَّذ بعد)

- مخطط Prisma مكرر ومختلف: `prisma/schema.prisma` (الذي يستعمله Docker) و`inventory-app/backend/prisma/schema.prisma`. يحتاج قراراً بأيهما المرجع قبل أي تغيير.
- لا اختبارات ولا CI بعد (`verify` و`integration` و`a11y` و`docker`).
- `src/pages/Tasks.tsx` (1851 سطراً) يحتاج تقسيماً.
