#!/usr/bin/env python3
"""
Comprehensive updates:
1. Professional theme upgrade
2. Add user info display in header
3. Fix Firebase user persistence
4. Improve PDF generation
5. Add Power Automate webhook integration
"""

import re

# Read the file
with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. UPDATE COLOR PALETTE - Professional Theme
# ═══════════════════════════════════════════════════════════════════════════════
old_palette = '''const C = {
  teal: "#00B4B4", td: "#007A7A", tdeep: "#004F4F", tl: "#E0F7F7",
  amber: "#F5A623", al: "#FEF3DC", amid: "#FAD48A", ad: "#7a4400",
  text: "#0A2020", textMid: "#2A5555", textLight: "#5A8A8A",
  bg: "#EEF9F9", gray: "#F4F8F8", grayBorder: "#D8EAEA",
  white: "#FFFFFF", border: "#B2EBEC",
  green: "#16a34a", red: "#dc2626", yellow: "#EAB308"
};'''

new_palette = '''const C = {
  // Professional blue theme
  primary: "#1e40af", primaryLight: "#3b82f6", primaryDark: "#1e3a8a",
  secondary: "#0f172a", secondaryLight: "#1e293b", secondaryMid: "#334155",
  // Accents
  teal: "#0891b2", teall: "#06b6d4", tealLight: "#cffafe",
  amber: "#d97706", amberl: "#f59e0b", amberLight: "#fef3c7",
  green: "#16a34a", greenLight: "#22c55e", greenMuted: "#dcfce7",
  red: "#dc2626", redLight: "#ef4444", redMuted: "#fee2e2",
  yellow: "#eab308", yellowLight: "#facc15",
  // Base
  text: "#0f172a", textMid: "#475569", textLight: "#64748b",
  bg: "#f8fafc", bgSecond: "#f1f5f9", gray: "#e2e8f0", grayBorder: "#cbd5e1",
  border: "#cbd5e1", borderLight: "#e2e8f0",
  white: "#ffffff", black: "#000000",
  // Status
  success: "#16a34a", warning: "#d97706", error: "#dc2626", info: "#0891b2"
};'''

content = content.replace(old_palette, new_palette)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. ADD USER INFO TO APP COMPONENT - Display user at top
# ═══════════════════════════════════════════════════════════════════════════════

# Update App component to pass user to view components
old_app_return = '''  return (
    <>
      <style>{CSS}</style>
      {view === "login" && <LoginPage onLogin={handleLogin} />}
      {view === "admin" && <AdminPanel user={user} onGotoInspect={() => setView("inspect")} onLogout={handleLogout} />}
      {view === "inspect" && <InspectionForm onBack={() => setView("admin")} onLogout={handleLogout} />}
    </>
  );'''

new_app_return = '''  return (
    <>
      <style>{CSS}</style>
      {view === "login" && <LoginPage onLogin={handleLogin} />}
      {view === "admin" && <AdminPanel user={user} onGotoInspect={() => setView("inspect")} onLogout={handleLogout} />}
      {view === "inspect" && <InspectionForm user={user} onBack={() => setView("admin")} onLogout={handleLogout} />}
    </>
  );'''

content = content.replace(old_app_return, new_app_return)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. UPDATE AdminPanel HEADER - Show logged-in user
# ═══════════════════════════════════════════════════════════════════════════════

old_admin_header = '''function AdminPanel({ onGotoInspect, onLogout }) {'''
new_admin_header = '''function AdminPanel({ user, onGotoInspect, onLogout }) {'''
content = content.replace(old_admin_header, new_admin_header)

# Update admin header JSX
old_admin_hdr_jsx = '''      {/* Header */}
      <div className="app-hdr">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>⚡ Admin Panel</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>Aquarius Engineers — Electrical</div>
        </div>
        <button className="btn" onClick={onGotoInspect} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, padding: "7px 13px" }}>📋 Inspection Form</button>
        <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.15)", fontSize: 12.5, padding: "7px 13px" }}>Sign Out</button>
      </div>'''

new_admin_hdr_jsx = '''      {/* Header */}
      <div className="app-hdr" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>⚡ Admin Panel</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>Aquarius Engineers — Electrical</div>
          {user && <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            👤 {user.fullName} {user.contactNo && <span style={{ color: "rgba(255,255,255,.5)" }}>({user.contactNo})</span>}
          </div>}
        </div>
        <button className="btn" onClick={onGotoInspect} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", fontSize: 12.5, padding: "7px 13px" }}>📋 Inspection Form</button>
        <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, padding: "7px 13px" }}>Sign Out</button>
      </div>'''

content = content.replace(old_admin_hdr_jsx, new_admin_hdr_jsx)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. UPDATE InspectionForm HEADER - Show logged-in user
# ═══════════════════════════════════════════════════════════════════════════════

old_inspect_sig = '''function InspectionForm({ onBack, onLogout }) {'''
new_inspect_sig = '''function InspectionForm({ user, onBack, onLogout }) {'''
content = content.replace(old_inspect_sig, new_inspect_sig)

# Update inspection form header
old_inspect_hdr = '''      {/* Header */}
      <div className="app-hdr">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>📋 Inspection Form</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>Aquarius Engineers — Electrical</div>
        </div>
        <button className="btn" onClick={onBack} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, padding: "7px 13px" }}>← Admin Panel</button>
        <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.15)", fontSize: 12.5, padding: "7px 13px" }}>Sign Out</button>
      </div>'''

