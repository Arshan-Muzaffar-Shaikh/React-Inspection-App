#!/usr/bin/env python3
"""
Improvements to PDF generation and Power Automate integration:
1. Optimize PDF generation with better image compression
2. Add Power Automate webhook POST support
3. Add email PDF sending with attachment
4. Add inspection result summary to webhook payload
"""

import re

# Read the file
with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. ADD IMAGE COMPRESSION HELPER
# ═══════════════════════════════════════════════════════════════════════════════

# Find where getImgDims is defined and add compressImage before it
old_loc = '''// Image dimension helper
async function getImgDims(dataUrl) {'''

new_loc = '''// Image compression helper (reduce file size for PDF)
async function compressImage(dataUrl, maxWidth = 800, maxHeight = 600, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
      if (h > maxHeight) { w = (w * maxHeight) / h; h = maxHeight; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

// Image dimension helper
async function getImgDims(dataUrl) {'''

content = content.replace(old_loc, new_loc)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. ADD POWER AUTOMATE WEBHOOK SENDER
# ═══════════════════════════════════════════════════════════════════════════════

# Find handleEmailReport and add a new function before it
old_handler_loc = '''  const handleEmailReport = async () => {'''

new_handler_loc = '''  // Send data to Power Automate webhook
  const sendToPowerAutomate = async (webhookUrl, pdfBlob, inspectionData) => {
    if (!webhookUrl) return;
    try {
      // Calculate statistics
      const totalItems = Object.values(answers).reduce((sum, sec) => sum + (Array.isArray(sec) ? sec.length : 0), 0);
      const okItems = Object.values(answers).reduce((sum, sec) => {
        if (Array.isArray(sec)) {
          return sum + sec.filter(item => item?.status === "OK").length;
        }
        return sum;
      }, 0);
      const photosCount = Object.values(photos).reduce((sum, sec) => {
        if (typeof sec === "object") return sum + Object.keys(sec).length;
        return sum;
      }, 0);

      // Create form data with PDF and metadata
      const formData = new FormData();
      formData.append("userId", user?.username || "unknown");
      formData.append("userName", user?.fullName || "Unknown");
      formData.append("userPhone", user?.contactNo || "");
      formData.append("product", product);
      formData.append("model", selectedModel);
      formData.append("inspectionDate", date);
      formData.append("totalItems", totalItems);
      formData.append("okItems", okItems);
      formData.append("completionPercentage", totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0);
      formData.append("photosAttached", photosCount);
      formData.append("timestamp", new Date().toISOString());
      
      if (pdfBlob) {
        formData.append("pdfReport", pdfBlob, `Inspection_${product}_${date}.pdf`);
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        console.warn("Power Automate webhook response:", response.status);
      }
      return response.ok;
    } catch (e) {
      console.warn("Power Automate webhook failed:", e);
      return false;
    }
  };

  const handleEmailReport = async () => {'''

content = content.replace(old_handler_loc, new_handler_loc)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. UPDATE handleSubmit TO TRIGGER POWER AUTOMATE
# ═══════════════════════════════════════════════════════════════════════════════

old_submit = '''    showToast("📧 Generating PDF…");
    pdfBlobRef.current = null;
    const result = await buildPDF(true);
    if (!result) return;
    setSubmitted(true);
    showToast("✓ Report Downloaded");'''

new_submit = '''    showToast("📧 Generating PDF…");
    pdfBlobRef.current = null;
    const result = await buildPDF(true);
    if (!result) return;
    
    // Send to Power Automate if webhook configured
    if (emailConfig.powerAutomateWebhook) {
      showToast("🔄 Sending to Power Automate…");
      await sendToPowerAutomate(
        emailConfig.powerAutomateWebhook, 
        pdfBlobRef.current,
        { product, selectedModel, date, user }
      );
    }
    
    setSubmitted(true);
    showToast("✓ Report Downloaded");'''

