# 🎬 Birlikte İzle - Watch Together App

Sevdiklerinle senkronize film ve dizi izlemek için geliştirilmiş web uygulaması.

## ✨ Özellikler

- 🎥 Gerçek zamanlı video senkronizasyonu
- 💬 Canlı sohbet özelliği
- 👥 Oda sistemi (özel izleme odaları)
- 🔄 Otomatik play/pause/seek senkronizasyonu
- 📱 Responsive tasarım
- 🌐 Tarayıcıdan erişim (kurulum gerektirmez)

## 🚀 Kurulum

### 1. Yerel Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Sunucuyu başlat
npm start
```

Tarayıcınızda `http://localhost:3000` adresini açın.

### 2. Online Deploy (Önerilen)

#### Render.com (ÜCRETSİZ)

1. [Render.com](https://render.com)'a kayıt olun
2. "New +" > "Web Service" seçin
3. Bu repository'yi bağlayın veya GitHub'a yükleyin
4. Ayarlar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. "Create Web Service" butonuna tıklayın

#### Railway.app (ÜCRETSİZ)

1. [Railway.app](https://railway.app)'e kayıt olun
2. "New Project" > "Deploy from GitHub repo"
3. Otomatik deploy!

#### Glitch.com (ÜCRETSİZ)

1. [Glitch.com](https://glitch.com)'a gidin
2. "New Project" > "Import from GitHub"
3. Otomatik deploy!

## 📖 Nasıl Kullanılır?

### Oda Oluşturma

1. Adınızı girin (örn: "Sando")
2. Oda kodu oluşturun (örn: "sando-room-123")
3. "Odaya Katıl" butonuna tıklayın
4. Oda kodunu arkadaşınızla paylaşın

### Video İzleme

Video URL'si olarak direkt video dosyası linki kullanın:
- ✅ `.mp4`, `.webm`, `.ogg` formatları
- ✅ Örnek: `https://example.com/video.mp4`
- ❌ YouTube/Netflix embed engeli nedeniyle çalışmaz

**Test için örnek video:**
```
http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4
```

### Video Kaynakları

- [GoFile.io](https://gofile.io) - Ücretsiz dosya hosting
- [Mega.nz](https://mega.nz) - 20GB ücretsiz
- Google Drive (direkt link almanız gerekir)

## 🔧 Teknik Detaylar

### Teknolojiler

- Backend: Node.js + Express + Socket.io
- Frontend: Vanilla JavaScript + HTML5 + CSS3
- Real-time: WebSocket (Socket.io)

### Dosya Yapısı

```
watch-together/
├── server.js           # Backend server
├── package.json        # Dependencies
├── public/
│   ├── index.html     # Ana sayfa
│   ├── style.css      # Stil dosyası
│   └── app.js         # Client-side logic
└── README.md          # Bu dosya
```

## 🎯 Kullanım Senaryoları

### 1. Yerel Ağda (Aynı WiFi)
- Sunucuyu çalıştırın
- IP adresinizi öğrenin: `ipconfig` (Windows) veya `ifconfig` (Mac/Linux)
- Diğer kişi `http://[IP-ADDRESS]:3000` ile bağlansın

### 2. İnternet Üzerinden
- Render/Railway gibi platformlarda deploy edin
- Verilen URL'den erişin
- Port açma/firewall ayarı gerekmez

## 💡 İpuçları

1. **En İyi Performans**: Stabil internet gereklidir
2. **Video Formatı**: MP4 (H.264) en uyumludur
3. **Oda Kodları**: Karmaşık kodlar kullanın
4. **Mobil**: Responsive tasarım sayesinde mobilde de çalışır

## 🐛 Sorun Giderme

### Video oynatmıyor?
- URL'nin direkt video dosyası olduğundan emin olun
- Tarayıcı konsolunu kontrol edin (F12)
- Farklı format deneyin (MP4 önerilir)

### Senkronizasyon problemi?
- Sayfayı yenileyin
- Aynı oda kodunu kullandığınızdan emin olun
- İnternet bağlantınızı kontrol edin

### Bağlantı kopuyor?
- Ücretsiz hosting servisleri inaktivite sonrası uyur
- Render.com free tier 15dk sonra uyur

## 📝 Lisans

MIT License - İstediğiniz gibi kullanabilirsiniz!

## 🎮 Proje Sahibi

**Sando** - Maerd City Visual Novel geliştiricisi
- DAZ3D & Ren'Py uzmanı
- Gaming & Fitness enthusiast

---

**Not**: Bu uygulama telif hakkı korumalı içerikler için kullanılmamalıdır. Sadece kendi içerikleriniz veya izin alınmış içerikler için kullanın.

💬 Sorularınız için issue açabilirsiniz!
