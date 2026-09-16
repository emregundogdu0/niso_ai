# NISO AI Web UI Test Uygulama Raporu

- Test zamani: 2026-09-16T08:09:25.672Z
- Biten zaman: 2026-09-16T08:09:30.680Z
- Hedef URL: http://127.0.0.1:3002
- Sonuc: 23 PASS / 0 FAIL / 4 SKIP

## Sonuclar

| ID | Alan | Test | Durum | Detay |
|---|---|---|---|---|
| ST-001 | Smoke | Ana sayfa 200 ve ana UI bileşenleri | PASS | HTTP 200 |
| ST-STATIC-/style.css | Smoke | Statik asset yükleniyor: /style.css | PASS | HTTP 200 |
| ST-STATIC-/app.js | Smoke | Statik asset yükleniyor: /app.js | PASS | HTTP 200 |
| ST-STATIC-/mesh-drift-shader.js | Smoke | Statik asset yükleniyor: /mesh-drift-shader.js | PASS | HTTP 200 |
| ST-STATIC-/NISO-logo.png | Smoke | Statik asset yükleniyor: /NISO-logo.png | PASS | HTTP 200 |
| ST-STATIC-/ELDOR-logo.png | Smoke | Statik asset yükleniyor: /ELDOR-logo.png | PASS | HTTP 200 |
| UI-001 | UI | Desktop/mobil ana yapılar ve responsive CSS | PASS | mobile menu, sidebar toggle ve media query kontrol edildi |
| A11Y-001 | Accessibility | Temel aria-label/aria-live kontrolleri | PASS | Statik HTML üzerinde kontrol edildi |
| LANG-STATIC | Language | TR/EN/IT dil butonları mevcut | PASS |  |
| ROUTER-001 | Router | Son/en son mail sorguları LATEST_MAIL kalıyor | PASS |  |
| ROUTER-002 | Router | Bugün mail sorgusu tarihli sorguya gider | PASS |  |
| CHAT-002 | Chat/API | Normal küçük sohbet mesajı | PASS | HTTP 200, status=SUCCESS, intent=HELP |
| MAIL-001 | Chat/API | Son gelen mail tarihi ve içeriği | PASS | HTTP 200, status=SUCCESS, intent=PROJECT_MAIL |
| MAIL-002 | Chat/API | En son ne maili geldi varyasyonu | PASS | HTTP 200, status=SUCCESS, intent=PROJECT_MAIL |
| SEC-001 | Chat/API | XSS metni script olarak çalıştırılmadan reddedilir/escape edilir | PASS | HTTP 200, status=SUCCESS, intent=GENERAL_CHAT |
| SEC-002 | Chat/API | SQL injection / destructive prompt engellenir | PASS | HTTP 200, status=SECURITY_REJECTED, intent=SECURITY_REJECTED |
| CHAT-INVALID-001 | Chat/API | 4000 karakter üstü mesaj 400 INVALID_INPUT döner | PASS | HTTP 400, status=ERROR, intent=INVALID_INPUT |
| ATT-002 | Attendance | Çalışan listesi yükleme | PASS | HTTP 200, count=60 |
| ATT-003 | Attendance | Tarihe göre puantaj listeleme | PASS | HTTP 200, records=60 |
| ATT-VALIDATION-001 | Attendance | Eksik puantaj POST validasyon hatası | PASS | HTTP 400, message=Tarih (day) ve Sicil No (employee_no) zorunludur. |
| ATT-004/005/006 | Attendance | Puantaj kayıt yazma ve hesaplama testleri | SKIP | Canlı veriyi değiştirmemek için otomatik uygulanmadı; kontrollü test verisi/onay gerektirir. |
| DOC-001/DOC-006 | Documents | Doküman listeleme API | PASS | HTTP 200, count=3 |
| DOC-VALIDATION-001 | Documents | Dosya içeriği olmayan upload reddedilir | PASS | HTTP 400, message=Dosya içeriği (fileData base64) bulunamadı. |
| API-007 | Documents | Doküman silme ID eksik validasyonu | PASS | HTTP 400, message=Doküman ID (id) gereklidir. |
| DOC-002/005/007 | Documents | Gerçek dosya yükleme, OCR indeksleme ve silme | SKIP | Canlı dosya/veri değişikliği yaptığı için otomatik uygulanmadı; test dosyası ve silme onayı gerektirir. |
| HIST-001/002/003 | History | Sohbet geçmişi localStorage restore/clear | SKIP | Tarayıcı otomasyonu olmadan localStorage UI akışı manuel doğrulama gerektirir. |
| INFO-001 | Info Modal | Sistem bilgisi modal aç/kapat | SKIP | Tarayıcı otomasyonu olmadan click akışı manuel doğrulama gerektirir; statik modal markup kontrol edildi. |

## Notlar

- SKIP olan testler canlı veriyi değiştiren veya tarayıcı click/localStorage otomasyonu gerektiren akışlardır.
- Mail regresyonu özel olarak doğrulandı: "son gelen mail ne zaman geldi" ve "en son ne maili geldi" sorguları artık en son maili döndürüyor.
- Güvenlik testleri canlı API üzerinden destructive SQL/prompt denemesiyle uygulanmıştır; veritabanı yazma/silme komutu çalıştırılmamıştır.
- Custom TTS entegrasyonu eklendi: `/api/tts` endpoint'i ElevenLabs API key + voice ID bulunduğunda doğal MP3 yanıt üretir, aksi halde hızlıca browser fallback'e döner.
- Referans ses dosyası `ui/voice/nazli-reference.mp3` olarak saklandı ve `/voice/nazli-reference.mp3` üzerinden servis ediliyor.
