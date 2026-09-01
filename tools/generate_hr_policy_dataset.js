const fs = require('fs');
const path = require('path');

const effectiveFrom = '2026-01-01';
const sourceTitle = 'Sentetik İK Politikası';
const owner = 'İK Operasyonları Demo Ekibi';

const categories = [
  {
    name: 'Çalışma saatleri ve molalar',
    count: 7,
    section: 'Bölüm 1 - Çalışma Düzeni',
    items: [
      ['Günlük standart çalışma saatleri nedir?', 'Demo politikaya göre standart çalışma saatleri hafta içi 09:00-18:00 arasıdır. Öğle arası 12:30-13:30 arasında bir saat olarak planlanır; bu kayıt sentetik demo veridir.'],
      ['Öğle molası ne zaman kullanılır?', 'Öğle molası demo kural setinde 12:30-13:30 arasında kullanılır ve günlük çalışma süresine dahil edilmez. Bu bilgi sentetik İK politikası örneğidir.'],
      ['Kısa dinlenme molaları nasıl uygulanır?', 'Sentetik demo kurala göre ekipler sabah ve öğleden sonra iş akışını aksatmayacak şekilde en fazla 15 dakikalık kısa mola kullanabilir. Zamanlama ekip lideriyle koordine edilir.'],
      ['Geç kalma durumunda ne yapılmalıdır?', 'Çalışan demo senaryoda gecikmeyi mümkün olan en kısa sürede yöneticisine bildirir ve gerekirse eksik süre aynı hafta içinde telafi planına alınır. Bu kayıt gerçek şirket politikası değildir.'],
      ['Esnek giriş çıkış penceresi var mı?', 'Demo politikada yönetici onayıyla 08:30-09:30 arası giriş ve buna bağlı 17:30-18:30 arası çıkış penceresi uygulanabilir. Ana ekip erişilebilirliği 10:00-16:00 arasında korunur.'],
      ['Yarım gün çalışma nasıl hesaplanır?', 'Sentetik örnekte yarım gün çalışma dört saat fiili çalışma veya onaylı yarım gün izin olarak değerlendirilir. Kayıtlar aynı gün içinde sistemde güncellenir.'],
      ['Mesai çizelgesi ne zaman kapatılır?', 'Demo süreçte haftalık mesai çizelgesi cuma günü 18:30’a kadar çalışan tarafından kontrol edilir ve yönetici onayına sunulur. Bu kayıt sentetik veri olarak işaretlidir.']
    ]
  },
  {
    name: 'Haftalık izin ve resmî tatiller',
    count: 7,
    section: 'Bölüm 2 - Haftalık Dinlenme ve Tatiller',
    items: [
      ['Haftalık çalışma düzeni kaç gündür?', 'Demo politikada düzenli çalışma haftası pazartesiden cumaya beş gündür. Cumartesi ve pazar haftalık dinlenme günü kabul edilir.'],
      ['Resmî tatillerde çalışma yapılır mı?', 'Sentetik demo kurala göre resmî tatillerde çalışma yapılmaması esastır; zorunlu operasyonlarda önceden yönetici ve İK onayı gerekir. Telafi yöntemi ayrıca bildirilir.'],
      ['Haftalık izin günü değiştirilebilir mi?', 'Operasyonel zorunluluk varsa haftalık izin günü aynı hafta içinde yönetici onayıyla değiştirilebilir. Bu uygulama demo veri setindeki örnek kuraldır.'],
      ['Bayram tatili öncesi yarım gün nasıl uygulanır?', 'Demo politikada resmî takvimde yarım gün görünen günler yarım mesai olarak takip edilir. Uzaktan çalışma veya izin kullanımı ayrıca yönetici onayına bağlıdır.'],
      ['Tatil günü yapılan çalışma nasıl kaydedilir?', 'Sentetik örnekte tatil günü çalışması başlamadan önce onaylanır ve çalışma süresi aynı gün mesai sistemine girilir. Onaysız kayıtlar fazla mesaiye dönüştürülmez.'],
      ['Arife günü izin kullanımı nasıl planlanır?', 'Arife günü izin talepleri demo süreçte ekip kapasitesi korunacak şekilde en az üç iş günü önce girilir. Öncelik daha önce izin kullanmamış çalışanlara verilebilir.'],
      ['Hafta sonu eğitimleri izin hakkını etkiler mi?', 'Demo politikada zorunlu hafta sonu eğitimleri çalışma süresi gibi kaydedilir ve uygun telafi süresi planlanır. Gönüllü etkinlikler ayrıca değerlendirilir.']
    ]
  },
  {
    name: 'Yıllık izin',
    count: 7,
    section: 'Bölüm 3 - Yıllık İzin',
    items: [
      ['Yıllık izin hakkı nasıl hesaplanır?', 'Sentetik demo politikada yıllık izin hakkı kıdeme göre 1-5 yıl için 14 gün, 5-15 yıl için 20 gün, 15 yıl üzeri için 26 gün olarak örneklenmiştir. Bu gerçek şirket taahhüdü değildir.'],
      ['Yıllık izin talebi ne kadar önce yapılır?', 'Demo süreçte yıllık izin talepleri planlanan başlangıçtan en az beş iş günü önce sisteme girilir. Acil durumlar ayrıca yönetici ve İK tarafından değerlendirilir.'],
      ['Yıllık izin bölünerek kullanılabilir mi?', 'Sentetik kurala göre yıllık izin, ekip planı uygun olduğunda bölünerek kullanılabilir. En az bir izin bloğunun beş iş günü olması önerilir.'],
      ['Kullanılmayan yıllık izin devreder mi?', 'Demo politikada kullanılmayan yıllık izin bakiyesi bir sonraki yıla devreder ve İK sistemi üzerinde görünür. Planlama sorumluluğu çalışan ve yöneticinin ortak takibindedir.'],
      ['Deneme süresinde yıllık izin kullanılabilir mi?', 'Sentetik örnekte deneme süresindeki izin talepleri istisnai olarak yönetici ve İK onayıyla değerlendirilebilir. Onay olmadan yıllık izin kullanılmış sayılmaz.'],
      ['Yıllık izin iptal edilebilir mi?', 'Demo politikaya göre onaylanmış yıllık izin çalışan talebi ve yönetici onayıyla iptal veya revize edilebilir. Operasyonel değişiklikler çalışana makul süre önceden bildirilir.'],
      ['İzin dönüşü belge gerekir mi?', 'Normal yıllık izin dönüşünde belge gerekmez; ancak demo süreçte izin türü değişirse destekleyici bilgi istenebilir. Tüm kayıtlar sentetik veri seti kapsamındadır.']
    ]
  },
  {
    name: 'Mazeret, evlilik, vefat ve doğum günü izni',
    count: 7,
    section: 'Bölüm 4 - Özel Durum İzinleri',
    items: [
      ['Evlilik izni kaç gündür?', 'Demo politikada evlilik izni üç iş günü olarak örneklenmiştir. Talep, belge veya beyanla birlikte izin sistemine girilir ve bu kayıt sentetik demo veridir.'],
      ['Vefat izni hangi durumlarda kullanılır?', 'Sentetik örnekte birinci derece yakın vefatında üç iş günü ücretli izin tanımlanır. Farklı yakınlık dereceleri İK değerlendirmesine bırakılmıştır.'],
      ['Doğum günü izni var mı?', 'Demo kurala göre çalışan doğum günü haftasında yönetici onayıyla yarım gün izin kullanabilir. İş yoğunluğu nedeniyle aynı hafta içinde alternatif gün seçilebilir.'],
      ['Acil mazeret izni nasıl alınır?', 'Acil mazeret izni demo süreçte çalışan tarafından mümkünse aynı gün yöneticisine bildirilir ve dönüşte sisteme işlenir. Uygun belge talebi İK tarafından değerlendirilebilir.'],
      ['Taşınma izni verilir mi?', 'Sentetik politika örneğinde yılda bir kez taşınma için bir iş günü mazeret izni tanımlanmıştır. İzin tarihi ekip planına göre onaylanır.'],
      ['Resmî kurum işlemleri için izin alınabilir mi?', 'Demo kurala göre zorunlu resmî kurum işlemleri için saatlik mazeret izni talep edilebilir. Çalışan beklenen süreyi ve uygun belgeyi sistemde belirtir.'],
      ['Mazeret izni yıllık izinden düşer mi?', 'Sentetik örnekte onaylı mazeret izinleri yıllık izin bakiyesinden düşülmez. Uygun bulunmayan talepler yıllık izin veya ücretsiz izin olarak yeniden sınıflandırılabilir.']
    ]
  },
  {
    name: 'Doğum, babalık ve süt izni',
    count: 7,
    section: 'Bölüm 5 - Ebeveynlik İzinleri',
    items: [
      ['Doğum izni süreci nasıl başlatılır?', 'Demo politikada doğum izni süreci çalışanın beklenen tarih bilgisini İK’ya iletmesiyle başlar. Uygulama yasal çerçeveye göre ayrıca doğrulanır; bu kayıt sentetiktir.'],
      ['Babalık izni kaç gündür?', 'Sentetik demo kuralda babalık izni beş iş günü olarak örneklenmiştir. İzin, doğum tarihinden itibaren makul süre içinde kullanılacak şekilde planlanır.'],
      ['Süt izni nasıl kullanılır?', 'Demo politikada süt izni çocuğun bir yaşına kadar günde 1,5 saat olarak örneklenmiştir. Kullanım saatleri çalışan ve yönetici tarafından iş akışına göre belirlenir.'],
      ['Ebeveynlik izinlerinde uzaktan çalışma yapılabilir mi?', 'Sentetik örnekte izin döneminde çalışma beklenmez; izin sonrası uyum sürecinde uzaktan çalışma ayrıca değerlendirilebilir. Karar İK ve yönetici onayıyla verilir.'],
      ['Doğum izni dönüşü işe uyum nasıl planlanır?', 'Demo süreçte işe dönüşten önce yönetici, çalışanla görev önceliklerini ve erişilebilirlik planını gözden geçirir. Bu süreç çalışanı desteklemek için tasarlanmış sentetik bir örnektir.'],
      ['Ebeveynlik izni için hangi belgeler gerekir?', 'Sentetik politikada doğum veya babalık izni için temel bildirim ve uygun destekleyici belge talep edilir. Belge kapsamı veri minimizasyonu ilkesiyle sınırlı tutulur.'],
      ['Süt izni toplu kullanılabilir mi?', 'Demo kurala göre süt izninin günlük kullanımı esastır; farklı kullanım talepleri operasyon ve yasal uygunluk açısından İK tarafından ayrıca değerlendirilir.']
    ]
  },
  {
    name: 'Uzaktan/esnek çalışma',
    count: 7,
    section: 'Bölüm 6 - Uzaktan ve Esnek Çalışma',
    items: [
      ['Uzaktan çalışma haftada kaç gün yapılabilir?', 'Demo politikada uygun roller için haftada en fazla iki gün uzaktan çalışma örneklenmiştir. Günler ekip takvimi ve yönetici onayıyla belirlenir.'],
      ['Çekirdek çalışma saatleri nedir?', 'Sentetik kurala göre uzaktan veya esnek çalışan herkes 10:00-16:00 arasında erişilebilir olmalıdır. Standart iş günü 09:00-18:00 düzeniyle uyumlu tutulur.'],
      ['Uzaktan çalışma ekipman sorumluluğu kimdedir?', 'Demo politikada şirket tarafından zimmetlenen ekipman çalışan tarafından özenle korunur. Kişisel cihaz kullanımı bilgi güvenliği onayına bağlıdır.'],
      ['Evden çalışırken toplantı katılımı zorunlu mu?', 'Sentetik örnekte uzaktan çalışanlar planlı ekip toplantılarına zamanında katılır. Kamera kullanımı toplantı amacına ve ekip normlarına göre belirlenir.'],
      ['Esnek çalışma talebi nasıl onaylanır?', 'Demo süreçte esnek çalışma talebi sistemden girilir, yönetici iş planını kontrol eder ve İK kayıt görünürlüğünü sağlar. Sürekli düzenlemeler aylık gözden geçirilir.'],
      ['Uzaktan çalışma yeri değiştirilebilir mi?', 'Sentetik kurala göre çalışan uzaktan çalışma yerini güvenli internet ve gizlilik koşulları sağlanıyorsa bildirimle değiştirebilir. Yurt dışı çalışma ayrıca onay gerektirir.'],
      ['Hibrit günlerde ofise çağrı yapılabilir mi?', 'Demo politikada kritik toplantı veya operasyon ihtiyacı varsa yönetici önceden haber vererek ofis katılımı isteyebilir. Bu istisna makul planlama ile kullanılır.']
    ]
  },
  {
    name: 'Fazla mesai',
    count: 7,
    section: 'Bölüm 7 - Fazla Mesai',
    items: [
      ['Fazla mesai nasıl onaylanır?', 'Demo politikada fazla mesai başlamadan önce yönetici onayı alınır. Onaysız çalışma otomatik olarak fazla mesaiye dönüştürülmez ve bu kayıt sentetik örnektir.'],
      ['Fazla mesai nasıl telafi edilir?', 'Sentetik kurala göre fazla mesai ücret veya serbest zaman telafisi olarak planlanabilir. Tercih ve uygunluk yönetici ile İK tarafından kayıt altına alınır.'],
      ['Fazla mesai oranı nasıl örneklenir?', 'Demo veri setinde fazla mesai karşılığı normal saat katsayısının 1,5 katı olarak örneklenmiştir. Bu bilgi gerçek şirket vaadi değildir.'],
      ['Hafta sonu fazla mesai yapılabilir mi?', 'Demo politikada hafta sonu fazla mesai yalnızca kritik operasyon ihtiyacında ve ön onayla yapılabilir. Süre aynı gün sistemde kaydedilir.'],
      ['Fazla mesai üst sınırı var mı?', 'Sentetik örnekte çalışan sağlığı için aylık fazla mesai planı yönetici tarafından izlenir ve sürdürülebilirlik riski oluşursa azaltılır. Gerekli yasal sınırlar ayrıca dikkate alınır.'],
      ['Fazla mesai talebi reddedilirse ne olur?', 'Demo süreçte reddedilen fazla mesai talebi çalışana gerekçesiyle bildirilir. İş planı yeniden önceliklendirilir veya ek kaynak ihtiyacı değerlendirilir.'],
      ['Uzaktan çalışmada fazla mesai sayılır mı?', 'Sentetik kurala göre uzaktan çalışmada da önceden onaylanan ve kayıt altına alınan süre fazla mesai olarak değerlendirilebilir. Erişilebilir olmak tek başına fazla mesai değildir.']
    ]
  },
  {
    name: 'Maaş, prim ve avans',
    count: 7,
    section: 'Bölüm 8 - Ücret ve Ödemeler',
    items: [
      ['Maaş ödemesi ne zaman yapılır?', 'Demo politikada maaş ödemesi ayın son iş günü yapılır. Banka veya tatil kaynaklı teknik gecikmeler İK ve finans tarafından duyurulur.'],
      ['Prim ödemeleri nasıl belirlenir?', 'Sentetik örnekte primler şirket, ekip ve bireysel hedef gerçekleşmelerine göre dönemsel olarak değerlendirilir. Prim hakkı ve tutarı gerçek şirket politikası olarak yorumlanmamalıdır.'],
      ['Avans talebi nasıl yapılır?', 'Demo süreçte avans talebi çalışan tarafından sistemden girilir ve net aylık ücretin yüzde 30’unu aşmayacak şekilde değerlendirilir. Finans onayı gereklidir.'],
      ['Maaş bordrosu nereden alınır?', 'Sentetik politikada bordro belgeleri güvenli çalışan portalından erişilebilir kabul edilmiştir. Erişim sorunu yaşayan çalışan İK destek kanalına başvurur.'],
      ['Ücret bilgisi kimlerle paylaşılabilir?', 'Demo kuralda ücret bilgisi kişisel ve gizli kabul edilir. Çalışan kendi bilgisini paylaşma hakkına sahip olmakla birlikte şirket içi erişim yetki esasına göre sınırlandırılır.'],
      ['Prim itirazı nasıl yapılır?', 'Sentetik süreçte çalışan prim sonucuna ilişkin itirazını bildirimden sonraki beş iş günü içinde yöneticisine ve İK’ya iletebilir. Değerlendirme kayıt altına alınır.'],
      ['Avans geri ödemesi nasıl yapılır?', 'Demo politikada onaylı avans, takip eden maaş döneminde veya mutabık kalınan takvimde mahsup edilir. Koşullar çalışana yazılı olarak bildirilir.']
    ]
  },
  {
    name: 'Yemek, yol, servis, sigorta ve eğitim yan hakları',
    count: 7,
    section: 'Bölüm 9 - Yan Haklar',
    items: [
      ['Yemek hakkı nasıl sağlanır?', 'Demo politikada yemek hakkı çalışılan günler için dijital yemek kartı veya eşdeğer destek olarak sağlanır. Tutarlar sentetik demo veride belirtilmez.'],
      ['Yol desteği kimlere verilir?', 'Sentetik örnekte ofise düzenli gelen çalışanlara yol desteği veya servis alternatifi sağlanabilir. Uzaktan çalışma günleri ayrıca değerlendirilir.'],
      ['Servis kullanım kuralları nelerdir?', 'Demo süreçte servis güzergahları dönemsel kapasiteye göre belirlenir ve çalışanların durak değişikliklerini önceden bildirmesi beklenir. Acil değişiklikler garanti edilmez.'],
      ['Özel sağlık sigortası ne zaman başlar?', 'Sentetik politikada özel sağlık sigortası uygun çalışanlar için işe giriş işlemleri tamamlandıktan sonra başlatılır. Kapsam ve başlangıç tarihi İK bilgilendirmesinde yer alır.'],
      ['Eğitim bütçesi nasıl kullanılır?', 'Demo kurala göre eğitim desteği rol gelişimiyle ilişkili talepler için yönetici onayıyla kullanılabilir. Katılım sonrası öğrenim çıktısı ekip içinde paylaşılabilir.'],
      ['Yan haklar deneme süresinde geçerli mi?', 'Sentetik örnekte bazı yan haklar işe girişte, bazıları deneme süresi tamamlandığında başlar. Hangi hakkın ne zaman başlayacağı İK duyurusunda belirtilir.'],
      ['Yemek hakkı izin gününde yüklenir mi?', 'Demo politikada yıllık izin, hastalık izni veya ücretsiz izin günlerinde yemek hakkı oluşmaz. Fiili çalışma veya onaylı görev günü esas alınır.']
    ]
  },
  {
    name: 'Dress code',
    count: 7,
    section: 'Bölüm 10 - Kıyafet ve Temsil',
    items: [
      ['Ofis kıyafet standardı nedir?', 'Demo politikada ofis kıyafet standardı temiz, düzenli ve iş ortamına uygun rahat-profesyonel çizgidedir. Bu kayıt sentetik demo politikadır.'],
      ['Müşteri toplantısında nasıl giyinilmelidir?', 'Sentetik kurala göre müşteri veya dış paydaş toplantılarında temsil niteliğine uygun daha profesyonel kıyafet tercih edilir. Ekip yöneticisi toplantı beklentisini önceden paylaşabilir.'],
      ['Uzaktan toplantılarda kıyafet kuralı var mı?', 'Demo politikada görüntülü uzaktan toplantılarda iş ortamına uygun üst giyim ve dikkat dağıtmayan arka plan önerilir. Kamera zorunluluğu toplantı amacına bağlıdır.'],
      ['Serbest kıyafet günü uygulanır mı?', 'Sentetik örnekte cuma günleri iş akışına uygun serbest kıyafet günü olarak uygulanabilir. Güvenlik veya müşteri teması olan alanlarda ek kurallar geçerlidir.'],
      ['İş sağlığı gerektiren kıyafetler kimlere zorunludur?', 'Demo kurala göre saha, depo veya laboratuvar benzeri alanlarda kişisel koruyucu donanım ve uygun kıyafet zorunludur. Kural İSG talimatlarıyla birlikte uygulanır.'],
      ['Kıyafet kuralı ihlali nasıl ele alınır?', 'Sentetik süreçte kıyafet standardına uymayan durumlar önce yapıcı geri bildirimle ele alınır. Tekrarlayan durumlarda yönetici ve İK sürece dahil olabilir.'],
      ['Dini veya kültürel kıyafetlere yaklaşım nedir?', 'Demo politikada dini, kültürel veya kişisel ifade kapsamındaki kıyafetlere saygı esastır. Yalnızca güvenlik veya iş gereği makul sınırlamalar uygulanabilir.']
    ]
  },
  {
    name: 'Seyahat ve masraf',
    count: 6,
    section: 'Bölüm 11 - Seyahat ve Masraf',
    items: [
      ['İş seyahati nasıl onaylanır?', 'Demo politikada iş seyahati başlamadan önce amaç, tarih ve tahmini bütçe ile sistemden talep edilir. Yönetici ve gerekli durumlarda finans onayı aranır.'],
      ['Masraf fişleri ne zaman iletilir?', 'Sentetik kurala göre masraf belgeleri seyahat veya harcama tarihinden sonraki beş iş günü içinde sisteme yüklenir. Eksik belge ödemeyi geciktirebilir.'],
      ['Konaklama seçimi nasıl yapılır?', 'Demo süreçte konaklama güvenli, ulaşılabilir ve makul bütçeli seçeneklerden seçilir. Lüks veya kişisel tercih kaynaklı ek farklar çalışana ait olabilir.'],
      ['Şehir içi ulaşım masrafı ödenir mi?', 'Sentetik örnekte onaylı iş amaçlı şehir içi ulaşım giderleri belgeyle karşılanabilir. Ev-ofis rutin ulaşımı yan hak politikasına göre ayrıca değerlendirilir.'],
      ['Yurt dışı seyahat için ek onay gerekir mi?', 'Demo politikada yurt dışı seyahatler yönetici, İK ve finans görünürlüğüyle planlanır. Vize, sigorta ve güvenlik gereksinimleri seyahat öncesi kontrol edilir.'],
      ['Kişisel harcamalar masrafa yazılabilir mi?', 'Sentetik kurala göre kişisel alışveriş, eğlence ve iş amacıyla ilişkisi olmayan giderler masraf olarak kabul edilmez. Tereddüt halinde finans ekibinden ön onay istenir.']
    ]
  },
  {
    name: 'İş sağlığı ve güvenliği',
    count: 6,
    section: 'Bölüm 12 - İSG',
    items: [
      ['İSG eğitimi zorunlu mu?', 'Demo politikada işe başlayan herkesin temel iş sağlığı ve güvenliği eğitimini tamamlaması zorunludur. Eğitim kayıtları İK ve İSG sorumlusu tarafından takip edilir.'],
      ['İş kazası nasıl bildirilir?', 'Sentetik süreçte iş kazası veya ramak kala olay derhal yöneticiye ve İSG sorumlusuna bildirilir. Gerekli kayıtlar aynı gün içinde açılır.'],
      ['Ergonomi desteği alınabilir mi?', 'Demo kurala göre ofis veya uzaktan çalışma ergonomisi için çalışan İK’ya destek talebi iletebilir. Sandalye, ekran ve çalışma düzeni önerileri değerlendirilir.'],
      ['Acil durum tatbikatına katılım gerekir mi?', 'Sentetik politikada acil durum tatbikatlarına katılım zorunludur. Katılamayan çalışan telafi bilgilendirmesine dahil edilir.'],
      ['Kişisel koruyucu donanım ne zaman kullanılır?', 'Demo örnekte riskli alanlara girişte gerekli kişisel koruyucu donanım kullanılmadan çalışma yapılamaz. Donanım eksikse çalışan göreve başlamadan yöneticisine bildirir.'],
      ['Sağlık raporu nasıl paylaşılır?', 'Sentetik süreçte sağlık raporu yalnızca gerekli bilgilerle ve güvenli kanal üzerinden İK’ya iletilir. Sağlık verisi hassas kabul edilir ve erişim sınırlandırılır.']
    ]
  },
  {
    name: 'Bilgi güvenliği',
    count: 6,
    section: 'Bölüm 13 - Bilgi Güvenliği',
    items: [
      ['Şifre politikası nedir?', 'Demo politikada kurumsal hesaplar güçlü, benzersiz şifre ve çok faktörlü doğrulama ile korunur. Şifreler kişisel notlarda veya sohbetlerde paylaşılmaz.'],
      ['Kişisel cihazdan çalışma yapılabilir mi?', 'Sentetik kurala göre kişisel cihaz kullanımı yalnızca güvenlik gereksinimleri sağlanır ve yetkili onay verilirse mümkündür. Kurumsal veri yerel diskte tutulmamalıdır.'],
      ['Phishing şüphesi nasıl bildirilir?', 'Demo süreçte şüpheli e-posta bağlantısına tıklanmadan bilgi güvenliği kanalına iletilir. Olay hızlıca sınıflandırılır ve çalışan bilgilendirilir.'],
      ['Veri paylaşımında nelere dikkat edilir?', 'Sentetik politikada veri paylaşımı ihtiyaç kadar, yetkili kişilerle ve onaylı araçlar üzerinden yapılır. Hassas veri harici kanallara taşınmaz.'],
      ['Ekran kilidi kuralı nedir?', 'Demo kurala göre çalışan masasından ayrılırken ekranını kilitler. Ortak alanlarda gizli belge veya cihaz gözetimsiz bırakılmaz.'],
      ['Yetkisiz erişim fark edilirse ne yapılır?', 'Sentetik süreçte yetkisiz erişim şüphesi hemen bilgi güvenliği ve yöneticiye bildirilir. Çalışan kendi başına kanıt temizleme veya sistem değişikliği yapmaz.']
    ]
  },
  {
    name: 'Performans ve kariyer',
    count: 6,
    section: 'Bölüm 14 - Performans ve Kariyer',
    items: [
      ['Performans görüşmeleri ne sıklıkla yapılır?', 'Demo politikada performans görüşmeleri yılda iki ana dönem ve düzenli ara geri bildirimlerle yürütülür. Amaç gelişimi izlemek ve beklentileri netleştirmektir.'],
      ['Hedefler nasıl belirlenir?', 'Sentetik süreçte hedefler çalışan ve yönetici tarafından ölçülebilir, ulaşılabilir ve rol öncelikleriyle uyumlu şekilde belirlenir. Hedefler dönem içinde gerekirse güncellenebilir.'],
      ['Terfi süreci nasıl işler?', 'Demo politikada terfi değerlendirmesi rol etkisi, yetkinlik, performans sürekliliği ve organizasyon ihtiyacına göre yapılır. Tek bir başarı otomatik terfi anlamına gelmez.'],
      ['Eğitim ve gelişim planı nasıl hazırlanır?', 'Sentetik örnekte gelişim planı çalışan, yönetici ve gerektiğinde İK ortaklığıyla hazırlanır. Plan teknik yetkinlik, davranışsal beceri ve kariyer hedeflerini içerebilir.'],
      ['Performans sonucuna itiraz edilebilir mi?', 'Demo süreçte çalışan performans değerlendirmesine ilişkin görüşünü belirlenen süre içinde yönetici ve İK ile paylaşabilir. Görüşme sonucu kayıt altına alınır.'],
      ['İç pozisyonlara başvuru yapılabilir mi?', 'Sentetik politikada çalışanlar uygun iç pozisyonlara yöneticilerini bilgilendirerek başvurabilir. Mevcut görev devri ve uygunluk takvimi birlikte planlanır.']
    ]
  },
  {
    name: 'Ayrılış ve etik bildirim',
    count: 6,
    section: 'Bölüm 15 - Ayrılış ve Etik',
    items: [
      ['İstifa süreci nasıl başlatılır?', 'Demo politikada istifa bildirimi yazılı olarak yöneticiye ve İK’ya iletilir. Bildirim sonrası devir planı, ekipman iadesi ve çıkış görüşmesi takvimi hazırlanır.'],
      ['Çıkış görüşmesi zorunlu mu?', 'Sentetik süreçte çıkış görüşmesi önerilir ve çalışanın deneyimini güvenli şekilde paylaşmasına olanak sağlar. Görüşme içeriği iyileştirme amacıyla değerlendirilir.'],
      ['Şirket ekipmanları ne zaman iade edilir?', 'Demo kurala göre zimmetli ekipmanlar son çalışma gününden önce veya en geç son gün İK/BT kontrolünde iade edilir. Eksikler kayıt altına alınır.'],
      ['Etik ihlal nasıl bildirilir?', 'Sentetik politikada etik ihlal şüphesi güvenli bildirim kanalı, İK veya yönetici üzerinden iletilebilir. Misillemeye karşı koruma ilkesi uygulanır.'],
      ['Gizlilik yükümlülüğü ayrılış sonrası sürer mi?', 'Demo politikada gizli bilgi ve kişisel veri koruma yükümlülüğü iş ilişkisi sona erdikten sonra da devam eder. Çalışan kurumsal veriyi yanında götüremez.'],
      ['Referans talebi nasıl yönetilir?', 'Sentetik süreçte referans talepleri İK koordinasyonuyla ve çalışanın açık onayıyla yanıtlanır. Paylaşılan bilgi rol ve çalışma tarihleriyle sınırlı tutulabilir.']
    ]
  }
];

