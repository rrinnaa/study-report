# 🚀 Production Deploy MinIO

## Варианты деплоя

### 🏆 Вариант 1: Свой сервер (VPS) - Рекомендуется

**Преимущества:**
- ✅ Полный контроль
- ✅ Низкая стоимость
- ✅ Нет лимитов
- ✅ Ваши данные на вашем сервере

**Стоимость:** ~$5-20/месяц за VPS

#### Пошаговая инструкция:

**1. Арендуйте VPS сервер**

Рекомендуемые провайдеры:
- **DigitalOcean** - от $6/мес (простой, русский интерфейс)
- **Hetzner** - от €4.5/мес (дешево, надежно)
- **Linode** - от $5/мес
- **Vultr** - от $5/мес

Минимальные требования:
- CPU: 2 ядра
- RAM: 2GB
- Storage: 20GB SSD + дополнительное для данных
- OS: Ubuntu 22.04 LTS

**2. Подключитесь к серверу**

```bash
ssh root@your-server-ip
```

**3. Установите Docker**

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
apt install docker-compose-plugin -y

# Проверка
docker --version
docker compose version
```

**4. Создайте .env файл на сервере**

```bash
mkdir -p /opt/minio
cd /opt/minio
nano .env
```

Добавьте (⚠️ **используйте свои безопасные пароли!**):

```env
# MinIO Admin креденшалы (ИЗМЕНИТЕ!)
MINIO_ADMIN_USER=your_secure_username
MINIO_ADMIN_PASS=your_very_secure_password_min_32_chars
```

**5. Создайте docker-compose.yml**

```bash
nano docker-compose.yml
```

```yaml
version: '3.8'

services:
  minio:
    image: quay.io/minio/minio:latest
    container_name: production-minio
    command: server /data --console-address ":9001"
    ports:
      - "127.0.0.1:9000:9000"  # Только localhost
      - "127.0.0.1:9001:9001"  # Только localhost
    environment:
      MINIO_ROOT_USER: ${MINIO_ADMIN_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ADMIN_PASS}
    volumes:
      - /var/minio/data:/data
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**6. Запустите MinIO**

```bash
docker compose up -d
docker ps
```

**7. Настройте Nginx с HTTPS**

```bash
# Установите Nginx
apt install nginx certbot python3-certbot-nginx -y

# Создайте конфиг
nano /etc/nginx/sites-available/minio
```

```nginx
server {
    listen 80;
    server_name minio.yourdomain.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name minio.yourdomain.com;
    
    # SSL сертификаты (будут созданы certbot)
    ssl_certificate /etc/letsencrypt/live/minio.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio.yourdomain.com/privkey.pem;
    
    # API endpoint
    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        client_max_body_size 100M;
        proxy_read_timeout 300s;
    }
    
    # Console endpoint
    location /console/ {
        proxy_pass http://127.0.0.1:9001/;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Активируйте конфиг
ln -s /etc/nginx/sites-available/minio /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Получите SSL сертификат
certbot --nginx -d minio.yourdomain.com
```

**8. Обновите .env в вашем приложении**

```env
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_ACCESS_KEY=ваш_admin_user
MINIO_SECRET_KEY=ваш_admin_pass
MINIO_BUCKET_NAME=analysis-results
MINIO_SECURE=True
```

---

### 🌥️ Вариант 2: Облачное S3 хранилище

Не нужен свой сервер - используете готовое решение.

#### **DigitalOcean Spaces** (самый простой)

**Стоимость:** $5/мес за 250GB + $0.01/GB сверх того

**Инструкция:**

```bash
# 1. Зарегистрируйтесь на DigitalOcean.com
# 2. Создайте Space:
#    Dashboard → Spaces → Create Space
#    - Регион: Frankfurt/Amsterdam (ближе к Европе)
#    - Название: analysis-results
#    - CDN: включите (опционально)

# 3. Создайте API ключи:
#    Settings → API → Spaces Keys → Generate New Key
#    Сохраните Access Key и Secret Key

# 4. Обновите .env:
MINIO_ENDPOINT=fra1.digitaloceanspaces.com  # Ваш регион
MINIO_ACCESS_KEY=ваш_spaces_access_key
MINIO_SECRET_KEY=ваш_spaces_secret_key
MINIO_BUCKET_NAME=analysis-results
MINIO_SECURE=True
```

