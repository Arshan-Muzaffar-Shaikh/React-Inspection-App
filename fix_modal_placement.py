#!/usr/bin/env python3
# Fix the modal placement - remove from AdminPanel and add to InspectionForm

with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the modal from AdminPanel (it was added after Toast in the wrong component)
# Find the photo upload modal in AdminPanel and remove it
modal_in_admin = '''      <Toast msg={toast} />

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

content = content.replace(modal_in_admin, '      <Toast msg={toast} />')

# Add the modal to InspectionForm after the preview modal
add_to_inspection = '''        </div>
      )}
    </div>
  );
}

// ─── ADMIN PANEL'''

modal_for_inspection = '''        </div>
      )}

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
      )}
    </div>
  );
}

// ─── ADMIN PANEL'''

content = content.replace(add_to_inspection, modal_for_inspection)

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Fixed modal placement in InspectionForm")
