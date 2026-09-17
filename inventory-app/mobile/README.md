# تطبيق الموبايل — Inventory Audit Mobile

React Native (Expo). يتصل بنفس الـ backend المستخدم من لوحة تحكم الويب.

## الإشعارات (FCM)
1. أنشئ مشروع Firebase وفعّل Cloud Messaging.
2. حمّل `google-services.json` من إعدادات تطبيق Android في Firebase وضعه في
   جذر مجلد `mobile/` (المسار مُشار إليه بالفعل في `app.json`).
3. على السيرفر (backend)، ضع محتوى ملف Service Account (JSON) في متغير البيئة
   `FIREBASE_SERVICE_ACCOUNT_JSON`.
4. عند تسجيل دخول الموظف، يسجّل التطبيق تلقائياً توكن الجهاز عبر
   `POST /users/me/fcm-token` (انظر `src/services/pushNotifications.ts`).
5. عند إسناد مهمة جديدة أو عند تجاوز الفرق نسبة إعادة العد، يرسل الباك-إند
   إشعاراً فورياً تلقائياً — لا حاجة لأي كود إضافي على الموبايل.

## التشغيل
```bash
npm install
npx expo start
```

## غير مطبق بعد
- إعداد iOS الكامل للإشعارات (APNs key في Firebase) — الكود جاهز لكنه يحتاج
  إعداد حساب مطوّر Apple.
- نغمات صوتية مخصصة للمسح الناجح/الفاشل (يوجد تعليق بمكان الربط في
  `AuditScanScreen.tsx`).
