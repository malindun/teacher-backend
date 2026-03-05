import crypto from "crypto";

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    const { encrypted } = req.body;

    const key = crypto
      .createHash("sha256")
      .update(process.env.SECRET_KEY)
      .digest();

    const parts = encrypted.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = parts.join(":");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return res.status(200).json({
      phone: decrypted
    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

}
