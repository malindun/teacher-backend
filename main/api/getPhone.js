import crypto from "crypto";
import admin from "firebase-admin";

// Initialize Admin (Singleton)
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
    const { encrypted, idToken } = req.body;

    // 1. SECURITY CHECK: Verify the Teacher's Token
    if (!idToken) return res.status(401).json({ error: "No authentication token provided" });
    await admin.auth().verifyIdToken(idToken);

    // 2. DECRYPTION LOGIC
    const key = crypto.createHash("sha256").update(process.env.SECRET_KEY).digest();
    const parts = encrypted.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = parts.join(":");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return res.status(200).json({ phone: decrypted });

  } catch (err) {
    return res.status(500).json({ error: "Decryption failed or unauthorized: " + err.message });
  }
}