function paraphrases(question, category) {
  const plain = question.replace(/\?$/, '');
  return [
    `${plain} hakkında bilgi verir misin?`,
    `${category} kapsamında ${plain.toLocaleLowerCase('tr-TR')}?`,
    `${plain} kuralı nasıl uygulanıyor?`
  ];
}

function conditions(category) {
  return {
    dataset_type: 'synthetic_demo',
    not_real_company_policy: true,
    language: 'tr',
    applies_to: 'anonim demo çalışanlar',
    answer_source_limit: 'Yalnızca approved=true kayıtlar ileride cevap kaynağı olabilir.',
    category
  };
}

const records = [];
let index = 1;

for (const category of categories) {
  if (category.items.length !== category.count) {
    throw new Error(`${category.name} count mismatch`);
  }
  for (const [question, answer] of category.items) {
    records.push({
      policy_code: `HR-${String(index).padStart(3, '0')}`,
      category: category.name,
      canonical_question: question,
      answer_text: answer,
      paraphrases: paraphrases(question, category.name),
      conditions: conditions(category.name),
      effective_from: effectiveFrom,
      effective_to: null,
      version: 1,
      source_title: sourceTitle,
      source_section: category.section,
      owner,
      approved: true,
      sensitivity: 'internal_demo',
      synthetic: true
    });
    index += 1;
  }
}

