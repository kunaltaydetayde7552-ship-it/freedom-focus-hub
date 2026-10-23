# 🌿 Freedom Clone (Self-Hosted • 100% Free • Multi-Device Focus Hub)

Freedom.to चे अधिकृत कार्यपद्धती आणि आर्किटेक्चर रिव्हर्स इंजिनिअर करून तयार केलेले **१००% मोफत, प्रायव्हेट आणि सेल्फ-होस्टेड** मल्टी-डिव्हाइस फोकस आणि ॲप/वेबसाइट ब्लॉकर.

यामध्ये कोणतेही सबस्क्रिप्शन, पेमेंट गेटवे किंवा जाहिराती नाहीत.

---

## 🏗️ सिस्टीम आर्किटेक्चर (System Architecture)

```
┌────────────────────────────────────────────────────────────────┐
│               Central Sync Hub (Node.js + SQLite)               │
│               Web Dashboard: http://localhost:5050             │
│               WebSocket Real-Time Sync: ws://localhost:5050/ws │
└───────────────┬────────────────────────────────┬───────────────┘
                │                                │
                ▼                                ▼
┌───────────────────────────────┐  ┌─────────────────────────────┐
│    Windows Desktop Client     │  │    Android Mobile Client    │
│  - Hosts File Website Blocker │  │  - Accessibility Service    │
│  - Process Watcher / Killer   │  │  - Local DNS Loopback VPN   │
│  - Strict Locked Mode         │  │  - Device Admin Protection  │
└───────────────────────────────┘  └─────────────────────────────┘
```

---

## 🚀 झटपट सुरुवात (Quick Start)

### १. सेंट्रल सिंक सर्व्हर चालवणे
प्रोजेक्ट रूटमधील `start_server.bat` वर डबल-क्लिक करा (किंवा टर्मिनलमध्ये रन करा):
```bash
cd server
npm start
```
* **डॅशबोर्ड लिंक**: [http://localhost:5050](http://localhost:5050) उघडा.
* येथे तुम्ही:
  * सेशन्स सुरू करू शकता (15m, 25m Pomodoro, 45m, 1hr किंवा कस्टम).
  * 🔒 **Locked Mode** चालू करू शकता.
  * **Daily Routines (शेड्यूल्स)** सेट करू शकता (उदा. सोम-शुक्र सकाळी ९ ते १२).
  * **Blocklists** (Websites, Windows .exe apps, Android mobile apps) कस्टमाइझ करू शकता.
  * **Focus Sounds** (पाऊस, समुद्र, पांढरा आवाज) ऐकू शकता.

---

### २. Windows डेस्कटॉप क्लायंट चालवणे
प्रोजेक्ट रूटमधील `start_windows_agent.bat` वर राइट क्लिक करून **"Run as Administrator"** करा:
```bash
# किंवा ॲडमिन टर्मिनलमध्ये:
cd clients\windows
node freedom_agent.js
```
* हे सर्व्हरशी आपोआप कनेक्ट होईल आणि डॅशबोर्डवर तुमचे विंडोज मशीन **Online** दिसेल.
* जेव्हा सेशन सुरू होईल:
  * `hosts` फाईल आपोआप अपडेट होऊन वेबसाइट्स ब्लॉक होतील.
  * `discord.exe`, `steam.exe` किंवा ब्लॉक केलेले ॲप्स उघडताच बंद होतील.
  * सेशन संपताच सर्व वेबसाइट्स व ॲप्स आपोआप पूर्ववत सुरू होतील.

---

### ३. Android मोबाईल क्लायंट चालवणे
`clients/android` फोल्डर Android Studio मध्ये उघडून तुमच्या फोनवर रन करा:
* **Accessibility Permission**: ब्लॉक केलेले मोबाईल ॲप्स (Instagram, YouTube इ.) त्वरित बंद करण्यासाठी.
* **Local VPN Permission**: फोनवरच DNS लेव्हलवर वेबसाइट्स ब्लॉक करण्यासाठी.
* **Device Admin Permission**: लॉक मोड चालू असताना ॲप अनइन्स्टॉल करण्यापासून रोखण्यासाठी.

---

## 🔒 Locked Mode कसे काम करते?
* जर तुम्ही डॅशबोर्डवर **Locked Mode** सुरू केला, तर ठरवलेला वेळ संपेपर्यंत सेशन थांबवता येत नाही.
* सर्व्हर "Stop Session" विनंती थेट नाकारतो (`403 Forbidden`).
* सेशन संपल्यावरच सर्व निर्बंध आपोआप उठवले जातात.
