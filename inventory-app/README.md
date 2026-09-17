# تطبيق الجرد — Inventory Audit App

هيكلية المشروع (المرحلة 1 + المرحلة 2):

```
inventory-app/
├── backend/     # Node.js + Express + Prisma + PostgreSQL API
│   └── README.md  ← تفاصيل الإعداد والنشر على سيرفر Oracle Cloud
├── web/         # لوحة تحكم الأدمن — React + Vite + Tailwind
│   └── README.md
├── mobile/      # React Native (Expo) — تطبيق الموظف للمسح والجرد
│   └── README.md  ← يشمل إعداد إشعارات FCM
└── docs/
    └── BUILD_PROMPT.md  ← برومبت شامل قابل للاستخدام مع أي وكيل ذكاء صناعي
```

## أين تجد كل جزء من الفكرة في الكود

| الميزة المطلوبة | مكانها |
|---|---|
| حساب الشركة + الأدمن | `backend/src/routes/auth.routes.ts` |
| إضافة الموظفين والصلاحيات | `backend/src/routes/users.routes.ts` |
| المستودعات والمواقع | `backend/src/routes/warehouses.routes.ts` |
| الأصناف + الوحدات (صندوق×24) | `backend/src/routes/items.routes.ts`, نموذج `ItemUnit` |
| استيراد CSV/Excel | `POST /items/import/csv` في نفس الملف |
| إسناد مهمة الجرد | `backend/src/routes/audit-tasks.routes.ts` |
| الجرد الأعمى (Blind Count) | حقل `blindCount` على `AuditTask`، يُطبَّق في `AuditScanScreen.tsx` |
| تسجيل الحركات (Append-Only) | `backend/src/routes/audit-records.routes.ts` + نموذج `AuditRecord` |
| المزامنة بعد العودة للاتصال | `POST /audit-records/sync` + `mobile/src/services/offlineQueue.ts` |
| مادة غير مسجلة → طابور اعتماد | `PendingItem` + `POST /audit-records/pending-items` |
| الفوارق وإعادة العد | `backend/src/utils/variance.ts` |
| التقرير النهائي + تصدير CSV | `backend/src/routes/reports.routes.ts` |
| شاشة المسح + آخر 5 حركات + أزرار +/- | `mobile/src/screens/AuditScanScreen.tsx` |

## ما لم يُبنَ بعد (بحسب أولوياتك)

- Batch/Lot/Expiry — مؤجل عمداً
- الإشعارات الفعلية عند إسناد مهمة (يحتاج ربط Firebase Cloud Messaging)
- تكامل برنامج المحاسبة بشكل مباشر (التصدير الحالي هو CSV، جاهز كنقطة انطلاق)
- لوحة تحكم الويب (Web Dashboard) — الموجود حالياً هو الـ API فقط

## ما تمت إضافته في هذه الجولة

- `web/` — **لوحة تحكم الأدمن كاملة**: تسجيل دخول، لوحة قيادة بإحصائيات لحظية، إسناد مهام الجرد بكل خياراتها (جرد أعمى، تجميع/تسلسل، نسب إعادة العد)، توليد التقرير النهائي وتنزيله CSV، إدارة الأصناف (استيراد CSV + استيراد مباشر من قاعدة بيانات خارجية)، إدارة المستودعات والمواقع، إدارة الموظفين وصلاحياتهم، ومراجعة/اعتماد المواد غير المسجلة.
- **الإشعارات الفعلية (FCM)**: تسجيل توكن الجهاز من الموبايل (`POST /users/me/fcm-token`)، إشعار فوري للموظف عند إسناد مهمة جديدة له، وإشعار فوري لكل أدمن في الشركة عند تجاوز فرق الجرد نسبة إعادة العد.
- `docs/BUILD_PROMPT.md` — برومبت شامل ومنظم يغطي كل ما اتفقنا عليه، جاهز للاستخدام مع أي وكيل ذكاء صناعي لإكمال أو إعادة بناء المشروع.

## ما لم يُبنَ بعد

- Batch/Lot/Expiry — مؤجل عمداً
- تكامل برنامج المحاسبة بشكل مباشر (التصدير الحالي هو CSV)
- تعدد اللغات والوضع الداكن في لوحة تحكم الويب
- إعداد iOS الكامل للإشعارات (يحتاج مفتاح APNs في Firebase؛ Android/FCM جاهز)

## الخطوة التالية المقترحة

1. تشغيل الباك-إند محلياً (`backend/README.md`)، ثم تشغيل لوحة الويب (`web/README.md`) وربطها به.
2. إعداد مشروع Firebase وربط الإشعارات فعلياً (`mobile/README.md`).
3. نشر الثلاثة (API + قاعدة البيانات + لوحة الويب) على سيرفر Oracle Cloud لديك خلف نفس إعداد Cloudflare Tunnel المستخدم مع [[amrodev-server]].
