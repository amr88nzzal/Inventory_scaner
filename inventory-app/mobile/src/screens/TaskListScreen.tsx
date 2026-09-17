import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { api } from "../services/api";
import { watchConnectivityAndFlush } from "../services/offlineQueue";

export default function TaskListScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      setTasks(await api.myTasks());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // Whenever the phone regains connectivity, silently flush any queued
    // offline scans in the background — the employee doesn't need to do
    // anything for this to happen.
    const unsubscribe = watchConnectivityAndFlush((count) =>
      console.log(`تمت مزامنة ${count} حركة جرد`)
    );
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>مهام الجرد المسندة إليّ</Text>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("AuditScan", { task: item })}
          >
            <Text style={styles.taskNumber}>{item.taskNumber}</Text>
            <Text>{item.warehouse?.name}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد مهام جرد حالياً</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  card: { padding: 16, borderRadius: 10, backgroundColor: "#f2f2f2", marginBottom: 10 },
  taskNumber: { fontWeight: "700", fontSize: 16 },
  status: { color: "#666", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: "#888" },
});