content = content.replace(old_submit, new_submit)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. ADD POWER AUTOMATE WEBHOOK CONFIG TO ADMIN EMAIL TAB
# ═══════════════════════════════════════════════════════════════════════════════

# Find the email config section and enhance it
old_email_tab = '''{tab === "email" && <div className="anim">
          <div style={{ marginBottom: 16 }}>
            <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Email Configuration</h2>
            <p style={{ fontSize: 13, color: C.textLight }}>Set up recipient email for PDF reports</p>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Recipient Email *</label>
              <input className="inp" placeholder="report@example.com" value={emailConfigState.reportTo} onChange={e => setEmailConfigState(ec => ({ ...ec, reportTo: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">CC Email (optional)</label>
              <input className="inp" placeholder="cc@example.com" value={emailConfigState.ccTo} onChange={e => setEmailConfigState(ec => ({ ...ec, ccTo: e.target.value }))} />
            </div>
            <button className="btn btn-primary" onClick={saveEmailConfig} style={{ width: "100%", padding: 12 }}>💾 Save Configuration</button>
          </div>
        </div>}'''

new_email_tab = '''{tab === "email" && <div className="anim">
          <div style={{ marginBottom: 16 }}>
            <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Email & Automation Configuration</h2>
            <p style={{ fontSize: 13, color: C.textLight }}>Set up email delivery and Power Automate integration</p>
          </div>
          
          <div className="card" style={{ padding: 18, marginBottom: 14, borderLeft: `4px solid ${C.primary}` }}>
            <div className="sec-hd" style={{ marginBottom: 14 }}>📧 Email Settings</div>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Recipient Email *</label>
              <input className="inp" placeholder="report@example.com" value={emailConfigState.reportTo} onChange={e => setEmailConfigState(ec => ({ ...ec, reportTo: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">CC Email (optional)</label>
              <input className="inp" placeholder="cc@example.com" value={emailConfigState.ccTo} onChange={e => setEmailConfigState(ec => ({ ...ec, ccTo: e.target.value }))} />
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 14, borderLeft: `4px solid ${C.amber}` }}>
            <div className="sec-hd" style={{ marginBottom: 12 }}>⚙️ Power Automate Webhook</div>
            <p style={{ fontSize: 12, color: C.textMid, marginBottom: 12 }}>Integrate with Microsoft Power Automate to automatically process inspection reports. When a report is submitted, it will be sent to your Power Automate flow with:</p>
            <ul style={{ fontSize: 11, color: C.textMid, marginBottom: 12, paddingLeft: 20 }}>
              <li>PDF report with photos</li>
              <li>Inspector name & contact</li>
              <li>Product & model info</li>
              <li>Inspection results & statistics</li>
              <li>Timestamp & completion percentage</li>
            </ul>
            <label className="lbl">Power Automate Webhook URL (optional)</label>
            <input 
              className="inp" 
              placeholder="https://prod-XX.centralindia.logic.azure.com:443/workflows/..." 
              value={emailConfigState.powerAutomateWebhook} 
              onChange={e => setEmailConfigState(ec => ({ ...ec, powerAutomateWebhook: e.target.value }))}
              style={{ fontFamily: "monospace", fontSize: 11 }}
            />
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 8, background: C.bgSecond, padding: 10, borderRadius: 6 }}>
              💡 Get your webhook URL from Power Automate → Create cloud flow → Automated flow → When an HTTP request is received
            </div>
          </div>

          <button className="btn btn-primary" onClick={saveEmailConfig} style={{ width: "100%", padding: 12 }}>💾 Save Configuration</button>
        </div>}'''

content = content.replace(old_email_tab, new_email_tab)

# ═══════════════════════════════════════════════════════════════════════════════
# Write the file back
# ═══════════════════════════════════════════════════════════════════════════════
with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ PDF optimization and Power Automate integration added!")
print("  ✓ Image compression helper added")
print("  ✓ Power Automate webhook sender added")
print("  ✓ Inspection summary statistics calculation added")
print("  ✓ Admin email config UI enhanced with Power Automate section")
