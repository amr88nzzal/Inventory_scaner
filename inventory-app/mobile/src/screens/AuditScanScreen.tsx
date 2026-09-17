import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Picker as RNPicker,
  TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import { enqueueRecord, getRecentFromQueue, flushQueue, QueuedRecord } from "../services/offlineQueue";

// Local cache of item lookups so scanning still works while fully offline,
// as long as the item was seen at least once since the app last synced.
async function getCachedItem(barcode: string) {
  const raw = await AsyncStorage.getItem(`item_cache_${barcode}`);
  return raw ? JSON.parse(raw) : null;
}
async function cacheItem(barcode: string, item: any) {
  await AsyncStorage.setItem(`item_cache_${barcode}`, JSON.stringify(item));
}

export default function AuditScanScreen({ route, navigation }: any) {
  const { task } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [currentItem, setCurrentItem] = useState<any | null>(null);
  const [currentBarcode, setCurrentBarcode] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [locationLabel, setLocationLabel] = useState<string>(task.warehouse?.locations?.[0]?.label ?? "");
  const lastScanRef = useRef<string | null>(null);
  const [recent, setRecent] = useState<QueuedRecord[]>([]);
  const [typedQty, setTypedQty] = useState<string>("1");

  useEffect(() => {
    requestPermission();
    refreshRecent();
  }, []);

  async function refreshRecent() {
    setRecent(await getRecentFromQueue(task.id, 5));
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    // Debounce: continuous rapid scanning mode ignores an identical barcode
    // fired twice within the same camera frame burst.
    if (data === lastScanRef.current) return;
    lastScanRef.current = data;
    setTimeout(() => (lastScanRef.current = null), 800);

    setCurrentBarcode(data);

    let item = await getCachedItem(data);
    if (!item) {
      try {
        item = await api.itemByBarcode(data);
        await cacheItem(data, item);
      } catch {
        item = null; // not found locally or on the server
      }
    }

    if (!item) {
      // Unregistered barcode: alert the employee and let them register it.
      // (Attach a short beep/error sound asset here via expo-av in the real build.)
      Alert.alert(
        "مادة غير مسجلة",
        `الباركود ${data} غير موجود في قاعدة البيانات. سجّله كمادة جديدة؟`,
        [
          { text: "إلغاء", style: "cancel" },
          {
            text: "تسجيل مادة جديدة",
            onPress: () => navigation.navigate("NewItem", { barcode: data, taskId: task.id }),
          },
        ]
      );
      return;
    }

    setCurrentItem(item);
    setSelectedUnit(item.units.find((u: any) => u.isBase)?.unitName ?? item.units[0].unitName);
    setTypedQty("1");
  }

  async function confirmQuantity(qtyInUnit: number, condition: "NORMAL" | "DAMAGED" = "NORMAL") {
    if (!currentItem || !currentBarcode) return;
    const unit = currentItem.units.find((u: any) => u.unitName === selectedUnit);

    const record: QueuedRecord = {
      taskId: task.id,
      itemId: currentItem.id,
      barcodeScanned: currentBarcode,
      locationLabel,
      unitName: selectedUnit,
      qtyInUnit,
      qtyPerUnit: unit.qtyPerUnit,
      condition,
      deviceTimestamp: new Date().toISOString(),
    };

    // Always queue locally first (append-only), then try an immediate flush.
    // If offline, it just stays queued — no error shown to the employee.
    await enqueueRecord(record);
    flushQueue().catch(() => null);

    setCurrentItem(null);
    setCurrentBarcode(null);
    refreshRecent();
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>يحتاج التطبيق إذن الوصول للكاميرا لمسح الباركود</Text>
        <TouchableOpacity onPress={requestPermission}><Text>منح الإذن</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.taskTitle}>{task.taskNumber} — {locationLabel}</Text>

      {task.warehouse?.locations?.length > 0 && (
        <RNPicker selectedValue={locationLabel} onValueChange={setLocationLabel} style={styles.picker}>
          {task.warehouse.locations.map((l: any) => (
            <RNPicker.Item key={l.id} label={l.label} value={l.label} />
          ))}
        </RNPicker>
      )}

      {!currentItem ? (
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "upc_a"] }}
        />
      ) : (
        <View style={styles.confirmBox}>
          <Text style={styles.itemName}>{currentItem.name}</Text>
          {/* Blind count: system quantity is only shown when the admin allows it for this task. */}
          {!task.blindCount && <Text>الرصيد بالنظام: {currentItem.systemQty}</Text>}

          <RNPicker selectedValue={selectedUnit} onValueChange={setSelectedUnit} style={styles.picker}>
            {currentItem.units.map((u: any) => (
              <RNPicker.Item key={u.id} label={`${u.unitName} (${u.qtyPerUnit})`} value={u.unitName} />
            ))}
          </RNPicker>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>الكمية:</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={typedQty}
              onChangeText={setTypedQty}
            />
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => confirmQuantity(parseFloat(typedQty) || 1)}>
              <Text style={styles.qtyBtnText}>تأكيد</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.qtyBtn, styles.damagedBtn]} onPress={() => confirmQuantity(parseFloat(typedQty) || 1, "DAMAGED")}>
              <Text style={styles.qtyBtnText}>تأكيد (تالف)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCurrentItem(null)}>
              <Text>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.recentHeader}>آخر الحركات</Text>
      <FlatList
        data={recent}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.recentRow}>
            <Text style={{ flex: 1 }}>{item.barcodeScanned}</Text>
            <TouchableOpacity onPress={() => adjustQty(index, -1)}><Text style={styles.adjustBtn}>-</Text></TouchableOpacity>
            <Text style={styles.qtyText}>{item.qtyInUnit} {item.unitName}</Text>
            <TouchableOpacity onPress={() => adjustQty(index, 1)}><Text style={styles.adjustBtn}>+</Text></TouchableOpacity>
          </View>
        )}
      />
    </View>
  );

  // Adjusting a recent line queues a correcting record rather than mutating
  // the original — consistent with the append-only design end to end.
  async function adjustQty(index: number, delta: number) {
    const r = recent[index];
    if (!r) return;
    await enqueueRecord({ ...r, qtyInUnit: delta, deviceTimestamp: new Date().toISOString() });
    flushQueue().catch(() => null);
    refreshRecent();
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  taskTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  camera: { height: 300, borderRadius: 10, overflow: "hidden" },
  confirmBox: { padding: 16, backgroundColor: "#f2f2f2", borderRadius: 10 },
  itemName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  picker: { backgroundColor: "#fff", marginVertical: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  qtyBtn: { backgroundColor: "#2e7d32", padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, alignItems: "center" },
  damagedBtn: { backgroundColor: "#c62828" },
  qtyBtnText: { color: "#fff", fontWeight: "700" },
  cancelBtn: { padding: 12, borderRadius: 8, flex: 1, marginHorizontal: 4, alignItems: "center", backgroundColor: "#ddd" },
  recentHeader: { marginTop: 16, fontWeight: "600" },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderColor: "#eee" },
  adjustBtn: { fontSize: 20, paddingHorizontal: 12 },
  qtyText: { minWidth: 70, textAlign: "center" },
  inputContainer: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  inputLabel: { fontSize: 16, fontWeight: "600", marginRight: 8 },
  textInput: { flex: 1, backgroundColor: "#fff", padding: 10, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", textAlign: "right" },
});
