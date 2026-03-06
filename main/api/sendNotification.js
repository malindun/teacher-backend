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
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const { studentId, title, body } = req.body; // studentId here is the UID
    const db = admin.firestore();

    // 1. Log notification to the inbox
    const docRef = await db.collection("student_notifications").add({
      studentId: studentId, 
      title,
      body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "sent"
    });

    // 2. Find the student document by ownerUid field
    const studentQuery = await db.collection("students")
      .where("ownerUid", "==", studentId)
      .limit(1)
      .get();

    if (studentQuery.empty) {
      return res.status(200).json({ 
        success: true, 
        message: "Logged to DB, but no student profile found for this UID.",
        docId: docRef.id 
      });
    }

    const studentData = studentQuery.docs[0].data();
    const fcmToken = studentData.fcmToken;

    if (!fcmToken) {
      return res.status(200).json({ 
        success: true, 
        message: "Logged to DB, but student has no FCM token.",
        docId: docRef.id 
      });
    }

    // 3. Send the Push Notification
    const message = {
      notification: { title, body },
      token: fcmToken,
    };

    await admin.messaging().send(message);

    return res.status(200).json({ 
      success: true, 
      message: "Push notification sent successfully!" 
    });

  } catch (error) {
    console.error("Vercel Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