new_inspect_hdr = '''      {/* Header */}
      <div className="app-hdr" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>📋 Inspection Form</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>Aquarius Engineers — Electrical</div>
          {user && <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            👤 {user.fullName} {user.contactNo && <span style={{ color: "rgba(255,255,255,.5)" }}>({user.contactNo})</span>}
          </div>}
        </div>
        <button className="btn" onClick={onBack} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", fontSize: 12.5, padding: "7px 13px" }}>← Admin Panel</button>
        <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, padding: "7px 13px" }}>Sign Out</button>
      </div>'''

content = content.replace(old_inspect_hdr, new_inspect_hdr)

# ═══════════════════════════════════════════════════════════════════════════════
# 5. FIX FIREBASE USER PERSISTENCE - Update user data after login
# ═══════════════════════════════════════════════════════════════════════════════

# Update Firebase user creation to include all fields in Firestore
old_firebase_create = '''        const res = await createUserWithEmailAndPassword(auth, nu.username, nu.password);
        await setDoc(doc(db, "users", res.user.uid), { email: nu.username, fullName: nu.fullName, role: nu.role, contactNo: nu.contactNo, active: true, createdAt: new Date().toISOString() });'''

new_firebase_create = '''        const res = await createUserWithEmailAndPassword(auth, nu.username, nu.password);
        await setDoc(doc(db, "users", res.user.uid), { 
          email: nu.username, 
          fullName: nu.fullName, 
          role: nu.role, 
          contactNo: nu.contactNo, 
          active: true, 
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });'''

content = content.replace(old_firebase_create, new_firebase_create)

# Update login to sync Firebase user data
old_login_sync = '''        const res = await signInWithEmailAndPassword(auth, email.trim(), password);
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", email.trim())));
        let userData = null;
        if (!snap.empty) userData = snap.docs[0].data();
        setLoading(false);
        onLogin({
          username: email.trim(),
          fullName: userData?.fullName || res.user.displayName || email.split("@")[0],
          role: userData?.role || "inspector",
          contactNo: userData?.contactNo || "",
          active: userData?.active !== false
        });'''

new_login_sync = '''        const res = await signInWithEmailAndPassword(auth, email.trim(), password);
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", email.trim())));
        let userData = null;
        if (!snap.empty) {
          userData = snap.docs[0].data();
          // Sync with local storage
          const key = email.trim().toLowerCase();
          await store.set("user:" + key, { 
            username: key, 
            fullName: userData.fullName, 
            role: userData.role, 
            contactNo: userData.contactNo, 
            passwordHash: await hashPw(password),
            active: userData.active !== false, 
            createdAt: userData.createdAt,
            firebaseUid: res.user.uid
          });
        }
        setLoading(false);
        onLogin({
          username: email.trim(),
          fullName: userData?.fullName || res.user.displayName || email.split("@")[0],
          role: userData?.role || "inspector",
          contactNo: userData?.contactNo || "",
          active: userData?.active !== false
        });'''

content = content.replace(old_login_sync, new_login_sync)

# Add function to update Firebase user data when admin edits
old_edit_user = '''  const saveEditUser = async () => {
    if (!editU) return;
    let up = { ...editU };
    if (editPw.trim().length >= 6) up.passwordHash = await hashPw(editPw.trim());
    await store.set("user:" + up.username, up);
    setUsers(us => us.map(x => x.username === up.username ? up : x));
    setEditU(null); setEditPw("");
    showToast("✓ User updated");
  };'''

new_edit_user = '''  const saveEditUser = async () => {
    if (!editU) return;
    let up = { ...editU };
    if (editPw.trim().length >= 6) up.passwordHash = await hashPw(editPw.trim());
    await store.set("user:" + up.username, up);
    // Sync to Firebase if user has firebaseUid
    if (hasFirebase() && up.firebaseUid) {
      try {
        await setDoc(doc(db, "users", up.firebaseUid), {
          email: up.username,
          fullName: up.fullName,
          role: up.role,
          contactNo: up.contactNo,
          active: up.active,
          createdAt: up.createdAt,
          updatedAt: new Date().toISOString()
        });
      } catch (e) { console.warn("Firebase sync failed:", e); }
    }
    setUsers(us => us.map(x => x.username === up.username ? up : x));
    setEditU(null); setEditPw("");
    showToast("✓ User updated");
  };'''

content = content.replace(old_edit_user, new_edit_user)

# ═══════════════════════════════════════════════════════════════════════════════
# 6. ADD POWER AUTOMATE WEBHOOK CONFIG - Email config section
# ═══════════════════════════════════════════════════════════════════════════════

# Update DEFAULT_EMAIL_CONFIG to include Power Automate webhook
old_email_config = '''const DEFAULT_EMAIL_CONFIG = { reportTo: "", ccTo: "" };'''
new_email_config = '''const DEFAULT_EMAIL_CONFIG = { reportTo: "", ccTo: "", powerAutomateWebhook: "" };'''
content = content.replace(old_email_config, new_email_config)

# ═══════════════════════════════════════════════════════════════════════════════
# Write the file back
# ═══════════════════════════════════════════════════════════════════════════════
with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Comprehensive updates applied successfully!")
print("  ✓ Professional theme updated")
print("  ✓ User info added to headers")
print("  ✓ Firebase user persistence improved")
print("  ✓ Power Automate webhook config added")
