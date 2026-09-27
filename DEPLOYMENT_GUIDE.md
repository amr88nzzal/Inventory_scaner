# دليل رفع وتشيغيل التطبيق على سيرفر كود (Cloud Server) باستخدام Docker و GitHub

تم إعداد المشروع بالكامل ليعمل باستخدام **Docker** و **Docker Compose** مدمجاً مع قاعدة بيانات **PostgreSQL** محلية داخل الحاوية تلقائياً.

---

## 📁 الملفات المضافة لإعدادات الدوكر
1. `Dockerfile`: بناء متعدد المراحل (Multi-stage build) لضغط حجم الصورة وبناء واجهة React وتجميع سيرفر Node Express.
2. `docker-compose.yml`: يتضمن خدمة قاعدة البيانات PostgreSQL وخدمة التطبيق الرئيسي مع الربط التلقائي وحفظ البيانات في Volumes.
3. `.dockerignore`: لاستبعاد الملفات المؤقتة و `node_modules` أثناء البناء.
4. `.env.production.example`: نموذج لإعدادات البيئة الخاصة بالسيرفر.

---

## 🚀 خطوات الرفع والتفعيل على الخادم (Server Deployment)

### الخطوة 1: رفع المشروع إلى GitHub
إذا لم تكن قد رفعت الكود إلى مستودع (Repository) على GitHub بعد:
```bash
git init
git add .
git commit -m "إعداد Docker للرفع على السيرفر"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.name.git
git push -u origin main
```

---

### الخطوة 2: الاتصال بالسيرفر وجلب الكود
قم بالاتصال بسيرفرك عبر SSH ثم جلب المستودع:
```bash
ssh user@your-server-ip
git clone https://github.com/USERNAME/REPOSITORY.name.git
cd REPOSITORY.name
```

---

### الخطوة 3: تجهيز ملف متغيرات البيئة (.env)
قم بإنشاء ملف `.env` بناءً على النموذج المرفق:
```bash
cp .env.production.example .env
nano .env
```
قم بتغيير كلمة سر قاعدة البيانات والمفتاح السري لـ JWT:
```env
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=put_a_strong_password_here
POSTGRES_DB=inventory_db
JWT_SECRET=put_a_random_long_secret_key_here
PORT=3000
```

---

### الخطوة 4: تشغيل التطبيق باستخدام Docker Compose
قم بتشغيل الحاويات في الخلفية:
```bash
docker compose up -d --build
```

سيقوم Docker بالآتي تلقائياً:
1. تشغيل حاوية PostgreSQL وإنشاء قاعدة البيانات وحفظ بياناتها بشكل دائم في Volume.
2. بناء تطبيقك (Vite + Express Server).
3. تطبيق الجداول والمخطط (Prisma DB Push).
4. إنشاء حساب المدير الافتراضي (`admin` / `admin123`) تلقائياً عند أول تشغيل إذا كانت قاعدة البيانات فارغة.
5. تشغيل سيرفر التطبيق على المنفذ `3000`.

---

### 🔍 التأكد من عمل التطبيق وفحص السجلات (Logs)
- لعرض حالة الحاويات:
  ```bash
  docker compose ps
  ```
- لمتابعة سجلات التطبيق:
  ```bash
  docker compose logs -f app
  ```
- لفحص رابط الصحة (Health check):
  ```bash
  curl http://localhost:3000/health
  ```

---

### 🌐 إعداد Nginx و SSL (اختياري لتفعيل HTTPS وتوجيه النطاق)
لتوجيه النطاق (Domain) أو IP السيرفر إلى المنفذ 3000 وإضافة شهادة SSL مجانية:

1. تثبيت Nginx و Certbot:
   ```bash
   sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. إنشاء ملف إعداد للـ Domain:
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. إصدار شهادة SSL:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

### 🔑 بيانات الدخول الافتراضية للنظام
- **اسم المستخدم**: `admin`
- **كلمة المرور**: `admin123`
*(تأكد من تغيير كلمة المرور أو إنشاء حسابات جديدة بعد تسجيل الدخول).*
