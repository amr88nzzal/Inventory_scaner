import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, DEFAULT_API_URL } from "../services/api";
import { registerForPushNotifications } from "../services/pushNotifications";

export default function LoginScreen({ navigation }: any) {
  const [username, setUsername] = useState("auditor1");
  const [password, setPassword] = useState("auditor123");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("custom_api_url").then((saved) => {
      if (saved) setApiUrl(saved);
    });
  }, []);

  async function handleLogin() {
    setLoading(true);
    try {
      if (apiUrl.trim()) {
        await AsyncStorage.setItem("custom_api_url", apiUrl.trim());
      }
      const { token, user } = await api.login(username, password);
      await AsyncStorage.setItem("auth_token", token);
      await AsyncStorage.setItem("current_user", JSON.stringify(user));
      registerForPushNotifications().catch(() => null); // best-effort, never blocks login
      navigation.replace("TaskList");
    } catch (e: any) {
      Alert.alert("خطأ في تسجيل الدخول", e.message || "تأكد من صحة البيانات والاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>تطبيق الجرد الميداني 📱</Text>
      <Text style={styles.subtitle}>تسجيل دخول الموظف للجرد والمسح</Text>

      <TextInput
        style={styles.input}
        placeholder="اسم المستخدم"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={styles.buttonContainer}>
        <Button title={loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"} onPress={handleLogin} disabled={loading} color="#2563eb" />
      </View>

      <TouchableOpacity onPress={() => setShowConfig(!showConfig)} style={styles.toggleConfig}>
        <Text style={styles.toggleConfigText}>
          {showConfig ? "إخفاء إعدادات السيرفر ▲" : "⚙️ إعدادات رابط السيرفر ▼"}
        </Text>
      </TouchableOpacity>

      {showConfig && (
        <View style={styles.configBox}>
          <Text style={styles.configLabel}>رابط خادم النظام (API URL):</Text>
          <TextInput
            style={[styles.input, styles.configInput]}
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            placeholder="https://.../api"
          />
        </View>
      )}

      <View style={styles.demoBox}>
        <Text style={styles.demoTitle}>حسابات تجريبية جاهزة:</Text>
        <TouchableOpacity onPress={() => { setUsername("auditor1"); setPassword("auditor123"); }}>
          <Text style={styles.demoItem}>👤 الموظف: auditor1 / auditor123 (اضغط للتعبئة)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setUsername("admin"); setPassword("admin123"); }}>
          <Text style={styles.demoItem}>👑 المشرف: admin / admin123 (اضغط للتعبئة)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 6, textAlign: "center", color: "#0f172a" },
  subtitle: { fontSize: 13, color: "#64748b", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 12, marginBottom: 14, backgroundColor: "#ffffff", fontSize: 15 },
  buttonContainer: { marginTop: 4, marginBottom: 12 },
  toggleConfig: { alignItems: "center", marginVertical: 10 },
  toggleConfigText: { color: "#475569", fontSize: 13, textDecorationLine: "underline" },
  configBox: { backgroundColor: "#e2e8f0", padding: 12, borderRadius: 8, marginBottom: 14 },
  configLabel: { fontSize: 12, fontWeight: "600", color: "#334155", marginBottom: 6 },
  configInput: { backgroundColor: "#ffffff", marginBottom: 0, fontSize: 12 },
  demoBox: { marginTop: 20, padding: 12, backgroundColor: "#eff6ff", borderRadius: 8, borderWidth: 1, borderColor: "#bfdbfe" },
  demoTitle: { fontSize: 12, fontWeight: "bold", color: "#1e40af", marginBottom: 6 },
  demoItem: { fontSize: 12, color: "#1d4ed8", marginVertical: 3 },
});
