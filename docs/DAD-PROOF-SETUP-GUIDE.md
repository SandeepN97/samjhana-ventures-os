# 🏢 Samjhana Ventures OS - Setup Guide

## सम्झना भेन्चर्स OS - सेटअप गाइड

> **For Dad (बुवाको लागि)**: This guide will help you run the application on your computer in Nepal.
> यो गाइडले तपाईंलाई नेपालमा आफ्नो कम्प्युटरमा एप्लिकेसन चलाउन मद्दत गर्नेछ।

---

## 📋 What You'll Need (के चाहिन्छ)

1. ✅ A Windows computer (Windows 10 or 11)
2. ✅ Internet connection for initial setup
3. ✅ The `samjhana-ventures-os.jar` file (Son will send this)

---

## 🚀 Step 1: Install Java (जाभा इन्स्टल गर्नुहोस्)

Java is required to run the application. Follow these steps:

### Windows Instructions:

1. **Open this link in your browser:**
   ```
   https://adoptium.net/
   ```

2. **Click the big "Latest LTS Release" button**
   - यो ठूलो हरियो बटनमा क्लिक गर्नुहोस्

3. **Run the downloaded file**
   - डाउनलोड भएको फाइल चलाउनुहोस्
   - Click "Next" on each screen
   - प्रत्येक स्क्रिनमा "Next" क्लिक गर्नुहोस्

4. **Restart your computer**
   - कम्प्युटर रिस्टार्ट गर्नुहोस्

### ✅ Verify Installation (जाँच गर्नुहोस्):
1. Press `Windows + R`
2. Type `cmd` and press Enter
3. Type `java -version` and press Enter
4. You should see version 21 or higher

---

## 📁 Step 2: Create Folders (फोल्डर बनाउनुहोस्)

1. **Open File Explorer** (फाइल एक्सप्लोरर खोल्नुहोस्)
   - Press `Windows + E`

2. **Go to C: drive** (C: ड्राइभमा जानुहोस्)

3. **Create a new folder called `SamjhanaOS`**
   - Right-click → New → Folder
   - Name it: `SamjhanaOS`

4. **Inside SamjhanaOS, create two more folders:**
   - `data` - for database
   - `images` - for photos

Your folder structure should look like:
```
C:\SamjhanaOS\
    ├── data\
    ├── images\
    └── samjhana-ventures-os.jar  (you'll add this next)
```

---

## 📥 Step 3: Get the Application (एप्लिकेसन प्राप्त गर्नुहोस्)

**Son will send you the JAR file via:**
- Email attachment
- Google Drive link
- WhatsApp (if file size allows)

