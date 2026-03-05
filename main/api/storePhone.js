import crypto from "crypto";
import admin from "firebase-admin";

// 1. Robust Firebase Initialization
if (!admin.apps.length) {
  try {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountVar) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
    }
    
    // Parse JSON only once during initialization
    const serviceAccount = JSON.parse(serviceAccountVar);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error.message);
    // In production, you might want to throw or exit here
  }
}

const db = admin.firestore();

// 2. Optimized Encryption Key (Generated once outside the handler)
const AES_SECRET = process.env.AES_SECRET || "default_fallback_secret_change_me";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(AES_SECRET).digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export default async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 3. Verify Firebase Auth Token
    // verifyIdToken throws if invalid, so no need for an extra "if (!decoded)"
    const decoded = await admin.auth().verifyIdToken(idToken);
    const userId = decoded.uid; // Optional: use this for security rules/logging

    const momEncrypted = encrypt(phoneMom);
    const dadEncrypted = encrypt(phoneDad);

    // 4. Update Firestore using merge to prevent "document not found" errors
    await db.collection("students").doc(studentId).set({
      phoneMomEncrypted: momEncrypted,
      phoneDadEncrypted: dadEncrypted,
      phoneEncrypted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedBy: userId // Good practice for auditing
    }, { merge: true });

    return res.status(200).json({ success: true, studentId });

  } catch (err) {
    console.error("Handler Error:", err);
    
    // Specific error handling for Auth
    if (err.code?.startsWith('auth/')) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    }

    return res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
}
