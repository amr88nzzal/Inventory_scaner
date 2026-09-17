import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./src/screens/LoginScreen";
import TaskListScreen from "./src/screens/TaskListScreen";
import AuditScanScreen from "./src/screens/AuditScanScreen";
import NewItemScreen from "./src/screens/NewItemScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: "تسجيل الدخول" }} />
        <Stack.Screen name="TaskList" component={TaskListScreen} options={{ title: "مهام الجرد" }} />
        <Stack.Screen name="AuditScan" component={AuditScanScreen} options={{ title: "تنفيذ الجرد" }} />
        <Stack.Screen name="NewItem" component={NewItemScreen} options={{ title: "تسجيل مادة جديدة" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