#### **Cloudflare R2** (самый дешевый)

**Стоимость:** $0.015/GB/мес + **БЕСПЛАТНЫЙ трафик!**

```bash
# 1. Зарегистрируйтесь на Cloudflare.com
# 2. Перейдите в R2:
#    Dashboard → R2 Object Storage → Create bucket
#    Название: analysis-results

# 3. Создайте API токен:
#    R2 → Manage R2 API Tokens → Create API Token
#    Права: Object Read & Write

# 4. Обновите .env:
MINIO_ENDPOINT=<account-id>.r2.cloudflarestorage.com
MINIO_ACCESS_KEY=ваш_r2_access_key
MINIO_SECRET_KEY=ваш_r2_secret_key
MINIO_BUCKET_NAME=analysis-results
MINIO_SECURE=True
```

#### **AWS S3** (стандартный вариант)

**Стоимость:** ~$0.023/GB/мес + $0.09/GB за трафик

```bash
# 1. Зарегистрируйтесь на aws.amazon.com
# 2. Создайте bucket: S3 → Create bucket
# 3. Создайте IAM пользователя с правами S3
# 4. Получите Access Key

# .env:
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_ACCESS_KEY=ваш_aws_access_key
MINIO_SECRET_KEY=ваш_aws_secret_key
MINIO_BUCKET_NAME=analysis-results
MINIO_SECURE=True
```

---

## 📊 Сравнение вариантов

| Провайдер | Стоимость/мес | Регистрация | Сложность | Трафик |
|-----------|---------------|-------------|-----------|--------|
| **Свой VPS** | $5-20 | Нужна | Средняя | Безлимит |
| **DO Spaces** | $5 (250GB) | Нужна | Низкая | $0.01/GB |
| **Cloudflare R2** | ~$1-5 | Нужна | Низкая | **Бесплатно!** |
| **AWS S3** | ~$2-10 | Нужна | Средняя | $0.09/GB |

---

## 🎯 Моя рекомендация

### Для вас (начинающий проект):

**Вариант A: Свой VPS (Hetzner)**
- Стоимость: €4.5/мес
- Полный контроль
- Никаких лимитов
- Просто настроить

**Вариант B: Cloudflare R2**
- Стоимость: ~$1/мес
- Бесплатный трафик (важно!)
- Не нужно управлять сервером
- Очень быстро настроить

---

## ✅ Следующие шаги для вас

**Сейчас (локальная разработка):**
1. ✅ MinIO запущен локально (`minioadmin/minioadmin`)
2. ⏳ Установить Python библиотеку
3. ⏳ Применить миграцию БД
4. ⏳ Протестировать

**Потом (когда готовы к production):**
1. Выберите вариант (VPS или облако)
2. Следуйте инструкции выше
3. Обновите .env с production настройками
4. Задеплойте!

---

## ❓ FAQ

**Q: Нужна ли регистрация в MinIO.io?**  
A: Нет! MinIO - это open-source софт. Вы разворачиваете свой сервер.

**Q: А если хочу облако без своего сервера?**  
A: Используйте DigitalOcean Spaces, Cloudflare R2 или AWS S3.

**Q: Какой вариант дешевле?**  
A: Cloudflare R2 (бесплатный трафик) или свой VPS на Hetzner.

**Q: Какой проще?**  
A: DigitalOcean Spaces или Cloudflare R2 - просто создаете bucket и получаете ключи.

**Q: Какой надежнее?**  
A: AWS S3 (99.999999999% durability), но дороже.

---

**Давайте сначала доделаем локальную версию, а production обсудим потом!** 

Готовы перейти к Шагу 2 (установка Python библиотеки)? 🚀
