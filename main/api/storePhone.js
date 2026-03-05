import crypto from "crypto";
import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

// AES encryption
function encrypt(text) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.AES_SECRET)
    .digest();

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

export default async function handler(req, res) {

  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { studentId, phoneMom, phoneDad, idToken } = req.body;

    if (!studentId || !phoneMom || !phoneDad || !idToken) {
      return res.status(400).json({ error: "Missing data" });
    }

    // Verify Firebase Auth token
    const decoded = await admin.auth().verifyIdToken(idToken);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const momEncrypted = encrypt(phoneMom);
    const dadEncrypted = encrypt(phoneDad);

    await db.collection("students").doc(studentId).update({
      phoneMomEncrypted: momEncrypted,
      phoneDadEncrypted: dadEncrypted,
      phoneEncrypted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      success: true,
      studentId
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Server error",
      message: err.message
    });

  }
}
