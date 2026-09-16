# NISO AI Web UI Detayli Test Plani

## 1. Test Amaci

Bu test planinin amaci, NISO AI Yonetim Asistani web arayuzunun kullanici deneyimi, fonksiyonel akislari, API entegrasyonlari, veri dogrulugu, hata yonetimi, guvenlik ve responsive davranislarini uc uca dogrulamaktir.

Uygulama kapsaminda test edilecek ana moduller:

- Ana sohbet arayuzu
- Cok dilli arayuz: TR, EN, IT
- Sohbet gecmisi ve localStorage kaliciligi
- Puantaj / giris-cikis yonetimi
- Dokuman yukleme ve OCR bilgi bankasi
- Sistem bilgisi modal penceresi
- Backend API davranislari
- Mobil ve masaustu ekran uyumlulugu
- Hata, bos veri ve entegrasyon kopuklugu durumlari

## 2. Test Ortami

- Uygulama URL: `http://127.0.0.1:3001`
- Frontend: Vanilla HTML, CSS, JavaScript
- Backend: Node.js HTTP server
- LLM: Yerel Ollama
- Veritabani: PostgreSQL + pgvector
- Yardimci servisler: n8n, Docker containerlari
- Tarayicilar: Chrome, Edge, Firefox
- Ekran boyutlari:
  - Desktop: 1920x1080, 1366x768
  - Tablet: 768x1024
  - Mobil: 390x844, 360x800

## 3. On Kosullar

- `start.ps1` veya `node ui/server.js` ile Web UI calisir durumda olmali.
- `http://127.0.0.1:3001` adresi `200 OK` donmeli.
- Puantaj testleri icin PostgreSQL containeri calisir olmali.
- Sohbet testleri icin Ollama servisi calisir olmali.
- Dokuman testleri icin dosya okuma/OCR pipeline'i calisir olmali.
- Test sonunda localStorage temizlenebilmeli.

## 4. Smoke Testler

### ST-001 Ana Sayfa Acilis Kontrolu

Adimlar:

1. Tarayicida `http://127.0.0.1:3001` acilir.
2. Sayfanin yuklenmesi beklenir.
3. NISO ve ELDOR logolarinin gorundugu kontrol edilir.
4. Ana karsilama mesaji kontrol edilir.
5. Mesaj giris alani ve gonder butonu kontrol edilir.

Beklenen sonuc:

- Sayfa hatasiz yuklenir.
- Konsolda kritik JavaScript hatasi gorulmez.
- Ana sohbet inputu kullanilabilir durumdadir.

### ST-002 Statik Dosya Kontrolu

Adimlar:

1. Ana sayfa acilir.
2. CSS stillerinin uygulandigi kontrol edilir.
3. `app.js` davranislarinin calistigi kontrol edilir.
4. Arka plan canvas efektinin sayfayi bozmadigi kontrol edilir.

Beklenen sonuc:

- Arayuz bozuk veya stylesiz gorunmez.
- Butonlar tiklanabilir durumdadir.

## 5. Ana Sohbet Testleri

### CHAT-001 Bos Mesaj Gonderimi

Adimlar:

1. Ana mesaj kutusu bos birakilir.
2. Gonder butonuna basilir.

Beklenen sonuc:

- Bos mesaj API'ye gonderilmez.
- Sohbet ekraninda bos kullanici mesaji olusmaz.
- Uygulama hata vermez.

### CHAT-002 Normal Mesaj Gonderimi

Test verisi:

`Merhaba, bana yardimci olabilir misin?`

Adimlar:

1. Mesaj kutusuna test verisi yazilir.
2. Gonder butonuna basilir.
3. Kullanici mesajinin sohbet akisine eklendigi kontrol edilir.
4. Yukleme durumunun gorundugu kontrol edilir.
5. Asistan cevabinin geldigi kontrol edilir.

Beklenen sonuc:

- Hero ekran sohbet akisi ekranina donusur.
- Kullanici mesaji dogru metinle gorunur.
- Asistan cevabi gorunur.
- Alt mesaj kutusu aktif hale gelir.

### CHAT-003 Enter ve Shift+Enter Davranisi

Adimlar:

1. Mesaj kutusuna tek satir mesaj yazilir.
2. `Enter` tusuna basilir.
3. Yeni mesaj kutusunda `Shift+Enter` ile yeni satir denenir.

Beklenen sonuc:

- `Enter` mesaj gonderir.
- `Shift+Enter` yeni satir ekler.
- Input yuksekligi otomatik buyur.

### CHAT-004 Oneri Kartlari

