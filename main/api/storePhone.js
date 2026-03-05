import crypto from "crypto";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { studentId, phoneMom, phoneDad } = req.body;

    const key = crypto
      .createHash("sha256")
      .update(process.env.SECRET_KEY)
      .digest();

    const iv = crypto.randomBytes(16);

    function encrypt(text) {
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