const required = [
  'policy_code',
  'category',
  'canonical_question',
  'answer_text',
  'paraphrases',
  'conditions',
  'effective_from',
  'effective_to',
  'version',
  'source_title',
  'source_section',
  'owner',
  'approved',
  'sensitivity',
  'synthetic'
];

function validate(recordsToValidate) {
  if (recordsToValidate.length !== 100) throw new Error(`Expected 100 records, got ${recordsToValidate.length}`);
  const codes = new Set();
  const cats = new Set();
  for (const record of recordsToValidate) {
    for (const field of required) {
      if (!(field in record)) throw new Error(`${record.policy_code || 'UNKNOWN'} missing ${field}`);
    }
    if (!/^HR-\d{3}$/.test(record.policy_code)) throw new Error(`Invalid policy_code ${record.policy_code}`);
    if (codes.has(record.policy_code)) throw new Error(`Duplicate policy_code ${record.policy_code}`);
    codes.add(record.policy_code);
    cats.add(record.category);
    if (!Array.isArray(record.paraphrases) || record.paraphrases.length < 3) throw new Error(`${record.policy_code} paraphrases invalid`);
    if (record.synthetic !== true) throw new Error(`${record.policy_code} synthetic must be true`);
    if (record.approved !== true) throw new Error(`${record.policy_code} approved must be true`);
    const from = Date.parse(record.effective_from);
    if (Number.isNaN(from)) throw new Error(`${record.policy_code} effective_from invalid`);
    if (record.effective_to !== null) {
      const to = Date.parse(record.effective_to);
      if (Number.isNaN(to) || to < from) throw new Error(`${record.policy_code} effective_to invalid`);
    }
  }
  if (cats.size < 15) throw new Error(`Expected at least 15 categories, got ${cats.size}`);
}

validate(records);

const outputPath = path.join(__dirname, '..', 'hr_policy_dataset_100.jsonl');
fs.writeFileSync(outputPath, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');

const categoryCounts = categories.map((category) => ({
  category: category.name,
  count: records.filter((record) => record.category === category.name).length
}));

console.log(JSON.stringify({
  outputPath,
  total: records.length,
  uniquePolicyCodes: new Set(records.map((record) => record.policy_code)).size,
  categories: categoryCounts
}, null, 2));