Adimlar:

1. Ana ekrandaki onerilerden biri tiklanir.
2. Secilen metnin mesaj olarak gonderildigi kontrol edilir.

Beklenen sonuc:

- Tiklanan kartin sorgusu sohbet akisini baslatir.
- Yanlis veya bos sorgu gonderilmez.

### CHAT-005 Cevap Kopyalama

Adimlar:

1. Asistan cevabi geldikten sonra `Kopyala` butonuna tiklanir.
2. Buton etiketinin gecici olarak `Kopyalandi` oldugu kontrol edilir.

Beklenen sonuc:

- Cevap panoya kopyalanir.
- UI kullaniciya basarili geri bildirim verir.

### CHAT-006 Servis Kapali Hata Davranisi

On kosul:

- Ollama servisi durdurulur veya cevap vermez hale getirilir.

Adimlar:

1. Sohbetten mesaj gonderilir.
2. Hata cevabi beklenir.

Beklenen sonuc:

- Uygulama kilitlenmez.
- Kullaniciya anlasilir hata mesaji gosterilir.
- Gonder butonu tekrar aktif olur.

## 6. Dil Secimi Testleri

### LANG-001 TR Varsayilan Dil

Adimlar:

1. localStorage temizlenir.
2. Sayfa yenilenir.

Beklenen sonuc:

- Arayuz Turkce acilir.
- TR butonu aktif gorunur.

### LANG-002 EN Dil Degisimi

Adimlar:

1. EN butonuna tiklanir.
2. Navigasyon, placeholder, footer, modal basliklari kontrol edilir.
3. Sayfa yenilenir.

Beklenen sonuc:

- Arayuz Ingilizce metinlere gecer.
- Dil secimi localStorage uzerinden kalici olur.

### LANG-003 IT Dil Degisimi

Adimlar:

1. IT butonuna tiklanir.
2. Ana metinler ve buton tooltipleri kontrol edilir.

Beklenen sonuc:

- Italyanca metinler gorunur.
- Daha once secili dil butonundan aktif class'i kalkar.

## 7. Sidebar ve Navigasyon Testleri

### NAV-001 Sidebar Genisletme/Daraltma

Adimlar:

1. Sidebar toggle butonuna tiklanir.
2. Sidebar'in genisledigi kontrol edilir.
3. Tekrar tiklanir.

Beklenen sonuc:

- Sidebar sorunsuz genisler/daralir.
- `aria-expanded` degeri dogru guncellenir.
- Secim localStorage ile korunur.

### NAV-002 Yeni Sohbet

Adimlar:

1. Bir sohbet baslatilir.
2. `Yeni Sohbet` butonuna basilir.

Beklenen sonuc:

- Mevcut sohbet temizlenir.
- Yeni session id olusur.
- Hero ekran geri gelir.

### NAV-003 Mobil Menu

Adimlar:

1. Mobil ekran boyutuna gecilir.
2. Menu butonuna tiklanir.

Beklenen sonuc:

- Sidebar mobilde acilir/kapanir.
- Icerik uzerine bozuk bindirme yapmaz.

## 8. Sohbet Gecmisi Testleri

### HIST-001 Sohbet Kaydi

Adimlar:

1. Bir mesaj gonderilir ve cevap alinir.
2. Sidebar genisletilir.
3. Sohbet gecmisi kontrol edilir.

Beklenen sonuc:

- Sohbet gecmise eklenir.
- Ilk kullanici mesaji baslik olarak gorunur.
- Mesaj sayisi dogru gorunur.

### HIST-002 Gecmisten Sohbet Geri Yukleme

Adimlar:

1. Gecmisteki bir oturum tiklanir.

Beklenen sonuc:

- Secili oturumun kullanici ve asistan mesajlari geri yuklenir.
- Session id eski oturumla eslesir.

### HIST-003 Gecmisi Temizleme

Adimlar:

1. Gecmis modalini ac.
2. `Gecmisi Temizle` butonuna bas.

Beklenen sonuc:

- localStorage icindeki `niso_chat_history` silinir.
- Gecmis listesi bos durum mesaji gosterir.

## 9. Puantaj Testleri

### ATT-001 Puantaj Ekranina Gecis

Adimlar:

1. Sidebar'dan `Giris Saatleri` tiklanir.

Beklenen sonuc:

- Sohbet ekrani gizlenir.
- Puantaj ekrani gorunur.
- Tarih, istatistik kartlari, form ve tablo gorunur.

### ATT-002 Calisan Listesi Yukleme

Adimlar:

