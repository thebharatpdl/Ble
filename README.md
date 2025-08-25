# BLE Heart Rate Monitor App

A React Native application that demonstrates **BLE device management**, **live heart rate monitoring**, and **advanced animations tied to BLE data**.

---

## 🚀 Features

### 🔹 BLE Device Manager
- Scan and display nearby BLE devices.
- Connect to a selected device.
- Subscribe to **heart rate**  notifications.
- Manual disconnect option.

### 🔹 Animations
- Heartbeat animation synchronized with real-time BLE data:
  - **Scaling and color changes** based on BPM.
  - Smooth pulse transitions.
  - Dynamic visual feedback for user engagement.

### 🔹 Architecture & Code Quality
- Clear separation of concerns:
  - `hooks/useBLE.ts` → BLE logic (scan, connect, notifications).
  - `components/HeartAnimation.tsx` → Animated heart visualization.
  - `components/NotificationItem.tsx` → Displays recent BLE notifications.
  - `screens/HomeScreen.tsx` → Main user interface.
- Handles **permissions** and **edge cases**:
  - Android BLE permissions.
  - Device disconnects.
  - Missing battery characteristics.

---

## 📡 BLE Implementation

The app uses **`react-native-ble-plx`** for BLE communication.  

### Key Features:
- **Scanning** for nearby devices.
- **Connecting** to heart rate monitors.
- **Subscribing** to heart rate characteristic notifications.
- Allow manual disconnect

---

## 🔑 Permissions Handling

### Android
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`






## 🛠️Setup Instructions

1. **Clone the repository**

```bash
git clone <url>
cd <project-folder>



2. Install dependencies

npm install
# or
yarn install


3.Run the app

Android
npx react-native run-android


