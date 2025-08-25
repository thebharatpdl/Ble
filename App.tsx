import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Text, Button, FlatList, TouchableOpacity, View, 
  PermissionsAndroid, Platform, StyleSheet, Animated, 
  Easing, ScrollView 
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const HEART_RATE_SERVICE = '0000180D-0000-1000-8000-00805f9b34fb';
const HEART_RATE_CHAR = '00002A37-0000-1000-8000-00805f9b34fb';
const BATTERY_SERVICE = '0000180F-0000-1000-8000-00805f9b34fb';
const BATTERY_LEVEL_CHAR = '00002A19-0000-1000-8000-00805f9b34fb';

const manager = new BleManager();

// Custom Hook for BLE functionality
const useBLE = () => {
  const [devices, setDevices] = useState<Map<string, Device>>(new Map());
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(granted).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
      } catch (e) {
        setError('Permission request failed');
        return false;
      }
    }
    return true;
  };

  const startScan = useCallback(async () => {
    const ok = await requestPermissions();
    if (!ok) return;

    setDevices(new Map());
    setIsScanning(true);
    setError(null);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        setError(`Scan error: ${error.message}`);
        setIsScanning(false);
        return;
      }
      if (device && device.name) {
        setDevices(prev => {
          if (!prev.has(device.id)) {
            const next = new Map(prev);
            next.set(device.id, device);
            return next;
          }
          return prev;
        });
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  }, []);

  const decodeHeartRate = (base64Value?: string | null): number | null => {
    if (!base64Value) return null;
    try {
      const data = Buffer.from(base64Value, 'base64');
      const flags = data.readUInt8(0);
      const hrFormat = flags & 0x01;
      return hrFormat ? data.readUInt16LE(1) : data.readUInt8(1);
    } catch (e) {
      console.log('Decode error:', e);
      return null;
    }
  };

  const connectToDevice = useCallback(async (device: Device) => {
    try {
      manager.stopDeviceScan();
      const d = await device.connect();
      await d.discoverAllServicesAndCharacteristics();
      setConnectedDevice(d);
      
      // Subscribe to heart rate
      manager.monitorCharacteristicForDevice(d.id, HEART_RATE_SERVICE, HEART_RATE_CHAR, (error, char) => {
        if (error) {
          setError(`Notification error: ${error.message}`);
          return;
        }
        const hr = decodeHeartRate(char?.value);
        if (hr !== null) {
          setHeartRate(hr);
          setNotifications(prev => [`HR: ${hr}bpm - ${new Date().toLocaleTimeString()}`, ...prev.slice(0, 9)]);
        }
      });

      // Try to read battery level
      try {
        const batteryChar = await d.readCharacteristicForService(BATTERY_SERVICE, BATTERY_LEVEL_CHAR);
        if (batteryChar?.value) {
          const data = Buffer.from(batteryChar.value, 'base64');
          setBatteryLevel(data.readUInt8(0));
        }
      } catch (e) {
        console.log('Battery service not available');
      }
      
    } catch (e) {
      setError('Connection failed');
      console.log('Connect error:', e);
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    if (!connectedDevice) return;
    try {
      await manager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      setHeartRate(null);
      setBatteryLevel(null);
      setNotifications([]);
    } catch (e) {
      setError('Disconnect failed');
      console.log('Disconnect error:', e);
    }
  }, [connectedDevice]);

  return {
    devices,
    connectedDevice,
    heartRate,
    batteryLevel,
    isScanning,
    notifications,
    error,
    startScan,
    connectToDevice,
    disconnectDevice,
    clearError: () => setError(null)
  };
};

// Animated Heart Component
const HeartAnimation = ({ rate }: { rate: number | null }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (rate) {
      const pulseDuration = 60000 / rate; // ms per beat
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: pulseDuration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: pulseDuration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [rate]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
      <Text style={{ fontSize: 60 }}>❤️</Text>
    </Animated.View>
  );
};

export default function App() {
  const {
    devices,
    connectedDevice,
    heartRate,
    batteryLevel,
    isScanning,
    notifications,
    error,
    startScan,
    connectToDevice,
    disconnectDevice,
    clearError
  } = useBLE();

  // Auto-reconnect effect
  useEffect(() => {
    if (!connectedDevice) return;
    
    const subscription = manager.onDeviceDisconnected(connectedDevice.id, (error, device) => {
      if (device) {
        console.log("Device disconnected. Reconnecting...");
        connectToDevice(device);
      }
    });
    
    return () => subscription.remove();
  }, [connectedDevice, connectToDevice]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Smartwatch Heart Rate Monitor</Text>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Dismiss" onPress={clearError} />
        </View>
      )}
      
      <Button 
        title={isScanning ? 'Scanning...' : 'Scan for Devices'} 
        onPress={startScan} 
        disabled={isScanning} 
      />

      {!connectedDevice ? (
        <FlatList
          data={Array.from(devices.values())}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => connectToDevice(item)}
              style={styles.deviceItem}
            >
              <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
              <Text style={styles.deviceId}>{item.id}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {isScanning ? 'Scanning for devices...' : 'No devices found. Press Scan to search.'}
            </Text>
          }
        />
      ) : (
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedText}>
            Connected to: {connectedDevice.name || connectedDevice.id}
          </Text>
          
          {batteryLevel !== null && (
            <Text style={styles.batteryText}>Battery: {batteryLevel}%</Text>
          )}
          
          <HeartAnimation rate={heartRate} />
          
          <Text style={styles.heartRateText}>
            {heartRate !== null ? `${heartRate} bpm` : 'Reading...'}
          </Text>
          
          <Button title="Disconnect" onPress={disconnectDevice} />
          
          <Text style={styles.notificationsTitle}>Recent Readings:</Text>
          <ScrollView style={styles.notificationsContainer}>
            {notifications.map((note, index) => (
              <Text key={index} style={styles.notificationText}>{note}</Text>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 8,
  },
  deviceItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceName: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  connectedContainer: {
    marginTop: 16,
    flex: 1,
  },
  connectedText: {
    fontSize: 18,
    marginBottom: 8,
  },
  batteryText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  heartRateText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#e74c3c',
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  notificationsContainer: {
    flex: 1,
  },
  notificationText: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 4,
    marginBottom: 4,
  },
});