import React, { useState } from "react";
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "../services/api";
import { enqueueUnregisteredItem } from "../services/offlineQueue";

// Reached from AuditScanScreen when a scanned barcode has no matching Item.
// Captures everything the admin needs to review and approve the new item:
// product photo, barcode photo, name, price, and the counted quantity.
export default function NewItemScreen({ route, navigation }: any) {
  const { barcode, taskId } = route.params;
  const [productPhoto, setProductPhoto] = useState<string | null>(null);
  const [barcodePhoto, setBarcodePhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  async function takePhoto(setter: (uri: string) => void) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("إذن مطلوب", "يحتاج التطبيق إذن الوصول للكاميرا لالتقاط الصورة");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: false });
    if (!result.canceled && result.assets?.[0]?.uri) setter(result.assets[0].uri);
  }

  async function handleSave() {
    if (!productPhoto || !barcodePhoto) {
      Alert.alert("ناقص", "صورة المنتج وصورة الباركود إلزاميتان");
      return;
    }
    setSaving(true);
    const payload = {
      taskId,
      barcode,
      name: name || undefined,
      price: price ? Number(price) : undefined,
      quantity: quantity ? Number(quantity) : undefined,
      // In production these URIs are uploaded to storage first (e.g. S3 /
      // a self-hosted bucket) and the resulting URLs are sent instead.
      photoProductUrl: productPhoto,
      photoBarcodeUrl: barcodePhoto,
    };
    try {
      await api.reportUnregisteredItem(payload);
      Alert.alert("تم", "أُرسلت المادة لقائمة مراجعة الأدمن");
      navigation.goBack();
    } catch {
      // Offline: queue it exactly like a normal audit record so it syncs later.
      await enqueueUnregisteredItem(payload);
      Alert.alert("تم الحفظ محلياً", "سيتم إرسال المادة تلقائياً عند توفر الاتصال");
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>تسجيل مادة جديدة</Text>
      <Text style={styles.barcode}>الباركود: {barcode}</Text>

      <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setProductPhoto)}>
        {productPhoto ? (
          <Image source={{ uri: productPhoto }} style={styles.photoPreview} />
        ) : (
          <Text>📷 صورة المنتج (إلزامي)</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setBarcodePhoto)}>
        {barcodePhoto ? (
          <Image source={{ uri: barcodePhoto }} style={styles.photoPreview} />
        ) : (
          <Text>📷 صورة الباركود (إلزامي)</Text>
        )}
      </TouchableOpacity>

      <TextInput style={styles.input} placeholder="اسم المادة" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="السعر" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <TextInput style={styles.input} placeholder="الكمية الموجودة" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? "جارٍ الحفظ..." : "حفظ وإرسال للمراجعة"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  barcode: { color: "#666", marginBottom: 16 },
  photoBox: {
    height: 140,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 },
  saveBtn: { backgroundColor: "#2e7d32", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700" },
});
