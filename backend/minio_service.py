import logging
from io import BytesIO
from minio import Minio
from minio.error import S3Error
from .config import MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_SECURE

logger = logging.getLogger("minio_service")


class MinioService:
    def __init__(self):
        self.client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
        self.bucket = MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Создаёт бакет если его нет."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Бакет '{self.bucket}' создан")
            else:
                logger.info(f"Бакет '{self.bucket}' уже существует")
        except S3Error as e:
            logger.error(f"Ошибка при проверке/создании бакета: {e}")
            raise

    def upload_file(self, object_name: str, file_data: bytes, content_type: str = "application/octet-stream") -> str:
        """
        Загружает файл в MinIO.
        Возвращает object_name (путь внутри бакета).
        """
        try:
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=BytesIO(file_data),
                length=len(file_data),
                content_type=content_type,
            )
            logger.info(f"Файл '{object_name}' загружен в MinIO")
            return object_name
        except S3Error as e:
            logger.error(f"Ошибка загрузки файла в MinIO: {e}")
            raise

    def get_presigned_url(self, object_name: str, expires_hours: int = 1) -> str:
        """
        Возвращает временную ссылку для скачивания файла.
        """
        from datetime import timedelta
        try:
            url = self.client.presigned_get_object(
                bucket_name=self.bucket,
                object_name=object_name,
                expires=timedelta(hours=expires_hours),
            )
            return url
        except S3Error as e:
            logger.error(f"Ошибка получения presigned URL: {e}")
            raise

    def delete_file(self, object_name: str):
        """Удаляет файл из MinIO."""
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"Файл '{object_name}' удалён из MinIO")
        except S3Error as e:
            logger.error(f"Ошибка удаления файла из MinIO: {e}")
            raise

    def file_exists(self, object_name: str) -> bool:
        """Проверяет существование файла в MinIO."""
        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error:
            return False


try:
    minio_service = MinioService()
except Exception as e:
    logger.error(f"Не удалось инициализировать MinIO: {e}")
    minio_service = None
