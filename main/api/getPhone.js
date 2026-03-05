import crypto from "crypto";
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function decrypt(text) {
  const key = crypto
    .createHash("sha256")
    .update(process.env.AES_SECRET_KEY)
    .digest();

  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");

  const encryptedText = parts[1];

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
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

    const { studentId, idToken } = req.body;

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const teacherDoc = await db.collection("teachers").doc(uid).get();

    if (!teacherDoc.exists) {
      return res.status(403).json({ error: "Not a teacher" });
    }

    const studentDoc = await db.collection("students").doc(studentId).get();

    if (!studentDoc.exists) {
      return res.status(404).json({ error: "Student not found" });
    }

    const data = studentDoc.data();

    const phoneMom = decrypt(data.phoneMomEncrypted);
    const phoneDad = decrypt(data.phoneDadEncrypted);

    return res.json({
      phoneMom,
      phoneDad
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
