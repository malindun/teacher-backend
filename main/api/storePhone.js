import crypto from "crypto";
import admin from "firebase-admin";

export default async function handler(req, res) {
  // --- STEP 1: SET HEADERS IMMEDIATELY ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- STEP 2: HANDLE PREFLIGHT ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Initialize Firebase inside the handler to catch initialization errors
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = admin.firestore();
    const { studentId, phoneMom, phoneDad } = req.body;

    // Encryption
    const secret = process.env.SECRET_KEY;
    if (!secret) throw new Error("SECRET_KEY is missing in Vercel Env");

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

    // --- STEP 3: FIRESTORE WRITE ---
    await db.collection("students").doc(studentId).set({
      momEncrypted,
      dadEncrypted,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, message: "Saved to Firestore" });

  } catch (err) {
    // Since CORS headers are already set, you will now see THIS error in your console
    return res.status(500).json({ error: err.message });
  }
}
