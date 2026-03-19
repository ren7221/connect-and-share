import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tuckshop_name, owner_name, owner_email } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the tuckshop that was just created
    const { data: tuckshop } = await supabaseAdmin
      .from("tuckshops")
      .select("id")
      .eq("name", tuckshop_name)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!tuckshop) {
      return new Response(JSON.stringify({ error: "Tuckshop not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create approval tokens (72h expiry)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const [{ data: approveToken }, { data: rejectToken }] = await Promise.all([
      supabaseAdmin.from("approval_tokens").insert({
        tuckshop_id: tuckshop.id,
        action: "approve",
        expires_at: expiresAt,
      }).select("token").single(),
      supabaseAdmin.from("approval_tokens").insert({
        tuckshop_id: tuckshop.id,
        action: "reject",
        expires_at: expiresAt,
      }).select("token").single(),
    ]);

    // Find super admin email
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No super admin found to notify");
      return new Response(JSON.stringify({ message: "No super admin to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserIds = adminRoles.map((r) => r.user_id);
    const { data: adminProfiles } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", adminUserIds);

    const adminEmails = adminProfiles?.map((p) => p.email).filter(Boolean) || [];

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(JSON.stringify({ message: "No admin emails found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const approveUrl = `${baseUrl}/functions/v1/approve-tuckshop?token=${approveToken?.token}&action=approve`;
    const rejectUrl = `${baseUrl}/functions/v1/approve-tuckshop?token=${rejectToken?.token}&action=reject`;
    const timestamp = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" });

    const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#1a7a4e 0%,#d4a017 100%);padding:32px;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">MUST Business</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">New Tuckshop Registration</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1a1a1a;margin:0 0 20px;font-size:18px;">New Registration Awaiting Approval</h2>
    <table width="100%" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Tuckshop Name</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#1a1a1a;">${tuckshop_name}</td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Owner Name</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#1a1a1a;">${owner_name}</td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#1a1a1a;">${owner_email}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Registered</td><td style="padding:12px 16px;color:#1a1a1a;">${timestamp}</td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" style="padding-right:8px;">
        <a href="${approveUrl}" style="display:block;background:#16a34a;color:white;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;font-size:14px;text-align:center;">✅ Approve</a>
      </td>
      <td width="48%" style="padding-left:8px;">
        <a href="${rejectUrl}" style="display:block;background:#dc2626;color:white;text-decoration:none;padding:14px 24px;border-radius:8px;font-weight:bold;font-size:14px;text-align:center;">❌ Reject</a>
      </td>
    </tr></table>
    <p style="color:#94a3b8;font-size:11px;margin-top:20px;text-align:center;">These links expire in 72 hours. You can also manage registrations from the Super Admin dashboard.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">MUST Business Platform • Automated Notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    // Send branded email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const email of adminEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "MUST Business <onboarding@resend.dev>",
            to: [email],
            subject: `New Tuckshop Registration: ${tuckshop_name}`,
            html: emailHTML,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          console.error(`Resend error for ${email}:`, result);
        } else {
          console.log(`Email sent to ${email}, id: ${result.id}`);
        }
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    }

    console.log("Admin notifications sent successfully");
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Notification processed",
      approve_url: approveUrl,
      reject_url: rejectUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
