// Thin wrapper around firebase-admin so the rest of the app never touches
// the SDK directly. Requires a Firebase service account JSON — set
// GOOGLE_APPLICATION_CREDENTIALS to its path, or FIREBASE_SERVICE_ACCOUNT_JSON
// to the raw JSON content (handy for containerized deployments).
import { prisma } from "../prisma";

let messaging: import("firebase-admin/messaging").Messaging | null = null;

function getMessaging() {
  if (messaging) return messaging;
  const admin = require("firebase-admin");
  if (admin.apps.length === 0) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    admin.initializeApp({
      credential: raw
        ? admin.credential.cert(JSON.parse(raw))
        : admin.credential.applicationDefault(),
    });
  }
  messaging = admin.messaging();
  return messaging;
}

export async function notifyUser(userId: string, title: string, body: string, data: Record<string, string> = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
  if (!user?.fcmToken) return; // employee hasn't registered a device yet, or notifications are disabled

  try {
    await getMessaging()!.send({
      token: user.fcmToken,
      notification: { title, body },
      data,
    });
  } catch (err) {
    // Never let a notification failure break the calling request (e.g. task
    // creation must still succeed even if the push fails).
    console.error(`Failed to send FCM notification to user ${userId}:`, err);
  }
}

export async function notifyUsers(userIds: string[], title: string, body: string, data: Record<string, string> = {}) {
  await Promise.all(userIds.map((id) => notifyUser(id, title, body, data)));
}
