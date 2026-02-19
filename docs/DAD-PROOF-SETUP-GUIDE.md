# Samjhana Ventures OS - Setup Guide

## सम्झना भेन्चर्स OS - सेटअप गाइड

> **For Dad (बुवाको लागि)**: This guide will help you run the application on your computer in Nepal.
> यो गाइडले तपाईंलाई नेपालमा आफ्नो कम्प्युटरमा एप्लिकेसन चलाउन मद्दत गर्नेछ।

---

## What You'll Need (के चाहिन्छ)

1. A Windows computer (Windows 10 or 11)
2. Internet connection for initial setup
3. The `samjhana-ventures-os.jar` file (Son will send this)

---

## Step 1: Install Java (जाभा इन्स्टल गर्नुहोस्)

Java is required to run the application.

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
   - **Important:** When you see "Set JAVA_HOME variable", make sure it is checked
   - प्रत्येक स्क्रिनमा "Next" क्लिक गर्नुहोस्

4. **Restart your computer**
   - कम्प्युटर रिस्टार्ट गर्नुहोस्

### Verify Installation (जाँच गर्नुहोस्):
1. Press `Windows + R`
2. Type `cmd` and press Enter
3. Type `java -version` and press Enter
4. You should see version 21 or higher

---

## Step 2: Create Folders (फोल्डर बनाउनुहोस्)

1. **Open File Explorer** (फाइल एक्सप्लोरर खोल्नुहोस्)
   - Press `Windows + E`

2. **Go to C: drive** (C: ड्राइभमा जानुहोस्)

3. **Create a new folder called `SamjhanaOS`**
   - Right-click → New → Folder
   - Name it: `SamjhanaOS`

Your folder structure should look like:
```
C:\SamjhanaOS\
    └── (empty for now)
```

---

## Step 3: Get the Application Files (एप्लिकेसन प्राप्त गर्नुहोस्)

**Son will send you two files via Email, Google Drive, or WhatsApp:**

1. `samjhana-ventures-os.jar` — the application
2. `start-samjhana.bat` — the launcher script

**Move both files to** `C:\SamjhanaOS\`

Your folder should now look like:
```
C:\SamjhanaOS\
    ├── samjhana-ventures-os.jar
    └── start-samjhana.bat
