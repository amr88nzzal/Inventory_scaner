import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";

// Show notifications even while the app is in the foreground — an employee
// mid-audit should still see "مهمة جرد جديدة" arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Call this once after login: asks for permission, gets the Expo/FCM push
// token, and registers it on the server so task-assignment and recount
// notifications can reach this device.
export async function registerForPushNotifications() {
  if (!Device.isDevice) return; // push tokens don't work on simulators

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== "granted") return;

  const tokenResponse = await Notifications.getDevicePushTokenAsync(); // native FCM/APNs token
  await api.registerFcmToken(tokenResponse.data);
}

// Tapping a notification (e.g. "مهمة جرد جديدة") should take the employee
// straight to that task. Wire this up in App.tsx with your navigation ref.
export function onNotificationTapped(callback: (taskId: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const taskId = response.notification.request.content.data?.taskId as string | undefined;
    if (taskId) callback(taskId);
  });
}
