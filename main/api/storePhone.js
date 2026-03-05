import crypto from "crypto";
import admin from "firebase-admin";

// Initialize Firebase Admin (Singleton)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Fixes the private key formatting from environment variables
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { studentId, phoneMom, phoneDad, idToken } = req.body;

    // 1. Verify Authentication (Optional but recommended)
    let uid = "anonymous";
    if (idToken) {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    }

    // 2. Encryption Logic
    const secret = process.env.SECRET_KEY;
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = crypto.randomBytes(16);

    const encrypt = (text) => {
      if (!text) return null;
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    };

    const momEncrypted = encrypt(phoneMom);
    const dadEncrypted = encrypt(phoneDad);

    // 3. ACTUAL SAVE TO FIRESTORE
    const dataToStore = {
      studentId,
      momEncrypted,
      dadEncrypted,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid
    };

    // This creates/updates a document in the "student_phones" collection
    await db.collection("student_phones").doc(studentId).set(dataToStore, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Data saved to Firestore",
      studentId
    });

  } catch (err) {
    console.error("Firestore Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
