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
  // CORS Headers for testing
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { studentId, title, body } = req.body;
    const db = admin.firestore();

    // 1. Log the attempt in student_notifications
    const docRef = await db.collection("student_notifications").add({
      studentId,
      title,
      body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending_fcm" 
    });

    // 2. Try to find the token
    const studentDoc = await db.collection("students").doc(studentId).get();
    const fcmToken = studentDoc.exists ? studentDoc.data().fcmToken : null;

    if (!fcmToken) {
      return res.status(200).json({ 
        success: true, 
        message: "Saved to Firestore, but no FCM token found for this student yet.",
        docId: docRef.id
      });
    }

    // 3. Trigger the actual Push Notification
    const message = {
      notification: { title, body },
      token: fcmToken,
    };

    await admin.messaging().send(message);

    return res.status(200).json({ success: true, message: "Push sent successfully!" });

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
