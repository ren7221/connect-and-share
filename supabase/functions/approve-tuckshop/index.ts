import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action");

    if (!token || !action || !["approve", "reject"].includes(action)) {
      return htmlResponse("Invalid Request", "The link you followed is invalid or incomplete.", "error");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("approval_tokens")
      .select("*, tuckshops(name, owner_id)")
      .eq("token", token)
      .eq("action", action)
      .single();

    if (tokenError || !tokenData) {
      return htmlResponse("Invalid Token", "This approval link is invalid or has already been used.", "error");
    }

    if (tokenData.used) {
      return htmlResponse("Already Processed", `This tuckshop has already been ${action}d.`, "warning");
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return htmlResponse("Link Expired", "This approval link has expired. Please use the admin dashboard instead.", "error");
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update tuckshop status
    const { error: updateError } = await supabaseAdmin
      .from("tuckshops")
      .update({ status: newStatus as any })
      .eq("id", tokenData.tuckshop_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return htmlResponse("Error", "Failed to update tuckshop status. Please try from the dashboard.", "error");
    }

    // Mark both tokens for this tuckshop as used
    await supabaseAdmin
      .from("approval_tokens")
      .update({ used: true })
      .eq("tuckshop_id", tokenData.tuckshop_id);

    const tuckshopName = (tokenData as any).tuckshops?.name || "Unknown";
    const ownerId = (tokenData as any).tuckshops?.owner_id;

    // Send email notification to tuckshop owner
    if (ownerId) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", ownerId)
        .single();

      if (ownerProfile?.email) {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const isApproved = action === "approve";
          const subject = isApproved
            ? `🎉 Your tuckshop "${tuckshopName}" has been approved!`
            : `Your tuckshop "${tuckshopName}" registration update`;
          
          const ownerEmailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#1a7a4e 0%,#d4a017 100%);padding:32px;text-align:center;">
    <h1 style="color:white;margin:0;font-size:24px;">MUST Business</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">Registration Update</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:20px;">
      ${isApproved ? "🎉 Congratulations!" : "Registration Update"}
    </h2>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">
      Hi ${ownerProfile.full_name || "there"},
    </p>
    <div style="background:${isApproved ? "#f0fdf4" : "#fef2f2"};border:2px solid ${isApproved ? "#16a34a" : "#dc2626"};border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <h3 style="color:${isApproved ? "#16a34a" : "#dc2626"};margin:0 0 8px;font-size:18px;">
        ${isApproved ? "✅ Tuckshop Approved" : "❌ Registration Not Approved"}
      </h3>
      <p style="color:#374151;font-size:14px;margin:0;">
        Your tuckshop <strong>"${tuckshopName}"</strong> has been <strong>${isApproved ? "approved" : "rejected"}</strong>.
      </p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px;">
      ${isApproved
        ? "You can now log in to your dashboard and start managing your business. Set up your price list, add employees, and begin recording sales!"
        : "Unfortunately, your registration was not approved at this time. If you believe this was an error or would like more information, please contact the platform administrator."}
    </p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">MUST Business Platform • Automated Notification</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "MUST Business <onboarding@resend.dev>",
                to: [ownerProfile.email],
                subject,
                html: ownerEmailHTML,
              }),
            });
            const result = await res.json();
            if (!res.ok) {
              console.error("Resend error for owner:", result);
            } else {
              console.log(`Owner notification sent to ${ownerProfile.email}, id: ${result.id}`);
            }
          } catch (err) {
            console.error("Failed to send owner email:", err);
          }
        }
      }
    }

    const title = action === "approve" ? "Tuckshop Approved ✅" : "Tuckshop Rejected ❌";
    const message = action === "approve"
      ? `<strong>${tuckshopName}</strong> has been approved and can now access the platform.`
      : `<strong>${tuckshopName}</strong> has been rejected and will not be able to access the platform.`;

    return htmlResponse(title, message, "success");
  } catch (error) {
    console.error("Error:", error);
    return htmlResponse("Error", "An unexpected error occurred. Please try from the dashboard.", "error");
  }
});

function htmlResponse(title: string, message: string, type: "success" | "error" | "warning") {
  const bgColor = type === "success" ? "#f0fdf4" : type === "error" ? "#fef2f2" : "#fffbeb";
  const borderColor = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#f59e0b";
  const iconColor = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#f59e0b";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - MUST Business</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{background:white;border-radius:16px;padding:48px;max-width:480px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.08)}
  .logo{width:48px;height:48px;border-radius:12px;margin:0 auto 16px}
  .brand{font-size:20px;font-weight:bold;color:#1a7a4e;margin-bottom:24px}
  .status{background:${bgColor};border:2px solid ${borderColor};border-radius:12px;padding:24px;margin-bottom:24px}
  .status h2{color:${iconColor};font-size:20px;margin-bottom:8px}
  .status p{color:#374151;font-size:14px;line-height:1.5}
  .footer{color:#9ca3af;font-size:12px;margin-top:16px}
</style></head>
<body>
<div class="card">
  <img src="/icon-192x192.png" alt="Logo" class="logo" onerror="this.style.display='none'" />
  <div class="brand">MUST Business</div>
  <div class="status">
    <h2>${title}</h2>
    <p>${message}</p>
  </div>
  <p class="footer">You can close this window. Manage all tuckshops from your admin dashboard.</p>
</div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
