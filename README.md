# 🌿 Freedom Clone (High-Strictness Multi-Device Focus & Productivity Hub)

Freedom.to चे अधिकृत कार्यपद्धती आणि आर्किटेक्चर सखोल रिव्हर्स इंजिनिअर करून तयार केलेले **१००% मोफत, प्रायव्हेट आणि हाय-स्ट्रिक्टनेस** फोकस ब्लॉकर.

---

## 🌐 Live Cloud Deployment
* **Live Web Dashboard**: [https://freedom-focus-hub.onrender.com](https://freedom-focus-hub.onrender.com)
* **Live Signature Green Screen**: [https://freedom-focus-hub.onrender.com/blocked.html](https://freedom-focus-hub.onrender.com/blocked.html)
* **Cloud Database**: Neon PostgreSQL (`freedom_db`)
* **Real-time Sync**: `wss://freedom-focus-hub.onrender.com/ws`

---

## 🛡️ कडक सुरक्षा आणि कार्यपद्धती (How the Strictness Works)

### १. सिग्नेचर ग्रीन स्क्रीन (The Iconic Green Screen)
* युझर जेव्हा YouTube किंवा कोणतीही ब्लॉक केलेली साइट उघडतो, तेव्हा कसलीही नेटवर्क एरर न येता थेट Freedom ची हिरवी स्क्रीन उघडते:
  > **"You've got your freedom back! YouTube is blocked to help you stay focused on what truly matters."**
* यामध्ये प्रेरणादायी फोकस कोट्स आणि सेशनचा लाईव्ह काऊंटडाऊन टाइमर असतो.

### २. DoH-Immune Browser Extension (`extension/`)
* आधुनिक ब्राउझर्स (Chrome, Edge, Brave) DNS-over-HTTPS (DoH) वापरत असल्यामुळे साधी `hosts` फाईल बायपास होऊ शकते.
* Freedom Focus Guard Extension थेट ब्राउझरच्या नेव्हिगेशन लेव्हलवर काम करते. YouTube किंवा Instagram उघडताच ते सेकंदाच्या आत ग्रीन स्क्रीनवर वळवले जाते.
* **कसे इन्स्टॉल करावे**:
  1. Chrome/Edge मध्ये `chrome://extensions/` उघडा.
  2. "Developer mode" चालू करा.
  3. "Load unpacked" वर क्लिक करून या रिपोमधील `extension/` फोल्डर निवडा.

### ३. १-क्लिक प्री-क्युरेटेड कॅटॅलॉग (Pre-Curated 1-Click Bundles)
* मॅन्युअली डोमेन टाईप करण्याची गरज नाही. डॅशबोर्डवर थेट पर्याय:
  * 📺 **YouTube & Video Streaming** (YouTube, Netflix, Twitch इ.)
  * 📸 **Social Media** (Instagram, TikTok, Facebook, X, Reddit)
  * 🎮 **Gaming & Discord** (Steam, Discord, Epic Games)
  * 🔥 **Full Lockdown** (सर्व मनोरंजक वेबसाइट्स व ॲप्स)

### ४. Windows Desktop Guardian (`clients/windows/`)
* **0.6s High-Speed Process Killer**: ब्लॉक केलेले ॲप्स (उदा. Discord, Steam) उघडताच बंद होतात.
* **Locked Mode Anti-Tamper**: लॉक मोड चालू असताना युझरने ॲप बंद करण्यासाठी `taskmgr.exe` (Task Manager) उघडल्यास गार्डियन त्याला प्रतिबंध करतो.

### ५. Android Fullscreen Overlay & Device Admin (`clients/android/`)
* **Accessibility Interception**: फोनवर YouTube किंवा Instagram उघडताच ॲप ऑटोमॅटिक कट होऊन होम स्क्रीनवर येते आणि समोर फुलस्क्रीन ग्रीन स्क्रीन अलर्ट येतो.
* **Device Admin**: लॉक मोड दरम्यान ॲप अनइन्स्टॉल करण्यापासून रोखते.
