import crypto from "crypto";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function encrypt(text) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.AES_SECRET_KEY)
    .digest();

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

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

    // 🔐 Verify Firebase user
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    console.log("Verified user:", uid);

    // (Optional) check teacher role
    const teacherDoc = await db.collection("teachers").doc(uid).get();

    if (!teacherDoc.exists) {
      return res.status(403).json({ error: "Not a teacher" });
    }

    const momEncrypted = encrypt(phoneMom);
    const dadEncrypted = encrypt(phoneDad);

    await db.collection("students").doc(studentId).update({
      phoneMomEncrypted: momEncrypted,
      phoneDadEncrypted: dadEncrypted
    });

    return res.json({
      success: true,
      studentId
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