1. Puantaj ekrani acilir.
2. Calisan secim listesinin doldugu kontrol edilir.

Beklenen sonuc:

- `/api/attendance/employees` basarili doner.
- Calisan listesi bos degilse select icinde gorunur.

### ATT-003 Tarihe Gore Kayit Listeleme

Adimlar:

1. Tarih secilir.
2. Yenile butonuna basilir.

Beklenen sonuc:

- `/api/attendance?day=YYYY-MM-DD` cagrilir.
- Tablo secilen tarihe gore guncellenir.
- Istatistik kartlari toplamlarla uyumludur.

### ATT-004 Gec Kalma Hesaplama

Test verisi:

- Mesai baslangici: 08:30
- Tolerans: 15 dk
- Giris: 08:50
- Cikis: 17:30
- Durum: AUTO

Beklenen sonuc:

- Kayit `LATE` olarak hesaplanir.
- Gec kalma dakikasi 5 dakika olarak islenir.

### ATT-005 Zamaninda Giris Hesaplama

Test verisi:

- Giris: 08:40
- Durum: AUTO

Beklenen sonuc:

- Kayit `ON_TIME` olur.
- Gec kalma dakikasi 0 olur.

### ATT-006 Izinli / Uzaktan / Gelmedi Durumlari

Adimlar:

1. Durum seciminden `ON_LEAVE`, `REMOTE`, `ABSENT` ayri ayri kaydedilir.
2. Her kayittan sonra tablo kontrol edilir.

Beklenen sonuc:

- Ilgili durum dogru kaydedilir.
- Gerekli olmayan saat alanlari zorunlu hale gelmez.
- Exception/note bilgisi korunur.

### ATT-007 Filtreleme ve Arama

Adimlar:

1. Personel arama alanina isim veya sicil yazilir.
2. Departman filtresi secilir.
3. Durum filtresi secilir.

Beklenen sonuc:

- Tablo filtrelere gore anlik guncellenir.
- Eslesen kayit yoksa bos durum mesaji gorunur.

## 10. Dokuman / OCR Testleri

### DOC-001 Dokuman Ekranina Gecis

Adimlar:

1. `Dokuman yukle` navigasyonuna tiklanir.

Beklenen sonuc:

- Dokuman yukleme ekrani gorunur.
- Yukleme alani, kategori, proje secimi ve tablo gorunur.

### DOC-002 Gecerli PDF Secimi

Adimlar:

1. `Gozat` butonuna tiklanir.
2. Gecerli PDF secilir.

Beklenen sonuc:

- Dosya adi ve boyutu gorunur.
- `Isle ve Indeksle` butonu aktif olur.

### DOC-003 Desteklenmeyen Dosya Tipi

Test verisi:

- `.exe`, `.zip` veya `.mp4`

Beklenen sonuc:

- Dosya kabul edilmemeli veya isleme alinmamali.
- Kullaniciya anlasilir hata gosterilmeli.

### DOC-004 25 MB Uzeri Dosya

Adimlar:

1. 25 MB uzeri bir dosya secilir.

Beklenen sonuc:

- Dosya reddedilir.
- Buton aktif kalmaz.
- Hata mesaji boyut limitini belirtir.

### DOC-005 Yukleme ve Indeksleme

Adimlar:

1. Gecerli PDF secilir.
2. Kategori secilir.
3. Opsiyonel proje secilir.
4. `Isle ve Indeksle` tiklanir.

Beklenen sonuc:

- Progress bar ilerler.
- `/api/documents/upload` basarili doner.
- Dokuman tabloya eklenir.
- Dosya secimi temizlenir.

### DOC-006 Dokuman Arama

Adimlar:

1. Dokuman tablosunda arama alanina dosya adi veya kategori yazilir.

Beklenen sonuc:

- Tablo sadece eslesen belgeleri gosterir.
- Eslesme yoksa bos durum mesaji gorunur.

### DOC-007 Dokuman Silme

Adimlar:

1. Bir dokuman satirindaki sil butonuna basilir.
2. Silme islemi onaylanir.

Beklenen sonuc:

- `/api/documents/delete?id=...` basarili doner.
- Dokuman tablodan kalkar.
- Ilgili vektor/veri kalintilari temizlenir.

## 11. Sistem Bilgisi Modal Testleri

### INFO-001 Modal Acma Kapama

Adimlar:

1. Ayarlar/sistem bilgisi butonuna tiklanir.
2. Modal icindeki model, embedding, DB, Gmail, Outlook, gizlilik ve session id alanlari kontrol edilir.
3. Kapat butonuna basilir.

Beklenen sonuc:

