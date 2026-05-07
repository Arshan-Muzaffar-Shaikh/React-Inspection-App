#!/usr/bin/env python3
import re

with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state for photo upload modal
old_state = '''  const [submitted, setSubmitted] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const fileRefs = useRef({});'''

new_state = '''  const [submitted, setSubmitted] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [pendingPhotoUpload, setPendingPhotoUpload] = useState(null);

  const fileRefs = useRef({});'''

content = content.replace(old_state, new_state)

# 2. Add function to handle photo source selection
old_showToast = '''  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };'''

new_showToast = '''  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const selectPhotoSource = (source) => {
    if (!pendingPhotoUpload) return;
    const { sectionKey, itemIdx } = pendingPhotoUpload;
    const fkey = sectionKey + "_" + itemIdx;
    const fileInput = document.getElementById(fkey);
    if (!fileInput) return;
    
    if (source === "camera") {
      fileInput.setAttribute("capture", "environment");
      fileInput.setAttribute("accept", "image/*");
    } else {
      fileInput.removeAttribute("capture");
      fileInput.setAttribute("accept", "image/*");
    }
    fileInput.click();
    setShowPhotoUploadModal(false);
    setPendingPhotoUpload(null);
  };'''

content = content.replace(old_showToast, new_showToast)

# 3. Change the checklist condition to require Product and Date
old_checklist_condition = '''        {/* ── Checklist Sections ── */}
        {product && filteredSections.length === 0 && ('''

new_checklist_condition = '''        {/* ── Checklist Sections ── */}
        {!product || !date ? (
          <div className="card anim" style={{ padding: 24, textAlign: "center", borderLeft: `4px solid ${C.amber}`, background: "#fffbf0" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Complete Required Fields</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Please select <strong>Product</strong> and <strong>Date</strong> to begin the inspection checklist.</div>
          </div>
        ) : product && filteredSections.length === 0 && ('''

content = content.replace(old_checklist_condition, new_checklist_condition)

# 4. Update the checklist condition to close properly
# Find the section that needs closing
old_end_checklist = '''        {product && filteredSections.length === 0 && (
          <div className="card anim" style={{ padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No checklists for {product}</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 5 }}>Ask admin to add sections for this product.</div>
          </div>
        )}

        {product && filteredSections.map(([key, sec]) => {'''

new_end_checklist = '''        ) : product && filteredSections.length === 0 ? (
          <div className="card anim" style={{ padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No checklists for {product}</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 5 }}>Ask admin to add sections for this product.</div>
          </div>
        ) : null}

        {product && date && filteredSections.map(([key, sec]) => {'''

content = content.replace(old_end_checklist, new_end_checklist)

# 5. Update photo upload to use modal
old_photo_upload = '''                          <div className="upload-zone" onClick={() => { const el = document.getElementById(fkey); if (el) el.click(); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            <span style={{ fontSize: 10.5, color: C.teal, fontWeight: 600 }}>Upload</span>
                          </div>'''

new_photo_upload = '''                          <div className="upload-zone" onClick={() => { setPendingPhotoUpload({ sectionKey: key, itemIdx: idx }); setShowPhotoUploadModal(true); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            <span style={{ fontSize: 10.5, color: C.teal, fontWeight: 600 }}>Upload</span>
                          </div>'''

content = content.replace(old_photo_upload, new_photo_upload)

# 6. Add photo upload modal before the return statement
# Find a good place to insert the modal - before the closing div
old_toast = '''      <Toast msg={toast} />'''

new_section = '''      <Toast msg={toast} />

      {/* ── Photo Upload Modal ── */}
      {showPhotoUploadModal && (
        <div className="modal-ov" onClick={() => setShowPhotoUploadModal(false)}>
          <div className="modal-box" style={{ padding: 22 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 16 }}>📸 Upload Photo</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 18 }}>Choose where to get your photo from:</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" onClick={() => selectPhotoSource("camera")} style={{ flex: 1 }}>
                <span>📷 Take Photo</span>
              </button>
              <button className="btn btn-ghost" onClick={() => selectPhotoSource("gallery")} style={{ flex: 1 }}>
                <span>🖼️ Choose from Gallery</span>
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowPhotoUploadModal(false); setPendingPhotoUpload(null); }} style={{ flex: 1 }}>
                <span>✕ Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}'''

content = content.replace(old_toast, new_section)

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Form validation and photo upload modal added!")
