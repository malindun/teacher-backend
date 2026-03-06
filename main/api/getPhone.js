import crypto from "crypto";
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
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { encryptedList, idToken } = req.body; // Expecting an array of strings

    // 1. Security Check
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    await admin.auth().verifyIdToken(idToken);

    const key = crypto.createHash("sha256").update(process.env.SECRET_KEY).digest();

    // 2. Map through the list and decrypt each
    const decryptedList = encryptedList.map(item => {
      try {
        if (!item || item === 'N/A') return 'N/A';
        
        const parts = item.split(":");
        const iv = Buffer.from(parts.shift(), "hex");
        const encryptedText = parts.join(":");

        const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
        let decrypted = decipher.update(encryptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        
        return decrypted;
      } catch (e) {
        return "Decryption Error";
      }
    });

    return res.status(200).json({ phones: decryptedList });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
