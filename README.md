# 🎬 Birlikte İzle v3.0 - TAM ÖZELLİKLİ!

Sevgilinle birlikte her şeyi izleyebileceğin, sesli görüşebileceğin, ekran paylaşabileceğin uygulama! 💕

---

## ✨ YENİ v3.0 ÖZELLİKLERİ

### 🔥 TAM WebRTC Entegrasyonu
- 📺 **Ekran Paylaşımı**: HERHANGİ BİR SİTEYİ izleyin (Netflix, kaçak siteler, her şey!)
- 🎤 **Sesli Görüşme**: Peer-to-peer düşük gecikmeli ses
- 📷 **Görüntülü Görüşme**: İsteğe bağlı kamera
- ⏱️ **3-2-1 Başla Butonu**: Manuel senkronizasyon için countdown

### 🎬 Video Desteği (v2.0'dan)
- ✅ **YouTube** - Tam senkronize
- ✅ **Vimeo** - Tam senkronize
- ✅ **MP4/WEBM** - Direkt linkler

---

## 🎯 NASIL KULLANILIR?

### Senaryo 1: Kaçak Site / Netflix İzlemek
1. **Odaya katılın** (ikisi de aynı oda kodu)
2. **"Ekran Paylaş"** butonuna tıklayın
3. Paylaşmak istediğiniz **tarayıcı sekmesini** seçin
4. **"Mikrofon Açık"** butonuna tıklayın
5. O siteye girin ve videoyu başlatın
6. Sevgiliniz sizin ekranınızı görecek ve sesinizi duyacak! 🎉

### Senaryo 2: YouTube / Vimeo İzlemek
1. Odaya katılın
2. YouTube/Vimeo URL'sini yapıştırın
3. "Videoyu Yükle" tıklayın
4. Otomatik senkronize olacak!
5. İsterseniz "Mikrofon Açık" ile konuşun

### Senaryo 3: İndirdiğiniz MP4 Video
1. Google Drive'a yükleyin
2. Paylaşım linkini alın
3. Uygulamaya yapıştırın
4. Otomatik oynatılacak!

---

## 🎮 KONTROLLER

### WebRTC Butonları:

- **📺 Ekran Paylaş** 
  - Tıkla → Ekran/sekme seç → Paylaş!
  - Herhangi bir site çalışır!

- **🎤 Mikrofon**
  - Tıkla → Açık/Kapalı toggle
  - Sesli görüşme için

- **📷 Kamera**
  - Tıkla → Açık/Kapalı toggle
  - İsteğe bağlı video

- **⏱️ 3-2-1 Başla!**
  - Manuel senkronizasyon için
  - İkisi de hazır olunca countdown başlar

---

## 💡 İPUÇLARI

### En İyi Performans İçin:
- **Kablolu İnternet** kullanın (WiFi yerine)
- **Chrome veya Edge** tarayıcı (en iyi WebRTC desteği)
- **Ekran paylaşımında** sadece o sekmeyi paylaşın (tüm ekranı değil)
- **Mikrofonu** kullanmıyorsanız kapatın (bant genişliği)

### Ekran Paylaşımı İpuçları:
- Video oynatmadan ÖNCE ekran paylaşımını başlatın
- "Tab" (Sekme) seçeneğini kullanın (Window değil)
- "Share audio" kutucuğunu işaretleyin (varsa)
- Sekmeyi tam ekran yapın (F11)

### Kalite Sorunları?
- İnternet hızınızı kontrol edin
- Ekran paylaşımı çözünürlüğünü düşürün
- Başka uygulamaları kapatın
- Tarayıcıyı yeniden başlatın

---

## 🚀 KURULUM

### Lokal (Test için):
```bash
npm install
npm start
# http://localhost:3000
```

### Canlı (Render.com):
1. Dosyaları GitHub'a yükle
2. Render'da deploy et
3. Linki sevgilinle paylaş!

---

## 🔧 TEKNİK DETAYLAR

### Backend:
- Node.js + Express
- Socket.io (Real-time iletişim)
- WebRTC sinyal sunucusu

### Frontend:
- Vanilla JavaScript
- WebRTC API (Ekran paylaşımı, ses, video)
- YouTube IFrame API
- Vimeo Player API
- HTML5 Video API

### WebRTC:
- STUN Sunucular: Google STUN servers
- Peer-to-peer bağlantı
- Düşük gecikme (<100ms tipik)

---

## ⚠️ ÖNEMLİ NOTLAR

### Tarayıcı İzinleri:
İlk kullanımda tarayıcı şunları soracak:
- **Mikrofon erişimi**: "İzin Ver" tıklayın
- **Ekran paylaşımı**: Sekme/ekran seçin
- **Kamera erişimi** (isteğe bağlı): İzin verin

### Gizlilik:
- Peer-to-peer bağlantı (doğrudan sizin aranızda)
- Sunucu sadece sinyal için kullanılır
- Video/ses bizim sunucudan geçmez
- Sadece oda kodunu bilenler katılabilir

### Uyumluluk:
- ✅ Chrome (En iyi)
- ✅ Edge (En iyi)
- ✅ Firefox (İyi)
- ⚠️ Safari (Sınırlı WebRTC desteği)
- ❌ IE (Desteklenmez)

---

## 🐛 SORUN GİDERME

### "Ekran paylaşımı başlatılamadı"
- Tarayıcı güncel mi kontrol edin
- HTTPS bağlantısı gerekli (Render otomatik sağlar)
- İzinleri kontrol edin

### "Ses gelmiyor"
- Mikrofon izni verildi mi?
- Mikrofon butonu açık mı?
- Sistem ses seviyesini kontrol edin
- Tarayıcı sekmesi sessize alınmış mı?

### "Bağlantı kurulamıyor"
- Her ikisi de aynı oda kodunu kullanıyor mu?
- İnternet bağlantısı stabil mi?
- Firewall WebRTC'yi engelliyor olabilir
- Sayfayı yenileyin ve tekrar deneyin

### "Video gecikiyor"
- İnternet hızı yeterli mi? (Min. 5 Mbps)
- Ekran paylaşımı çözünürlüğünü düşürün
- Başka uygulamaları kapatın
- Kablolu bağlantı kullanın

---

## 📝 DEĞİŞİKLİK GEÇMİŞİ

### v3.0 (YENİ! 🎉)
- ✨ WebRTC Ekran Paylaşımı eklendi
- ✨ Sesli görüşme eklendi
- ✨ Görüntülü görüşme eklendi
- ✨ Manuel senkronizasyon (3-2-1 başla)
- 🔧 Performans iyileştirmeleri
- 🎨 Yeni kontrol butonları

### v2.0
- ✨ YouTube tam desteği
- ✨ Vimeo desteği
- 🔧 Otomatik platform algılama

### v1.0
- 🎉 İlk sürüm
- ✅ MP4/WEBM desteği
- ✅ Chat sistemi

---

## 💝 ÖZEL NOT

Bu uygulama **Sando ve sevgilisi** için özel olarak geliştirildi! 

Artık Netflix, kaçak siteler, YouTube, her şeyi birlikte izleyebilir, konuşabilir ve eğlenebilirsiniz! 🎬💕

Keyifli seyirler! 🍿✨

---

## 📄 LİSANS

MIT License - Özgürce kullanın!

## 🤝 KATKIDA BULUNMA

Pull request'ler memnuniyetle karşılanır!

---

**Telif hakları bildirimi**: Bu uygulama kişisel kullanım içindir. Telif hakkı korumalı içerikleri izlerken yerel yasalara uygun hareket edin.
