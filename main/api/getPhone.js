import crypto from "crypto";
import admin from "firebase-admin";

// Initialize Firebase Admin (Singleton pattern to prevent "App already exists" errors)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Critical: Replace escaped newlines from Vercel env variables
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  // 1. Setup CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { encrypted, idToken } = req.body;

    // 2. Validate Inputs
    if (!encrypted || !encrypted.includes(":")) {
      console.error("Invalid data received:", encrypted);
      return res.status(400).json({ error: "Invalid encrypted string format. Expected 'iv:hash'" });
    }

    if (!idToken) {
      return res.status(401).json({ error: "Authentication required (idToken missing)" });
    }

    // 3. Verify Identity
    // This ensures only your logged-in teachers/users can decrypt data
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (authError) {
      return res.status(401).json({ error: "Invalid or expired session. Please re-login." });
    }

    // 4. Decryption Logic
    const key = crypto
      .createHash("sha256")
      .update(process.env.SECRET_KEY)
      .digest();

    // Splitting the IV (first 32 hex chars) from the encrypted hash
    const parts = encrypted.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = parts.join(":");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    // 5. Success Response
    return res.status(200).json({
      phone: decrypted
    });

  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({
      error: "Decryption failed: " + err.message
    });
  }
}
