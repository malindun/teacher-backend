import crypto from "crypto";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

const db = admin.firestore();

// AES decrypt
function decrypt(data) {

  const key = crypto
    .createHash("sha256")
    .update(process.env.AES_SECRET)
    .digest();

  const parts = data.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export default async function handler(req, res) {

  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { studentId, idToken } = req.body;

    if (!studentId || !idToken) {
      return res.status(400).json({ error: "Missing data" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const doc = await db.collection("students").doc(studentId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Student not found" });
    }

    const data = doc.data();

    const phoneMom = decrypt(data.phoneMomEncrypted);
    const phoneDad = decrypt(data.phoneDadEncrypted);

    res.status(200).json({
      studentId,
      phoneMom,
      phoneDad
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Server error",
      message: err.message
    });

  }
}
