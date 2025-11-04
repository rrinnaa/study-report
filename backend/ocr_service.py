import logging
from io import BytesIO
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger("ocr")

class OCRService:
    def __init__(self):
        self.supported_languages = ['rus', 'eng']
    
    def recognize_text(self, image_bytes: bytes) -> str: 
        try:
            return self._tesseract_ocr(image_bytes) 
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return ""
    
    def _tesseract_ocr(self, image_bytes: bytes) -> str:
        """Tesseract OCR с улучшением качества изображения"""
        try:
            image = Image.open(BytesIO(image_bytes))
            
            processed_image = self._enhance_image(image)
            
            custom_config = r'--oem 3 --psm 6 -l rus+eng'
            
            text = pytesseract.image_to_string(processed_image, config=custom_config)
            
            logger.info(f"Tesseract recognized {len(text)} characters")
            return text.strip()
            
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
            return ""
    
    def _enhance_image(self, image: Image.Image) -> Image.Image:
        """Улучшает качество изображения для лучшего распознавания"""
        try:
            if image.mode != 'L':
                image = image.convert('L')
            
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(2.0) 
            
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(2.0)
            
            image = image.filter(ImageFilter.MedianFilter(1))
            
            return image
            
        except Exception as e:
            logger.warning(f"Image enhancement failed, using original: {e}")
            return image

ocr_service = OCRService()