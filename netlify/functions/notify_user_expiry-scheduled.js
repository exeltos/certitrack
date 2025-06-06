const fetch = require("node-fetch");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async () => {
  try {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const expiredUsers = [];

    // Έλεγχος σε πίνακα suppliers
    const { data: expiredSuppliers } = await supabase
      .from("suppliers")
      .select("email, name, registration_date")
      .lt("registration_date", oneYearAgo.toISOString());

    if (expiredSuppliers?.length) {
      expiredUsers.push(
        ...expiredSuppliers.map((s) => ({
          title: `Λήξη συνδρομής προμηθευτή: ${s.email}`,
        }))
      );
    }

    // Έλεγχος σε πίνακα companies
    const { data: expiredCompanies } = await supabase
      .from("companies")
      .select("email, name, registration_date")
      .lt("registration_date", oneYearAgo.toISOString());

    if (expiredCompanies?.length) {
      expiredUsers.push(
        ...expiredCompanies.map((c) => ({
          title: `Λήξη συνδρομής εταιρείας: ${c.email}`,
        }))
      );
    }

    if (expiredUsers.length === 0) {
      console.log("🔍 Δεν υπάρχουν ληγμένοι χρήστες σήμερα.");
      return { statusCode: 200, body: JSON.stringify({ message: "No expired users" }) };
    }

    await fetch("https://www.certitrack.gr/.netlify/functions/send_email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "info@exeltos.com",
        type: "user_event",
        certificates: expiredUsers,
        subject: "🚫 Λήξη Χρηστών"
      })
    });

    console.log("📤 Εστάλη ενημέρωση admin για ληγμένους χρήστες.");
    return { statusCode: 200, body: JSON.stringify({ sent: true, count: expiredUsers.length }) };
  } catch (err) {
    console.error("❌ Σφάλμα στον έλεγχο λήξης:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
};
