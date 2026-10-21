const express = require("express");
const router = express.Router();
const db = require("../db");

/* ------------------------------------------------------------------ */
/* POST /api/contact  — submit a contact form                          */
/* ------------------------------------------------------------------ */
router.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, mobile, enquiry, message } = req.body;

    // Basic validation
    const errors = [];
    if (!firstName || !String(firstName).trim()) errors.push("First name is required");
    if (!email || !String(email).trim()) errors.push("Email is required");
    if (!message || !String(message).trim()) errors.push("Message is required");

    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(", ") });
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket.remoteAddress ||
      null;

    const sql = `
      INSERT INTO contacts
        (first_name, last_name, email, mobile, enquiry, message, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(sql, [
      String(firstName).trim(),
      lastName ? String(lastName).trim() : null,
      String(email).trim(),
      mobile ? String(mobile).trim() : null,
      enquiry ? String(enquiry).trim() : null,
      String(message).trim(),
      ip,
    ]);

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error("POST /api/contact error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save contact message",
      error: err.message,
    });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/contact  — list all contacts (admin)                       */
/* ------------------------------------------------------------------ */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT id, first_name, last_name, email, mobile, enquiry, message,
              status, ip_address, created_at, updated_at
       FROM contacts
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM contacts");

    return res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /api/contact error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch contacts" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /api/contact/:id — single contact                               */
/* ------------------------------------------------------------------ */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM contacts WHERE id = ?", [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET /api/contact/:id error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch contact" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/contact/:id/status — update status (admin)               */
/* ------------------------------------------------------------------ */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["new", "read", "replied", "closed"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(", ")}`,
      });
    }

    const [result] = await db.execute("UPDATE contacts SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }

    return res.json({ success: true, message: "Status updated" });
  } catch (err) {
    console.error("PATCH /api/contact/:id/status error:", err);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/contact/:id — remove contact (admin)                    */
/* ------------------------------------------------------------------ */
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await db.execute("DELETE FROM contacts WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Contact not found" });
    }
    return res.json({ success: true, message: "Contact deleted" });
  } catch (err) {
    console.error("DELETE /api/contact/:id error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete contact" });
  }
});

module.exports = router;