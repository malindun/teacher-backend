import crypto from "crypto";

export default async function handler(req, res) {
  // Standard CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // 1. Handle Preflight (The browser sends this first)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 2. Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { studentId, phoneMom, phoneDad, idToken } = req.body;

    // SECURITY NOTE: In a real app, use firebase-admin to verify idToken here.
    if (!idToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    const key = crypto
      .createHash("sha256")
      .update(process.env.SECRET_KEY)
      .digest();

    const iv = crypto.randomBytes(16);

    // Encryption helper
    function encrypt(text) {
      if (!text) return null;
      const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      return iv.toString("hex") + ":" + encrypted;
    }

    const momEncrypted = encrypt(phoneMom);
    const dadEncrypted = encrypt(phoneDad);

    return res.status(200).json({
      success: true,
      studentId,
      momEncrypted,
      dadEncrypted
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