1. **Download the file** `samjhana-ventures-os.jar`
2. **Move it to** `C:\SamjhanaOS\`

---

## ▶️ Step 4: Run the Application (एप्लिकेसन चलाउनुहोस्)

### Method A: Double-Click (सजिलो तरिका)

1. Go to `C:\SamjhanaOS\`
2. **Double-click** on `samjhana-ventures-os.jar`
3. A black window will appear - **don't close it!**
   - कालो विन्डो देखिन्छ - यसलाई नबन्द गर्नुहोस्!
4. Wait 30 seconds for startup

### Method B: Create Desktop Shortcut (डेस्कटप सर्टकट)

1. Right-click on `samjhana-ventures-os.jar`
2. Select "Create shortcut"
3. Move the shortcut to your Desktop
4. Rename it to "Samjhana OS"

Now you can start the app from your desktop!

---

## 🌐 Step 5: Open in Browser (ब्राउजरमा खोल्नुहोस्)

1. **Open Google Chrome** or any browser
2. **Type in the address bar:**
   ```
   http://localhost:8080
   ```
3. Press Enter

You should see the Samjhana Ventures OS login screen!

---

## 🔐 Step 6: Login (लग इन गर्नुहोस्)

**Your login credentials (तपाईंको लगइन):**

| Field | Value |
|-------|-------|
| Username | `buwa` |
| Password | `samjhana2024` |

*(Son will set up your actual password)*

---

## 🔗 Step 7: Connect with Son (छोरासँग जोड्नुहोस्) - Tailscale

To let Son access your computer securely from USA:

### Install Tailscale:

1. **Open this link:**
   ```
   https://tailscale.com/download
   ```

2. **Click "Download for Windows"**

3. **Run the installer**
   - Click Next on all screens

4. **Sign in with Google**
   - Use the family Google account
   - Son will tell you which account to use

5. **After signing in, you'll see a Tailscale icon in your system tray**
   - (Bottom right corner near the clock)

### Get Your Tailscale Address:

1. Click the Tailscale icon in system tray
2. Your address looks like: `your-pc-name.tailnet-xxxx.ts.net`
3. **Send this address to Son via WhatsApp**

Now Son can access your Samjhana OS from USA!

---

## 📱 Using on Mobile (मोबाइलमा प्रयोग)

You can also use Samjhana OS on your phone:

1. Connect your phone to the **same WiFi** as your computer
2. Find your computer's IP address:
   - Press `Windows + R`
   - Type `cmd`, press Enter
   - Type `ipconfig`, press Enter
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)

3. On your phone browser, type:
   ```
   http://192.168.1.100:8080
   ```
   (Replace with your actual IP)

---

## ❓ Common Problems (समस्या र समाधान)

### Problem: "Java not found"
**Solution:** Restart your computer after installing Java

### Problem: Double-click doesn't work
**Solution:** 
1. Right-click on the JAR file
2. Select "Open with" → "Java Platform SE Binary"

### Problem: Can't access from phone
**Solution:** 
1. Make sure both devices are on same WiFi
2. Check Windows Firewall - allow Java through

### Problem: App is slow
**Solution:** 
1. Close other programs
2. Restart the application

---

## 📞 Need Help? (मद्दत चाहिन्छ?)

**Call Son** - He can help remotely via Tailscale!

Or send a WhatsApp message with:
1. A screenshot of the problem
2. What you were trying to do

---

## 🎉 You're Ready! (तयार हुनुभयो!)

Now you can:
- ✅ Record petrol sales (पेट्रोल बिक्री रेकर्ड)
- ✅ Track EV charging (EV चार्जिंग ट्र्याक)
- ✅ Manage rentals (भाडा व्यवस्थापन)
- ✅ Track loans (ऋण ट्र्याक)
- ✅ Manage furniture stock (फर्निचर स्टक)
- ✅ Take photos of bills (बिलको फोटो)

**Son will review your entries from USA!**
छोराले अमेरिकाबाट तपाईंका एन्ट्रीहरू समीक्षा गर्नेछ!

---

## 📋 Quick Reference Card (छिटो सन्दर्भ कार्ड)

Print this and keep near your computer:

```
╔═══════════════════════════════════════════════════════════╗
║           SAMJHANA VENTURES OS - QUICK START              ║
║                सम्झना भेन्चर्स - छिटो सुरु                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  1. Double-click "Samjhana OS" on Desktop                ║
║     डेस्कटपमा "Samjhana OS" मा डबल-क्लिक गर्नुहोस्           ║
║                                                           ║
║  2. Wait for black window (don't close!)                 ║
║     कालो विन्डो पर्खनुहोस् (बन्द नगर्नुहोस्!)               ║
║                                                           ║
║  3. Open Chrome, type: localhost:8080                    ║
║     Chrome खोल्नुहोस्, टाइप गर्नुहोस्: localhost:8080       ║
║                                                           ║
║  4. Login: buwa / samjhana2024                           ║
║     लगइन: buwa / samjhana2024                            ║
║                                                           ║
║  5. Tap the business button to add entry                 ║
║     एन्ट्री थप्न व्यापार बटनमा ट्याप गर्नुहोस्              ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  HELP: Call Son! | मद्दत: छोरालाई फोन गर्नुहोस्!          ║
╚═══════════════════════════════════════════════════════════╝
```

---

*Document Version: 1.0 | Last Updated: January 2025*
