# Freedom for Android - Mobile Client

हे अँड्रॉइड ॲप्लिकेशन Freedom.to चे अधिकृत कार्यपद्धतीनुसार तयार केलेले मूळ (Native) Android Client आहे.

## 🌟 फीचर्स

1. **Accessibility Service (`FreedomAccessibilityService.kt`)**:
   - इंस्टाग्राम, फेसबुक, यूट्यूब, टिकटॉक किंवा ब्लॉकलिस्ट मधील ॲप उघडताच ते बंद करून होम स्क्रीनवर नेतो.
   - क्रोम, एज, फायरफॉक्स आणि ब्रेव्ह ब्राउझरमधील ॲड्रेस बार स्कॅन करून ब्लॉक केलेल्या वेबसाइट्स उघडू देत नाही.
2. **Local Loopback VPN Service (`FreedomVpnService.kt`)**:
   - कोणत्याही बाह्य सर्व्हरची गरज नसलेले, संपूर्णपणे फोनवरच चालणारे लोकल DNS फिल्टर.
3. **Device Admin Receiver (`FreedomDeviceAdminReceiver.kt`)**:
   - लॉक मोड चालू असताना ॲप अनइन्स्टॉल करण्यापासून रोखतो.
4. **WebSocket Sync (`SyncWebSocketClient.kt`)**:
   - सेंट्रल सर्व्हरशी कनेक्ट राहून विंडोज डेस्कटॉपवर सुरू केलेले सेशन्स मोबाईलवरही त्वरित लागू करतो.

## 🛠️ कसे चालवायचे / बिल्ड करायचे?

1. हे फोल्डर (`clients/android`) **Android Studio** मध्ये उघडा.
2. `MainActivity.kt` मधील `serverUrl` मध्ये तुमच्या कॉम्प्युटरचा लोकल IP टाका (उदा. `ws://192.168.1.5:5050/ws`).
3. ॲप फोनमध्ये इन्स्टॉल केल्यानंतर:
   - **Accessibility Permission** ऑन करा.
   - **Device Admin Permission** ऑन करा (Locked Mode संरक्षणासाठी).
   - **Local VPN Permission** ऑन करा.