- Modal acilir ve kapanir.
- Session id bos veya `...` olarak kalmaz.
- Dis alana tiklayinca modal kapanir.

## 12. API Testleri

### API-001 Ana Sayfa

Istek:

`GET /`

Beklenen sonuc:

- HTTP 200
- HTML icerik doner.

### API-002 Chat

Istek:

`POST /api/chat`

Payload:

```json
{
  "message": "Bugun kimler gec kaldi?",
  "language": "tr",
  "session_id": "test_session_001"
}
```

Beklenen sonuc:

- `status` alani doner.
- `answer` veya esdeger cevap metni doner.
- Intent bilgisi mantikli olur.
- Hata durumunda JSON format bozulmaz.

### API-003 Puantaj Calisanlari

Istek:

`GET /api/attendance/employees`

Beklenen sonuc:

- `status: OK`
- `employees` array doner.

### API-004 Puantaj Kayit Listeleme

Istek:

`GET /api/attendance?day=2026-09-08`

Beklenen sonuc:

- `stats` ve `records` alanlari doner.
- Kayit yoksa bos array doner, hata firlatilmaz.

### API-005 Puantaj Kayit Ekleme

Istek:

`POST /api/attendance`

Payload:

```json
{
  "day": "2026-09-08",
  "employee_no": "EMP001",
  "first_in": "08:50",
  "last_out": "17:30",
  "status": "AUTO",
  "note": "Test kaydi"
}
```

Beklenen sonuc:

- `status: OK`
- Hesaplanan durum ve gec kalma bilgisi doner.

### API-006 Dokuman Listeleme

Istek:

`GET /api/documents`

Beklenen sonuc:

- `status: OK`
- `documents` array doner.

### API-007 Dokuman Silme ID Eksik

Istek:

`DELETE /api/documents/delete`

Beklenen sonuc:

- `status: ERROR`
- Mesajda dokuman ID'nin gerekli oldugu belirtilir.

## 13. Guvenlik Testleri

### SEC-001 XSS Denemesi

Test verisi:

`<script>alert('xss')</script>`

Adimlar:

1. Sohbet inputuna test verisi yazilir.
2. Mesaj gonderilir.

Beklenen sonuc:

- Script calismaz.
- Mesaj metin olarak escape edilmis sekilde gorunur.

### SEC-002 SQL Injection Denemesi

Test verisi:

`Bugun kim geldi?'; DROP TABLE attendance.employee; --`

Beklenen sonuc:

- Zararli istek engellenir veya guvenli sekilde yanitlanir.
- Veritabani yapisi zarar gormez.
- Kullaniciya guvenli hata/ret mesaji doner.

### SEC-003 Dosya Adi Manipulasyonu

Test verisi:

`../../malicious.pdf`

Beklenen sonuc:

- Path traversal olusmaz.
- Dosya guvenli isimlendirilir veya reddedilir.

## 14. Responsive ve UI Testleri

### UI-001 Desktop Yerlesim

Beklenen sonuc:

- Sidebar, hero alan, top bar ve footer cakisma yapmaz.
- Metinler butonlardan tasmaz.

### UI-002 Mobil Yerlesim

Beklenen sonuc:

- Input alanlari ekran disina tasmaz.
- Sidebar mobilde kullanilabilir.
- Puantaj tablosu yatay kaydirilabilir veya okunabilir kalir.

### UI-003 Uzun Cevap Davranisi

Adimlar:

1. Uzun cevap ureten bir soru sorulur.

Beklenen sonuc:

- Sohbet akisi kaydirilabilir.
- Footer/input cevap uzerine binmez.
- Kaynak kartlari gorunur kalir.

## 15. Kabul Kriterleri

Uygulama testten gecmis sayilir, eger:

- Smoke testlerin tamami basariliysa.
- Ana sohbet akisi kritik hata vermiyorsa.
- Dil degisimi ve localStorage kaliciligi calisiyorsa.
- Puantaj listeleme, kaydetme ve filtreleme calisiyorsa.
- Dokuman yukleme/silme/listeleme akislari kontrollu calisiyorsa.
- Kritik XSS ve SQL injection denemelerinde zararli kod calismiyorsa.
- Mobil ve desktop ekranlarda ana islevler kullanilabilir durumdaysa.
- API hata cevaplari JSON formatini bozmuyorsa.

## 16. Test Sonu Temizlik

- Test amacli puantaj kayitlari temizlenir.
- Test dokumanlari silinir.
- localStorage temizlenir.
- Gerekirse servisler `stop.ps1` ile durdurulur.