```

> **Note for Son:** Create the `start-samjhana.bat` file with this content:
> ```bat
> @echo off
> title Samjhana Ventures OS
> echo ========================================
> echo   Samjhana Ventures OS Starting...
> echo   सम्झना भेन्चर्स OS सुरु हुँदैछ...
> echo ========================================
> echo.
> echo DO NOT CLOSE THIS WINDOW!
> echo यो विन्डो बन्द नगर्नुहोस्!
> echo.
> set JWT_SECRET=your-secure-secret-key-here
> cd /d C:\SamjhanaOS
> java -jar samjhana-ventures-os.jar
> pause
> ```
> Replace `your-secure-secret-key-here` with an actual secret before sending to Dad.

---

## Step 4: Allow Through Windows Firewall (फायरवाल अनुमति)

Windows will block the app from the network the first time. You need to allow it so you can access it from your phone too.

1. **When you first run the app**, Windows will show a security popup
2. **Check both boxes:**
   - "Private networks" ✅
   - "Public networks" ✅
3. **Click "Allow access"**
   - "Allow access" मा क्लिक गर्नुहोस्

If you missed the popup:
1. Press `Windows` key, type **"firewall"**
2. Click **"Allow an app through Windows Firewall"**
3. Click **"Change settings"**
4. Find **"Java Platform SE Binary"** in the list
5. Check both **Private** and **Public** boxes
6. Click **OK**

---

## Step 5: Run the Application (एप्लिकेसन चलाउनुहोस्)

1. Go to `C:\SamjhanaOS\`
2. **Double-click** on `start-samjhana.bat`
3. A black window will appear with a message — **DO NOT close it!**
   - कालो विन्डो देखिन्छ - यसलाई नबन्द गर्नुहोस्!
4. Wait about 30 seconds until you see "Started SamjhanaVenturesOsApplication"

### Create a Desktop Shortcut (डेस्कटप सर्टकट)

1. Right-click on `start-samjhana.bat`
2. Select **"Send to" → "Desktop (create shortcut)"**
3. Rename the shortcut to **"Samjhana OS"**

Now you can start the app from your desktop!

---

## Step 6: Open in Browser (ब्राउजरमा खोल्नुहोस्)

1. **Open Google Chrome** or any browser
2. **Type in the address bar:**
   ```
   http://localhost:8080
   ```
3. Press Enter

You should see the Samjhana Ventures OS login screen!

---

## Step 7: Login (लग इन गर्नुहोस्)

**Your login credentials (तपाईंको लगइन):**

| Field | Value |
|-------|-------|
| Username | `dad` |
| Password | `dad123` |

> Son can change your password later from the admin panel.

---

## Step 8: Connect with Son (छोरासँग जोड्नुहोस्) - Tailscale

### What is Tailscale? (Tailscale के हो?)

Tailscale is a free app that creates a **secure private connection** between devices — like a secret tunnel between Dad's computer in Nepal and Son's laptop in USA.

**Why do we need it?**
- Without Tailscale, Son **cannot** access Dad's computer from USA (it's hidden behind your home internet router)
- With Tailscale, both devices join the same private network — as if they were on the same WiFi, even from opposite sides of the world
- It's free, safe, and requires no complicated router setup

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

## Using on Mobile Phone (मोबाइलमा प्रयोग)

You can use Samjhana OS on your phone. The app has big buttons designed for touch screens.

### Understanding When It Works (कहिले काम गर्छ):

The app runs on your **computer** — your phone is just a window to view it. So the computer must be **turned on and running the app** for the phone to work.

| Situation | Works? | What to use |
|-----------|--------|-------------|
| Phone on **home WiFi** (same as computer) | Yes | Local IP address (see below) |
| Phone on **different WiFi** (friend's house, office) | Only with Tailscale | Tailscale address |
| Phone on **mobile data** (outside) | Only with Tailscale | Tailscale address |

> The app is lightweight (text and small tables only), so it uses very little data — even on mobile data, it won't cost much.

### Option A: Home WiFi (घरको WiFi मा)

This is the simplest — no extra app needed on your phone.

1. Connect your phone to the **same WiFi** as your computer

2. Find your computer's IP address:
   - On the computer, press `Windows + R`
   - Type `cmd`, press Enter
   - Type `ipconfig`, press Enter
   - Look for **"IPv4 Address"** under your WiFi adapter (e.g., `192.168.1.100`)

3. On your phone browser (Chrome), type:
   ```
   http://192.168.1.100:8080
   ```
   (Replace `192.168.1.100` with your actual IP from step 2)

### Option B: From Anywhere with Tailscale (जहाँबाट पनि)

If you want to use the app from **outside the house** — on mobile data, at a friend's house, or any other WiFi — you need Tailscale on your phone:

1. Install **Tailscale** from Google Play Store (Android) or Apple App Store (iPhone)
2. Sign in with the **same family Google account** used on the computer
3. Turn on Tailscale (it connects in a few seconds)
4. Open your phone browser and type:
   ```
   http://your-pc-name.tailnet-xxxx.ts.net:8080
   ```
   (Son will tell you the exact address)

> **Tip:** Once Tailscale is set up, it works on **all networks** — home WiFi, other WiFi, and mobile data. You can use the Tailscale address everywhere and forget about the local IP address.

### Add to Home Screen (होम स्क्रिनमा थप्नुहोस्):

To open the app like a regular app on your phone:

**Android (Chrome):**
1. Open the app in Chrome on your phone
2. Tap the **three dots** (⋮) menu in the top right
3. Tap **"Add to Home screen"**
4. Name it **"Samjhana OS"** and tap **Add**
5. Now you have an icon on your home screen!

**iPhone (Safari):**
1. Open the app in Safari on your phone
2. Tap the **Share button** (square with arrow) at the bottom
3. Scroll down and tap **"Add to Home Screen"**
4. Name it **"Samjhana OS"** and tap **Add**

---

## How to Stop the App (एप बन्द गर्नुहोस्)

When you're done for the day:

1. Go to the **black window** (command prompt) that opened when you started the app
2. Click inside the black window
3. Press `Ctrl + C` on your keyboard
4. The app will stop

Or simply **close the black window** by clicking the X button.

---

## Auto-Start on Boot (कम्प्युटर सुरु हुँदा आफै चल्ने)

If you want the app to start automatically when you turn on your computer:

1. Press `Windows + R`
2. Type `shell:startup` and press Enter
3. A folder will open
4. **Copy the "Samjhana OS" shortcut** from your Desktop into this folder

Now the app will start every time you turn on your computer!

To stop auto-starting: delete the shortcut from the startup folder.

---

## Common Problems (समस्या र समाधान)

### Problem: "Java not found"
**Solution:** Restart your computer after installing Java. If it still doesn't work, reinstall Java from https://adoptium.net/ and make sure to check "Set JAVA_HOME variable" during installation.

### Problem: Double-click on .bat does nothing / window flashes and closes
**Solution:**
1. Right-click on `start-samjhana.bat`
2. Select **"Run as administrator"**
3. If the window still closes immediately, the error will be shown before "Press any key" — take a screenshot and send to Son

### Problem: Browser shows "This site can't be reached"
**Solution:**
1. Make sure the black window is still open and running
2. Wait 30 seconds — the app takes time to start
3. Try refreshing the page

### Problem: Can't access from phone
**Solution:**
1. Make sure both devices are on the **same WiFi**
2. Make sure Windows Firewall allows Java (see Step 4)
3. Double-check the IP address — it may change if your router restarts

### Problem: App is slow
**Solution:**
1. Close other programs on the computer
2. Stop the app (close black window) and start it again

### Problem: Forgot password
**Solution:** Call Son — he can reset it from the admin panel.

---

## Need Help? (मद्दत चाहिन्छ?)

**Call Son** — He can help remotely via Tailscale!

Or send a WhatsApp message with:
1. A screenshot of the problem
2. What you were trying to do

---

## You're Ready! (तयार हुनुभयो!)

Now you can:
- Record petrol sales (पेट्रोल बिक्री रेकर्ड)
- Track EV charging (EV चार्जिंग ट्र्याक)
- Manage rentals (भाडा व्यवस्थापन)
- Track loans (ऋण ट्र्याक)
- Manage furniture stock (फर्निचर स्टक)
- Use it on your phone too! (मोबाइलमा पनि!)

**Son will review your entries from USA!**
छोराले अमेरिकाबाट तपाईंका एन्ट्रीहरू समीक्षा गर्नेछ!

---

## Quick Reference Card (छिटो सन्दर्भ कार्ड)

Print this and keep near your computer:

```
+-----------------------------------------------------------+
|         SAMJHANA VENTURES OS - QUICK START                |
|           सम्झना भेन्चर्स - छिटो सुरु                       |
+-----------------------------------------------------------+
|                                                           |
|  1. Double-click "Samjhana OS" on Desktop                 |
|     डेस्कटपमा "Samjhana OS" मा डबल-क्लिक गर्नुहोस्          |
|                                                           |
|  2. Wait for black window (don't close!)                  |
|     कालो विन्डो पर्खनुहोस् (बन्द नगर्नुहोस्!)                |
|                                                           |
|  3. Open Chrome, type: localhost:8080                     |
|     Chrome खोल्नुहोस्, टाइप गर्नुहोस्: localhost:8080        |
|                                                           |
|  4. Login: dad / dad123                                   |
|     लगइन: dad / dad123                                    |
|                                                           |
|  5. Tap the business button to add entry                  |
|     एन्ट्री थप्न व्यापार बटनमा ट्याप गर्नुहोस्               |
|                                                           |
|  PHONE: Same WiFi, open 192.168.x.x:8080                 |
|  मोबाइल: उही WiFi, 192.168.x.x:8080 खोल्नुहोस्            |
|                                                           |
|  STOP: Close the black window                             |
|  बन्द: कालो विन्डो बन्द गर्नुहोस्                           |
|                                                           |
|  HELP: Call Son! | मद्दत: छोरालाई फोन गर्नुहोस्!           |
+-----------------------------------------------------------+
```
