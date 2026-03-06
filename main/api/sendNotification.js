import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { studentId, title, body, idToken } = req.body;

    // 1. Verify Teacher Identity
    await admin.auth().verifyIdToken(idToken);

    const db = admin.firestore();

    // 2. Fetch the Student's FCM Token
    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found");
    
    const fcmToken = studentDoc.data().fcmToken;

    // 3. Save to Firestore Notifications Collection
    await db.collection("student_notifications").add({
      studentId,
      title,
      body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    // 4. Send the Push Notification if token exists
    if (fcmToken) {
      const message = {
        notification: { title, body },
        token: fcmToken,
        webpush: {
          fcm_options: {
            link: "https://your-student-site-url.com/notifications"
          }
        }
      };
      await admin.messaging().send(message);
    }

    return res.status(200).json({ success: true, pushed: !!fcmToken });

  } catch (err) {
    console.error("Notification Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
