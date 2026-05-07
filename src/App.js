import { useState, useEffect, useRef, useCallback } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { auth, db, hasFirebase } from "./firebaseConfig";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "firebase/auth";
import {
  collection, getDocs, query, where,
  addDoc, serverTimestamp, setDoc, doc, deleteDoc, getDoc
} from "firebase/firestore";


// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
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
  success: "#16a34a", warning: "#d97706", error: "#dc2626", info: "#0891b2",
  // Backward compat
  td: "#3b82f6", tdeep: "#1e3a8a", tl: "#dbeafe"
};

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const PRODUCTS = ["Plant", "Boom Pump"];
const MODELS = ["SP 60 C", "SP 70 C", "SP 75 C", "MP X1", "MP X1.25", "MP X1.5", "CP 30", "CP 45", "Transit Mixer 6m³", "Transit Mixer 7m³", "Custom"];

// Product-to-Models mapping
const PRODUCT_MODELS = {
  "Plant": ["SP 60 C", "SP 70 C", "SP 75 C", "MP X1", "MP X1.25", "MP X1.5", "CP 30", "CP 45", "Custom"],
  "Boom Pump": ["Transit Mixer 6m³", "Transit Mixer 7m³", "Custom"]
};

const DEFAULT_CHECKLISTS = {
  "Control Panel": {
    section: "Control Panel",
    product: "Plant",
    items: [
      "Panel check body & frame check",
      "Communication cable",
      "Spare Fuses",
      "Serial number name plate / Sequence",
      "UPS in & out socket",
      "Weights & measurement name plate / Seal check",
      "Drawing (3 Set)",
      "Control panel mounting support flat",
      "Weight indicator mounting and ferrule checking",
      "Hard Key No.",
      "Cabin Checking and size",
      "Check Panel drawing wise ferruling",
      "Check all Junction box and ferruling",
      "Key switch pendant / Cable tray"
    ]
  },
  "Aggregate": {
    section: "Aggregate",
    product: "Plant",
    items: [
      "Aggregate pneumatic panel check with panel key",
      "Aggregate Pneumatic Panel cable length and ferruling",
      "Aggregate Pneumatic Panel check Bridge rectifier and check wiring",
      "Agg. Pneumatic panel Pressure Gauge and solenoid assembly",
      "Aggregate bin 1 vibrator connection and cable length",
      "Aggregate bin 2 vibrator connection and cable length",
      "Aggregate scale vibrator connection and cable length",
      "Extractor belt motor connection and cable length",
      "Extractor belt motor R,Y,B Phase current",
      "Pneumatic cylinder and piping",
      "Aggregate load cell junction box cable length and its ferruling",
      "Load cell Capacity and earthing connection",
      "Agg. Wiring finishing and assembly",
      "Input resistance (Green+Blue & Brown+black)",
      "Output resistance (Red & White)",
      "Output resistance (Yellow & Green)(Brown & black)",
      "Aggregate pneumatic piping & loadcell cable wiring finishing",
      "Aggregate nozzle mounting",
      "Aggregate earthing cable connection",
      "Pneumatic junction box checking & solenoid coil voltage check"
    ]
  },
  "Mixer": {
    section: "Mixer",
    product: "Plant",
    items: [
      "Mixer limit switch junction box",
      "Discharge gate proximity switch",
      "Power pack solenoid cap with wiring",
      "Hatch gate switch with wiring",
      "Skip motor brake wire",
      "Skip Emergency high limit switch with wiring 'NC'",
      "Skip up limit switch with wiring 'No'",
      "Skip waiting limit switch with wiring 'No'",
      "Skip bottom limit switch with wiring 'No'",
      "Slow rope cable limit switch with wiring 'NC'",
      "3 phase link for break coil supply",
      "Grease Pump Wiring 24VDC",
      "Check Mixer Junction box With Ferruling",
      "Weigher Junction Box with Ferruling",
      "Check all Mixer Cables with Ferruling"
    ]
  },
  "Boom Electrical": {
    section: "Boom Electrical",
    product: "Boom Pump",
    items: [
      "Main power cable connection and ferrule check",
      "Boom arm limit switches wiring check",
      "Remote control panel wiring and connections",
      "Hydraulic solenoid wiring and connections",
      "Outrigger limit switch connections",
      "Emergency stop circuit check",
      "Horn and signal connections",
      "Panel earthing connection check",
      "Cable tray and protection check",
      "Control box ferruling and wiring check"
    ]
  }
};

const DEFAULT_EMAIL_CONFIG = { reportTo: "", ccTo: "", powerAutomateWebhook: "" };

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
const store = {
  get: async (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: async (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del: async (k) => { try { localStorage.removeItem(k); return true; } catch { return false; } },
  list: async (prefix) => { try { return Object.keys(localStorage).filter(k => k.startsWith(prefix)); } catch { return []; } }
};

async function hashPw(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getChecklists() {
  const saved = await store.get("elec_checklists_v1");
  if (saved) return saved;
  await store.set("elec_checklists_v1", DEFAULT_CHECKLISTS);
  return DEFAULT_CHECKLISTS;
}
async function saveChecklists(d) { await store.set("elec_checklists_v1", d); }

async function getEmailConfig() {
  const saved = await store.get("elec_email_config");
  if (saved) return saved;
  return DEFAULT_EMAIL_CONFIG;
}
async function saveEmailConfig(d) { await store.set("elec_email_config", d); }

async function getModels() {
  const saved = await store.get("elec_models_v1");
  if (saved) return saved;
  await store.set("elec_models_v1", MODELS);
  return MODELS;
}
async function saveModels(d) { await store.set("elec_models_v1", d); }

async function getProducts() {
  const saved = await store.get("elec_products_v1");
  if (saved) return saved;
  await store.set("elec_products_v1", PRODUCTS);
  return PRODUCTS;
}
async function saveProducts(d) { await store.set("elec_products_v1", d); }

async function getProductModels() {
  const saved = await store.get("elec_product_models_v1");
  if (saved) return saved;
  await store.set("elec_product_models_v1", PRODUCT_MODELS);
  return PRODUCT_MODELS;
}
async function saveProductModels(d) { await store.set("elec_product_models_v1", d); }

function fileToDataURL(file) {
  return new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(file); });
}
function getImgDims(url) {
  return new Promise(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight }); i.src = url; });
}
const safe = v => String(v ?? "").replace(/[^\x00-\x7F]/g, "");

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{min-height:100vh;font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#f9fafb;color:#374151;-webkit-font-smoothing:antialiased;font-size:14px}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#dbeafe}::-webkit-scrollbar-thumb{background:#1e40af;border-radius:6px}
input,textarea,select,button{font-family:inherit;font-size:inherit}
button{cursor:pointer;-webkit-tap-highlight-color:transparent}
.playfair{font-family:'Playfair Display',Georgia,serif}
.mono{font-family:'JetBrains Mono',monospace}

/* Login */
.login-page{min-height:100vh;display:flex;flex-direction:column}
@media(min-width:768px){.login-page{flex-direction:row}}
.login-left{background:linear-gradient(160deg,#1e3a8a 0%,#1e40af 45%,#3b82f6 100%);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:32px 28px;min-height:220px}
@media(min-width:768px){.login-left{flex:1;min-height:100vh;padding:56px 52px}}
.login-right{background:#fff;display:flex;align-items:center;justify-content:center;padding:36px 22px;flex-shrink:0}
@media(min-width:768px){.login-right{width:460px;min-height:100vh;padding:64px 52px}}
.login-form{width:100%;max-width:380px}
.l-inp{width:100%;padding:14px 16px 14px 48px;font-size:15px;font-weight:500;color:#374151;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:14px;outline:none;transition:all .2s}
.l-inp:focus{border-color:#1e40af;box-shadow:0 0 0 4px rgba(30,64,175,.12);background:#fff}
.l-inp::placeholder{color:#9ca3af;font-weight:400}
.l-btn{width:100%;padding:16px;background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:700;transition:all .2s;box-shadow:0 6px 24px rgba(30,64,175,.4)}
.l-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 30px rgba(30,64,175,.5)}
.l-btn:disabled{opacity:.5;cursor:not-allowed}
@keyframes lFade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.l-anim{animation:lFade .45s cubic-bezier(.22,1,.36,1) forwards}

/* Inputs */
.inp{display:block;width:100%;padding:11px 14px;font-size:14px;font-weight:500;color:#374151;background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;outline:none;transition:all .2s;-webkit-appearance:none}
.inp:focus{border-color:#1e40af;box-shadow:0 0 0 3px rgba(30,64,175,.12)}
.inp::placeholder{color:#9ca3af;font-weight:400}
.inp:disabled{background:#f3f4f6;color:#9ca3af;opacity:.7}
select.inp{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%231e40af' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:38px;cursor:pointer}
.ta{display:block;width:100%;padding:9px 11px;font-size:12.5px;color:#6b7280;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:9px;resize:vertical;outline:none;transition:all .2s;min-height:42px;line-height:1.5}
.ta:focus{border-color:#1e40af;box-shadow:0 0 0 2px rgba(30,64,175,.1);background:#fff}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;transition:all .17s;letter-spacing:.01em}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-primary{background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;box-shadow:0 4px 16px rgba(30,64,175,.3)}
.btn-primary:hover:not(:disabled){background:linear-gradient(135deg,#1e3a8a,#1e40af)}
.btn-amber{background:linear-gradient(135deg,#6b7280,#374151);color:#fff;box-shadow:0 4px 14px rgba(59,130,246,.3)}
.btn-amber:hover:not(:disabled){background:linear-gradient(135deg,#374151,#1e3a8a)}
.btn-ghost{background:transparent;color:#6b7280;border:1.5px solid #e5e7eb}
.btn-ghost:hover{background:#f3f4f6;border-color:#1e40af;color:#3b82f6}
.btn-danger{background:transparent;color:#dc2626;border:1.5px solid #fca5a5}
.btn-danger:hover{background:#fef2f2}
.btn-sm{padding:7px 13px;font-size:12px;border-radius:8px}
.btn-xs{padding:4px 10px;font-size:11px;border-radius:6px}

/* Cards */
.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 2px 8px rgba(30,64,175,.06),0 6px 24px rgba(30,64,175,.04)}

/* Labels */
.lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#6b7280;margin-bottom:6px}
.sec-hd{font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#3b82f6;display:flex;align-items:center;gap:9px;padding-bottom:12px;border-bottom:2px solid #dbeafe;margin-bottom:16px}

/* Badges */
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.04em}
.badge-teal{background:#dbeafe;color:#3b82f6;border:1px solid #e5e7eb}
.badge-amber{background:#f3f4f6;color:#374151;border:1px solid #e5e7eb}
.badge-green{background:#f0fdf4;color:#15803d;border:1px solid #86efac}
.badge-red{background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5}
.badge-admin{background:linear-gradient(135deg,#1e40af,#3b82f6);color:#fff}
.badge-inspector{background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#fff}

/* Header */
.app-hdr{background:linear-gradient(105deg,#1e3a8a,#1e40af 55%,#3b82f6);padding:0 16px;display:flex;align-items:center;min-height:58px;position:sticky;top:0;z-index:100;box-shadow:0 3px 24px rgba(30,58,138,.3);gap:10px}
.hdr-accent{height:3px;background:linear-gradient(to right,#6b7280,#1e40af,#6b7280)}

/* Section checklist */
.section-card{background:#fff;border:1.5px solid #D0ECEC;border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,90,92,.05)}
.section-hdr{background:linear-gradient(135deg,#E0F7F7,#f0fefe);padding:13px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;border-bottom:1.5px solid #D0ECEC}
.section-hdr:hover{background:linear-gradient(135deg,#D0F5F5,#e8fafa)}
.section-body{padding:0}
.section-body.open{display:block;animation:fadeDown .2s ease}
.section-body.closed{display:none}
@keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}

/* Checklist item row */
.cl-row{display:grid;grid-template-columns:36px 1fr 110px 1fr 88px;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid #F0FAFA;transition:background .12s}
.cl-row:last-child{border-bottom:none}
.cl-row:hover{background:#F8FDFD}
.cl-row.ok-row{background:#f7fef9}
.cl-row.notok-row{background:#fff7f7}
@media(max-width:700px){
  .cl-row{grid-template-columns:1fr;gap:6px;padding:12px 14px;border-bottom:1.5px solid #E0F7F7}
  .cl-hdr-row{display:none}
  .item-num{display:inline-flex;margin-right:8px}
  .cl-row-mobile-label{font-size:10px;font-weight:700;color:#5A8A8A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;display:block}
}
.cl-hdr-row{background:linear-gradient(to right,#E0F7F7,#f0fefe);display:grid;grid-template-columns:36px 1fr 110px 1fr 88px;gap:8px;padding:8px 14px;border-bottom:1.5px solid #D0ECEC}

/* Status buttons */
.st-ok{padding:8px 10px;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer;border:2px solid #86efac;background:#f0fdf4;color:#14532d;transition:all .14s;text-align:center;flex:1}
.st-ok.active{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 3px 10px rgba(22,163,74,.3)}
.st-notok{padding:8px 10px;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer;border:2px solid #fca5a5;background:#fef2f2;color:#7f1d1d;transition:all .14s;text-align:center;flex:1}
.st-notok.active{background:#dc2626;border-color:#dc2626;color:#fff;box-shadow:0 3px 10px rgba(220,38,38,.3)}
.st-wrap{display:flex;gap:6px}

/* Upload */
.upload-zone{border:2px dashed #B2EBEC;border-radius:9px;padding:10px 8px;cursor:pointer;background:#F6FBFB;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:58px;transition:all .2s}
.upload-zone:hover{border-color:#00B4B4;background:#E8F8F8}
.photo-thumb{width:100%;border-radius:8px;object-fit:cover;max-height:110px;border:2px solid #B2EBEC}

/* Progress bar */
.prog-bar{height:8px;background:#E0F7F7;border-radius:999px;overflow:hidden}
.prog-fill{height:100%;border-radius:999px;transition:width .5s cubic-bezier(.22,1,.36,1)}

/* Toast */
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#004F4F;color:#fff;padding:11px 22px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:999;animation:toastIn .3s ease;white-space:nowrap}

/* Admin table */
.tbl{width:100%;border-collapse:collapse}
.tbl th{padding:10px 12px;text-align:left;font-size:10px;font-weight:800;color:#5A8A8A;letter-spacing:.08em;text-transform:uppercase;background:linear-gradient(to right,#E0F7F7,#f0fefe);border-bottom:2px solid #B2EBEC}
.tbl td{padding:11px 12px;border-bottom:1px solid #EEF9F9;font-size:13px;color:#2A5555}
.tbl tr:hover td{background:#FAFFFE}

/* Taxonomy pill */
.tax-pill{display:inline-flex;align-items:center;gap:5px;background:#E0F7F7;border:1px solid #B2EBEC;border-radius:8px;padding:4px 11px;font-size:12px;font-weight:600;color:#007A7A;margin:3px}
.tax-pill button{background:rgba(220,38,38,.1);border:none;cursor:pointer;color:#dc2626;font-size:13px;width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;transition:all .15s}
.tax-pill button:hover{background:#dc2626;color:#fff}

/* Modal */
.modal-ov{position:fixed;inset:0;background:rgba(0,30,30,.6);backdrop-filter:blur(5px);z-index:200;display:flex;align-items:flex-end;justify-content:center}
@media(min-width:600px){.modal-ov{align-items:center;padding:16px}}
.modal-box{background:#fff;border-radius:22px 22px 0 0;width:100%;max-width:560px;box-shadow:0 -12px 50px rgba(0,0,0,.2);animation:slideUp .3s cubic-bezier(.22,1,.36,1);max-height:92vh;overflow-y:auto}
@media(min-width:600px){.modal-box{border-radius:22px;animation:fadeUp .28s cubic-bezier(.22,1,.36,1)}}
@keyframes slideUp{from{opacity:0;transform:translateY(44px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
.anim{animation:fadeUp .35s cubic-bezier(.22,1,.36,1) forwards}
@keyframes floatOrb{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
.orb{animation:floatOrb 7s ease-in-out infinite}

/* Tabs */
.tab-bar{display:flex;gap:4px;background:#F4F8F8;border-radius:12px;padding:4px;border:1px solid #D8EAEA;overflow-x:auto;scrollbar-width:none}
.tab-bar::-webkit-scrollbar{display:none}
.tab{padding:9px 18px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;background:transparent;color:#5A8A8A;transition:all .15s}
.tab.active{background:#fff;color:#007A7A;box-shadow:0 2px 8px rgba(0,120,120,.14);border:1px solid #B2EBEC}
.tab:hover:not(.active){background:#E8F8F8;color:#007A7A}
`;

// ─── Spin ─────────────────────────────────────────────────────────────────────
const Spin = ({ size = 14, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"
    style={{ animation: "spin .85s linear infinite", flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    (async () => {
      const admin = await store.get("user:admin");
      if (!admin) {
        const hash = await hashPw("admin123");
        await store.set("user:admin", {
          username: "admin", fullName: "Administrator",
          role: "admin", contactNo: "", passwordHash: hash,
          active: true, createdAt: new Date().toISOString()
        });
      }
    })();
  }, []);

  const handleLogin = async () => {
    setErr("");
    if (!email.trim() || !password) { setErr("Enter username/email and password."); return; }
    setLoading(true);
    // Firebase login for emails
    if (hasFirebase() && email.includes("@")) {
      try {
        const res = await signInWithEmailAndPassword(auth, email.trim(), password);
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
        });
        return;
      } catch (e) {
        setErr("Login failed: " + e.message);
        setLoading(false);
        return;
      }
    }
    // Local storage fallback
    const key = email.trim().toLowerCase();
    const user = await store.get("user:" + key);
    if (!user) { setErr("Invalid username or password."); setLoading(false); return; }
    if (!user.active) { setErr("Account disabled. Contact admin."); setLoading(false); return; }
    const hash = await hashPw(password);
    if (hash !== user.passwordHash) { setErr("Invalid username or password."); setLoading(false); return; }
    setLoading(false);
    onLogin(user);
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="orb" style={{ position: "absolute", top: "10%", left: "15%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,180,180,.18),transparent 70%)", pointerEvents: "none" }} />
        <div className="orb" style={{ position: "absolute", bottom: "20%", right: "8%", width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,166,35,.13),transparent 70%)", pointerEvents: "none", animationDelay: "3.5s" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: "1px solid rgba(255,255,255,.2)" }}>⚡</div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: ".12em", textTransform: "uppercase" }}>Aquarius Engineers</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", fontWeight: 700 }}>Electrical Dept.</div>
              </div>
            </div>
            <div className="playfair" style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>
              Electrical<br /><span style={{ color: "#F5A623" }}>Inspection</span> App
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", lineHeight: 1.8, maxWidth: 300 }}>
              Digital checklists for Control Panel, Aggregate & Mixer sections. Auto PDF reports with photo evidence.
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 24 }}>
            {[["⚡", "Electrical Checklists"], ["📷", "Photo Evidence"], ["📄", "Auto PDF"]].map(([ic, lb]) => (
              <div key={lb} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, background: "rgba(255,255,255,.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: "1px solid rgba(255,255,255,.15)" }}>{ic}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.75)" }}>{lb}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="login-right">
        <div className="login-form l-anim">
          <div style={{ marginBottom: 28 }}>
            <div className="playfair" style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 6 }}>Welcome back</div>
            <div style={{ fontSize: 13.5, color: C.textLight }}>Sign in to your inspection portal</div>
          </div>
          {err && <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 11, padding: "11px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 16, display: "flex", gap: 8 }}>
            <span>⚠</span>{err}
          </div>}
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            <div>
              <label className="lbl">Username or Email</label>
              <div style={{ position: "relative" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="2" style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <input className="l-inp" placeholder="admin or email@domain.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoCapitalize="none" autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="lbl">Password</label>
              <div style={{ position: "relative" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="2" style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                <input type={showPw ? "text" : "password"} className="l-inp" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} autoComplete="current-password" />
                <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.textLight, padding: 5 }}>
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
            </div>
          </div>
          <button className="l-btn" onClick={handleLogin} disabled={loading}>
            {loading ? <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}><Spin size={16} /> Signing in…</span> : "Sign In →"}
          </button>
          <div style={{ marginTop: 20, padding: "12px 14px", background: C.tl, borderRadius: 11, border: `1px solid ${C.border}` }}>
            <div className="lbl" style={{ marginBottom: 3 }}>Default Credentials</div>
            <div className="mono" style={{ fontSize: 12.5, color: C.textMid }}>
              Username: <strong style={{ color: C.td }}>admin</strong> &nbsp;/&nbsp; Password: <strong style={{ color: C.td }}>admin123</strong>
            </div>
          </div>
          <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.textLight }}>© {new Date().getFullYear()} Aquarius Engineers Pvt. Ltd.</div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ currentUser, onLogout, onGotoInspect }) {
  const [tab, setTab] = useState("users");
  const [checklists, setChecklists] = useState(null);
  const [models, setModels] = useState([]);
  const [products, setProducts] = useState([]);
  const [productModels, setProductModels] = useState({});
  const [users, setUsers] = useState([]);
  const [emailConfig, setEmailConfigState] = useState(DEFAULT_EMAIL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // User form
  const [showAddUser, setShowAddUser] = useState(false);
  const [nu, setNu] = useState({ username: "", fullName: "", role: "inspector", contactNo: "", password: "" });
  const [adding, setAdding] = useState(false);
  const [uErr, setUErr] = useState("");
  const [editU, setEditU] = useState(null);
  const [editPw, setEditPw] = useState("");

  // Checklist editing
  const [editSection, setEditSection] = useState(null);
  const [editSectionKey, setEditSectionKey] = useState(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSec, setNewSec] = useState({ key: "", section: "", product: "Plant" });
  const [newItem, setNewItem] = useState("");
  const [clErr, setClErr] = useState("");

  // Model editing
  const [newModel, setNewModel] = useState("");

  // Product/Model editing
  const [newProduct, setNewProduct] = useState("");
  const [selectedProductForModel, setSelectedProductForModel] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodErr, setProdErr] = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  useEffect(() => {
    (async () => {
      const [cls, mods, prods, pm, ukeys, ec] = await Promise.all([getChecklists(), getModels(), getProducts(), getProductModels(), store.list("user:"), getEmailConfig()]);
      const ulist = await Promise.all(ukeys.map(k => store.get(k)));
      setChecklists(cls); setModels(mods); setProducts(prods); setProductModels(pm); setUsers(ulist.filter(Boolean)); setEmailConfigState(ec);
      if (prods.length > 0) setSelectedProductForModel(prods[0]);
      setLoading(false);
    })();
  }, []);

  const saveCLS = async (c) => { setChecklists(c); await saveChecklists(c); };

  // ── Users ──
  const addUser = async () => {
    setUErr("");
    if (!nu.username.trim() || !nu.fullName.trim() || !nu.password) { setUErr("All fields required."); return; }
    if (nu.password.length < 6) { setUErr("Password min 6 chars."); return; }
    setAdding(true);
    try {
      const key = nu.username.trim().toLowerCase();
      const exists = await store.get("user:" + key);
      if (exists) { setUErr("Username already taken."); setAdding(false); return; }
      let firebaseUid = null;
      if (hasFirebase()) {
        if (nu.username.includes("@")) {
          const res = await createUserWithEmailAndPassword(auth, nu.username.trim(), nu.password);
          firebaseUid = res.user.uid;
          await setDoc(doc(db, "users", firebaseUid), {
            email: nu.username.trim(),
            fullName: nu.fullName,
            role: nu.role,
            contactNo: nu.contactNo,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else {
          await setDoc(doc(db, "users", key), {
            username: key,
            fullName: nu.fullName,
            role: nu.role,
            contactNo: nu.contactNo,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      const hash = await hashPw(nu.password);
      await store.set("user:" + key, { username: key, fullName: nu.fullName, role: nu.role, contactNo: nu.contactNo, passwordHash: hash, active: true, createdAt: new Date().toISOString(), firebaseUid });
      const ukeys = await store.list("user:");
      const ulist = await Promise.all(ukeys.map(k => store.get(k)));
      setUsers(ulist.filter(Boolean));
      setNu({ username: "", fullName: "", role: "inspector", contactNo: "", password: "" });
      setShowAddUser(false);
      showToast("✅ User created");
    } catch (e) { setUErr(e.message); }
    setAdding(false);
  };

  const toggleActive = async (u) => {
    const up = { ...u, active: !u.active };
    await store.set("user:" + u.username, up);
    setUsers(us => us.map(x => x.username === u.username ? up : x));
    showToast(up.active ? "✓ User enabled" : "✓ User disabled");
  };

  const deleteUser = async (u) => {
    if (u.username === "admin") return;
    if (!window.confirm(`Delete "${u.fullName}"?`)) return;
    await store.del("user:" + u.username);
    setUsers(us => us.filter(x => x.username !== u.username));
    if (hasFirebase()) {
      try {
        const field = u.username.includes("@") ? "email" : "username";
        const snap = await getDocs(query(collection(db, "users"), where(field, "==", u.username)));
        if (!snap.empty) await deleteDoc(doc(db, "users", snap.docs[0].id));
      } catch (e) { console.warn(e); }
    }
    showToast("✓ User deleted");
  };

  const saveEditUser = async () => {
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
  };

  // ── Checklists ──
  const openEditSection = (key) => { setEditSectionKey(key); setEditSection(JSON.parse(JSON.stringify(checklists[key]))); };
  const saveEditSection = async () => {
    if (!editSection || !editSectionKey) return;
    await saveCLS({ ...checklists, [editSectionKey]: editSection });
    setEditSection(null); setEditSectionKey(null);
    showToast("✓ Section saved");
  };
  const addItemToSection = () => {
    if (!newItem.trim()) return;
    setEditSection(s => ({ ...s, items: [...s.items, newItem.trim()] }));
    setNewItem("");
  };
  const removeItem = (idx) => setEditSection(s => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, val) => setEditSection(s => ({ ...s, items: s.items.map((it, i) => i === idx ? val : it) }));

  const addSection = async () => {
    setClErr("");
    if (!newSec.key.trim() || !newSec.section.trim()) { setClErr("Key and section name required."); return; }
    if (checklists[newSec.key.trim()]) { setClErr("Key already exists."); return; }
    await saveCLS({ ...checklists, [newSec.key.trim()]: { section: newSec.section, product: newSec.product, items: [] } });
    setNewSec({ key: "", section: "", product: "Plant" });
    setShowAddSection(false);
    showToast("✓ Section added");
  };

  const deleteSection = async (key) => {
    if (!window.confirm(`Delete section "${key}"?`)) return;
    const c = { ...checklists }; delete c[key]; await saveCLS(c);
    showToast("✓ Section deleted");
  };

  // ── Products ──
  const addProduct = async () => {
    setProdErr("");
    if (!newProduct.trim()) { setProdErr("Product name required."); return; }
    if (products.includes(newProduct.trim())) { setProdErr("Product already exists."); return; }
    const p = [...products, newProduct.trim()];
    const pm = { ...productModels, [newProduct.trim()]: [] };
    setProducts(p); setProductModels(pm); await saveProducts(p); await saveProductModels(pm);
    setNewProduct(""); setShowAddProduct(false); setSelectedProductForModel(newProduct.trim());
    showToast("✓ Product added");
  };
  const removeProduct = async (p) => {
    if (!window.confirm(`Delete product "${p}"? All associated models will be deleted.`)) return;
    const updatedProds = products.filter(x => x !== p);
    const updatedPM = { ...productModels }; delete updatedPM[p];
    setProducts(updatedProds); setProductModels(updatedPM); await saveProducts(updatedProds); await saveProductModels(updatedPM);
    if (selectedProductForModel === p && updatedProds.length > 0) setSelectedProductForModel(updatedProds[0]);
    showToast("✓ Product deleted");
  };

  // ── Models ──
  const addModel = async () => {
    if (!newModel.trim() || !selectedProductForModel) return;
    const prodModels = productModels[selectedProductForModel] || [];
    if (prodModels.includes(newModel.trim())) { showToast("⚠ Model already exists"); return; }
    const updatedPM = { ...productModels, [selectedProductForModel]: [...prodModels, newModel.trim()] };
    setProductModels(updatedPM); await saveProductModels(updatedPM); setNewModel("");
    showToast("✓ Model added");
  };
  const removeModel = async (m) => {
    if (!selectedProductForModel) return;
    const prodModels = productModels[selectedProductForModel] || [];
    const updated = prodModels.filter(x => x !== m);
    const updatedPM = { ...productModels, [selectedProductForModel]: updated };
    setProductModels(updatedPM); await saveProductModels(updatedPM);
    showToast("✓ Model removed");
  };

  // ── Email Config ──
  const saveEmail = async () => {
    await saveEmailConfig(emailConfig);
    showToast("✓ Email settings saved");
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, flexDirection: "column", gap: 12 }}><Spin size={22} color={C.teal} /><div style={{ color: C.teal, fontSize: 14, fontWeight: 600 }}>Loading…</div></div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{CSS}</style>
      <Toast msg={toast} />

      {/* Header */}
      <div className="app-hdr" style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>⚡ Admin Panel</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: ".1em", textTransform: "uppercase" }}>Aquarius Engineers — Electrical</div>
          {currentUser && <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            👤 {currentUser.fullName} {currentUser.contactNo && <span style={{ color: "rgba(255,255,255,.5)" }}>({currentUser.contactNo})</span>}
          </div>}
        </div>
        <button className="btn" onClick={onGotoInspect} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", fontSize: 12.5, padding: "7px 13px" }}>📋 Inspection Form</button>
        <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.75)", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, padding: "7px 13px" }}>Sign Out</button>
      </div>
      <div className="hdr-accent" />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "22px 14px 80px" }}>
        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          {[["users", "👥 Users"], ["checklists", "📋 Checklists"], ["products", "📦 Products & Models"], ["email", "📧 Email Config"]].map(([id, lbl]) => (
            <button key={id} className={`tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>

        {/* ── USERS ── */}
        {tab === "users" && <div className="anim">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>User Management</h2>
              <p style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>{users.length} accounts</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddUser(v => !v)}>{showAddUser ? "✕ Cancel" : "+ Add User"}</button>
          </div>

          {showAddUser && <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: `4px solid ${C.teal}` }}>
            <div className="sec-hd">Create New User</div>
            {uErr && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, background: "#fef2f2", padding: "10px 13px", borderRadius: 8 }}>⚠ {uErr}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 11, marginBottom: 14 }}>
              <div><label className="lbl">Username/Email *</label><input className="inp" value={nu.username} onChange={e => setNu(n => ({ ...n, username: e.target.value }))} placeholder="user@email.com" autoCapitalize="none" /></div>
              <div><label className="lbl">Full Name *</label><input className="inp" value={nu.fullName} onChange={e => setNu(n => ({ ...n, fullName: e.target.value }))} placeholder="Full name" /></div>
              <div><label className="lbl">Contact No</label><input className="inp" value={nu.contactNo} onChange={e => setNu(n => ({ ...n, contactNo: e.target.value }))} placeholder="Phone number" /></div>
              <div><label className="lbl">Password * (min 6)</label><input type="password" className="inp" value={nu.password} onChange={e => setNu(n => ({ ...n, password: e.target.value }))} placeholder="Set password" /></div>
              <div><label className="lbl">Role</label>
                <select className="inp" value={nu.role} onChange={e => setNu(n => ({ ...n, role: e.target.value }))}>
                  <option value="inspector">Inspector</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={addUser} disabled={adding}>{adding ? <><Spin size={13} /> Adding…</> : "Create User"}</button>
              <button className="btn btn-ghost" onClick={() => { setShowAddUser(false); setUErr(""); }}>Cancel</button>
            </div>
          </div>}

          {/* Edit user modal */}
          {editU && <div className="modal-ov">
            <div className="modal-box" style={{ padding: 22 }}>
              <div className="sec-hd">Edit User: @{editU.username}</div>
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <div><label className="lbl">Full Name</label><input className="inp" value={editU.fullName} onChange={e => setEditU(u => ({ ...u, fullName: e.target.value }))} /></div>
                <div><label className="lbl">Contact No</label><input className="inp" value={editU.contactNo || ""} onChange={e => setEditU(u => ({ ...u, contactNo: e.target.value }))} /></div>
                <div><label className="lbl">Role</label>
                  <select className="inp" value={editU.role} onChange={e => setEditU(u => ({ ...u, role: e.target.value }))}>
                    <option value="inspector">Inspector</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div><label className="lbl">New Password (leave blank to keep)</label><input type="password" className="inp" value={editPw} onChange={e => setEditPw(e.target.value)} placeholder="Enter new password…" /></div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={saveEditUser}>Save Changes</button>
                <button className="btn btn-ghost" onClick={() => { setEditU(null); setEditPw(""); }}>Cancel</button>
              </div>
            </div>
          </div>}

          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr>{["Account", "Full Name", "Contact", "Role", "Status", "Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: u.role === "admin" ? "linear-gradient(135deg,#7c3aed,#a855f7)" : C.tl, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: u.role === "admin" ? "#fff" : C.td }}>{(u.username || "?")[0].toUpperCase()}</div>
                      <span style={{ fontWeight: 600 }}>@{u.username}</span>
                    </div></td>
                    <td>{u.fullName}</td>
                    <td style={{ color: C.textLight }}>{u.contactNo || "—"}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: u.active ? "#f0fdf4" : "#F4F8F8", color: u.active ? "#15803d" : "#5A8A8A", border: `1px solid ${u.active ? "#86efac" : "#D8EAEA"}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.active ? "#22c55e" : "#9CA3AF", display: "inline-block" }} />{u.active ? "Active" : "Inactive"}
                    </span></td>
                    <td><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => { setEditU(u); setEditPw(""); }}>Edit</button>
                      {u.username !== "admin" && <>
                        <button className="btn btn-xs" style={{ color: u.active ? "#b45309" : "#15803d", border: `1px solid ${u.active ? "#fde68a" : "#86efac"}`, background: u.active ? "#fefce8" : "#f0fdf4" }} onClick={() => toggleActive(u)}>{u.active ? "Disable" : "Enable"}</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u)}>Delete</button>
                      </>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}

        {/* ── CHECKLISTS ── */}
        {tab === "checklists" && <div className="anim">
          {/* Edit section modal */}
          {editSection && <div style={{ position: "fixed", inset: 0, background: "rgba(0,40,40,.62)", zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto", backdropFilter: "blur(4px)" }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 720, padding: 22, margin: "20px auto", boxShadow: "0 24px 80px rgba(0,0,0,.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div className="playfair" style={{ fontSize: 17, fontWeight: 800, color: C.text }}>Edit: {editSectionKey}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{editSection.items.length} checkpoints</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" onClick={saveEditSection}>💾 Save</button>
                  <button className="btn btn-ghost" onClick={() => { setEditSection(null); setEditSectionKey(null); }}>Cancel</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 10, marginBottom: 16, background: C.gray, borderRadius: 11, padding: 13 }}>
                <div><label className="lbl">Section Name</label><input className="inp" value={editSection.section} onChange={e => setEditSection(s => ({ ...s, section: e.target.value }))} /></div>
                <div><label className="lbl">Product</label>
                  <select className="inp" value={editSection.product} onChange={e => setEditSection(s => ({ ...s, product: e.target.value }))}>
                    {products.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10, maxHeight: 340, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {editSection.items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: idx < editSection.items.length - 1 ? `1px solid ${C.grayBorder}` : "none", background: idx % 2 === 0 ? "#fff" : "#FAFFFE" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: C.tl, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.td, flexShrink: 0 }}>{idx + 1}</div>
                    <input style={{ flex: 1, border: `1.5px solid ${C.grayBorder}`, borderRadius: 7, padding: "6px 10px", fontSize: 13, outline: "none", transition: "border .15s" }} value={item} onChange={e => updateItem(idx, e.target.value)} onFocus={e => e.target.style.borderColor = "#00B4B4"} onBlur={e => e.target.style.borderColor = C.grayBorder} />
                    <button onClick={() => removeItem(idx)} style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", cursor: "pointer", width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, flexShrink: 0 }}>−</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input className="inp" placeholder="New checkpoint description…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItemToSection()} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={addItemToSection}>+ Add</button>
              </div>
            </div>
          </div>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Checklist Sections</h2>
              <p style={{ fontSize: 13, color: C.textLight }}>{Object.keys(checklists).length} sections configured</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddSection(v => !v)}>{showAddSection ? "✕ Cancel" : "+ Add Section"}</button>
          </div>

          {showAddSection && <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: `4px solid ${C.amber}` }}>
            <div className="sec-hd">New Checklist Section</div>
            {clErr && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, background: "#fef2f2", padding: "10px 13px", borderRadius: 8 }}>⚠ {clErr}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 10, marginBottom: 14 }}>
              <div><label className="lbl">Section Key *</label><input className="inp" value={newSec.key} onChange={e => setNewSec(n => ({ ...n, key: e.target.value }))} placeholder="e.g. Wiring" /></div>
              <div><label className="lbl">Section Name *</label><input className="inp" value={newSec.section} onChange={e => setNewSec(n => ({ ...n, section: e.target.value }))} placeholder="e.g. Main Wiring" /></div>
              <div><label className="lbl">Product</label>
                <select className="inp" value={newSec.product} onChange={e => setNewSec(n => ({ ...n, product: e.target.value }))}>
                  {products.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-amber" onClick={addSection}>Create Section</button>
              <button className="btn btn-ghost" onClick={() => { setShowAddSection(false); setClErr(""); }}>Cancel</button>
            </div>
          </div>}

          <div style={{ display: "grid", gap: 10 }}>
            {Object.entries(checklists).map(([key, sec]) => (
              <div key={key} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${C.tdeep},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {sec.product === "Plant" ? "🏭" : "🚧"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{sec.section}</div>
                    <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}><span className="badge badge-teal" style={{ marginRight: 6, fontSize: 10 }}>{sec.product}</span>{sec.items.length} items</div>
                  </div>
                  <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditSection(key)}>✏ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteSection(key)}>Delete</button>
                  </div>
                </div>
                {sec.items.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.grayBorder}`, display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {sec.items.slice(0, 4).map((it, i) => <span key={i} style={{ background: C.gray, border: `1px solid ${C.grayBorder}`, borderRadius: 6, padding: "3px 9px", fontSize: 11.5, color: C.textMid }}>{it}</span>)}
                    {sec.items.length > 4 && <span style={{ fontSize: 11.5, color: C.textLight, padding: "3px 9px" }}>+{sec.items.length - 4} more</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>}

        {/* ── MODELS ── */}
        {tab === "products" && <div className="anim">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Products & Models</h2>
              <p style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>{products.length} products available</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddProduct(v => !v)}>{showAddProduct ? "✕ Cancel" : "+ Add Product"}</button>
          </div>

          {showAddProduct && <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: `4px solid ${C.teal}` }}>
            <div className="sec-hd">Create New Product</div>
            {prodErr && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, background: "#fef2f2", padding: "10px 13px", borderRadius: 8 }}>⚠ {prodErr}</div>}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Product Name *</label>
                <input className="inp" value={newProduct} onChange={e => setNewProduct(e.target.value)} placeholder="e.g. Concrete Mixer" onKeyDown={e => e.key === "Enter" && addProduct()} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" onClick={addProduct}>Create</button>
                <button className="btn btn-ghost" onClick={() => { setShowAddProduct(false); setProdErr(""); setNewProduct(""); }}>Cancel</button>
              </div>
            </div>
          </div>}

          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {products.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, background: selectedProductForModel === p ? C.tl : "#F4F8F8", border: `2px solid ${selectedProductForModel === p ? C.border : "#D8EAEA"}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", transition: "all .15s" }} onClick={() => setSelectedProductForModel(p)}>
                  <span style={{ fontWeight: 600, color: C.text }}>{p}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeProduct(p); }} style={{ background: "rgba(220,38,38,.1)", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, transition: "all .15s" }} onMouseEnter={e => { e.target.style.background = "#dc2626"; e.target.style.color = "#fff"; }} onMouseLeave={e => { e.target.style.background = "rgba(220,38,38,.1)"; e.target.style.color = "#dc2626"; }}>×</button>
                </div>
              ))}
              {products.length === 0 && <span style={{ color: C.textLight, fontSize: 13 }}>No products added yet.</span>}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="sec-hd" style={{ marginBottom: 16 }}>📦 {selectedProductForModel} - Models</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input className="inp" placeholder={`e.g. SP 80 C for ${selectedProductForModel}`} value={newModel} onChange={e => setNewModel(e.target.value)} onKeyDown={e => e.key === "Enter" && addModel()} style={{ flex: 1 }} disabled={!selectedProductForModel} />
              <button className="btn btn-primary" onClick={addModel} disabled={!selectedProductForModel}>Add Model</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {selectedProductForModel && (productModels[selectedProductForModel] || []).map(m => (
                <span key={m} className="tax-pill">
                  {m}
                  <button onClick={() => removeModel(m)}>−</button>
                </span>
              ))}
              {selectedProductForModel && (!productModels[selectedProductForModel] || productModels[selectedProductForModel].length === 0) && <span style={{ color: C.textLight, fontSize: 13 }}>No models added yet for this product.</span>}
            </div>
          </div>
        </div>}

        {/* ── EMAIL CONFIG ── */}
        {tab === "email" && <div className="anim">
          <div style={{ marginBottom: 16 }}>
            <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Email Configuration</h2>
            <p style={{ fontSize: 13, color: C.textLight }}>Set where inspection reports are automatically sent</p>
          </div>
          <div className="card" style={{ padding: 22 }}>
            <div className="sec-hd">📧 Report Email Settings</div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label className="lbl">Send Reports To (Primary Email)</label>
                <input type="email" className="inp" value={emailConfig.reportTo} onChange={e => setEmailConfigState(ec => ({ ...ec, reportTo: e.target.value }))} placeholder="quality@aquariusengineers.com" />
                <div style={{ fontSize: 12, color: C.textLight, marginTop: 5 }}>All inspection PDF reports will be sent to this address.</div>
              </div>
              <div>
                <label className="lbl">CC Email (Optional)</label>
                <input type="email" className="inp" value={emailConfig.ccTo} onChange={e => setEmailConfigState(ec => ({ ...ec, ccTo: e.target.value }))} placeholder="manager@aquariusengineers.com" />
              </div>
              <button className="btn btn-primary" onClick={saveEmail} style={{ width: "fit-content" }}>💾 Save Email Settings</button>
            </div>
            <div style={{ marginTop: 18, padding: "13px 16px", background: "#fffbeb", borderRadius: 11, border: "1px solid #fde68a", fontSize: 12.5, color: "#92400e" }}>
              ⚠ <strong>Note:</strong> Email sending via mobile uses your device's default mail app (mailto:). For fully automatic sending, integrate an email API (e.g. EmailJS or SendGrid) with your backend.
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ─── INSPECTION FORM ──────────────────────────────────────────────────────────
function InspectionForm({ currentUser, onLogout, onGotoAdmin }) {
  const [checklists, setChecklists] = useState(null);
  const [models, setModels] = useState([]);
  const [products, setProducts] = useState([]);
  const [productModels, setProductModels] = useState({});
  const [emailConfig, setEmailConfig] = useState(DEFAULT_EMAIL_CONFIG);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [modelInput, setModelInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [product, setProduct] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cabinSrNo, setCabinSrNo] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");

  // Get filtered models based on product
  const filteredModels = product && productModels[product] ? productModels[product] : models;

  // Checklist state: { [sectionKey]: { [itemIdx]: { status, obs, photo } } }
  const [answers, setAnswers] = useState({});
  const [photos, setPhotos] = useState({});
  const [openSections, setOpenSections] = useState({});

  const [submitted, setSubmitted] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [pendingPhotoUpload, setPendingPhotoUpload] = useState(null);

  const fileRefs = useRef({});
  const pdfBlobRef = useRef(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };

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
  };

  // Reset selectedModel when product changes
  useEffect(() => {
    setSelectedModel("");
  }, [product]);

  useEffect(() => {
    (async () => {
      const [cls, mods, prods, pm, ec] = await Promise.all([getChecklists(), getModels(), getProducts(), getProductModels(), getEmailConfig()]);
      setChecklists(cls); setModels(mods); setProducts(prods); setProductModels(pm); setEmailConfig(ec);
      // Open all sections by default
      const opens = {};
      Object.keys(cls).forEach(k => { opens[k] = true; });
      setOpenSections(opens);
      setLoading(false);
    })();
  }, []);

  // Filtered sections by product
  const filteredSections = checklists && product
    ? Object.entries(checklists).filter(([, s]) => s.product === product)
    : [];

  // Stats
  const totalItems = filteredSections.reduce((sum, [, s]) => sum + s.items.length, 0);
  const doneItems = filteredSections.reduce((sum, [key, s]) => {
    return sum + s.items.filter((_, idx) => answers[key]?.[idx]?.status).length;
  }, 0);
  const okCount = filteredSections.reduce((sum, [key, s]) => {
    return sum + s.items.filter((_, idx) => answers[key]?.[idx]?.status === "OK").length;
  }, 0);
  const notOkCount = filteredSections.reduce((sum, [key, s]) => {
    return sum + s.items.filter((_, idx) => answers[key]?.[idx]?.status === "NOT OK").length;
  }, 0);
  const photoCount = Object.values(photos).reduce((s, sph) => s + Object.keys(sph || {}).length, 0);
  const pct = totalItems ? Math.round(doneItems / totalItems * 100) : 0;

  const setStatus = (sectionKey, idx, st) => {
    setAnswers(a => ({
      ...a,
      [sectionKey]: { ...a[sectionKey], [idx]: { ...(a[sectionKey]?.[idx] || {}), status: a[sectionKey]?.[idx]?.status === st ? "" : st } }
    }));
  };
  const setObs = (sectionKey, idx, v) => {
    setAnswers(a => ({ ...a, [sectionKey]: { ...a[sectionKey], [idx]: { ...(a[sectionKey]?.[idx] || {}), obs: v } } }));
  };
  const handlePhoto = async (sectionKey, idx, file) => {
    if (!file) return;
    const d = await fileToDataURL(file);
    setPhotos(p => ({ ...p, [sectionKey]: { ...(p[sectionKey] || {}), [idx]: { dataUrl: d, name: file.name } } }));
  };
  const removePhoto = (sectionKey, idx) => {
    setPhotos(p => { const n = { ...p }; if (n[sectionKey]) { delete n[sectionKey][idx]; } return n; });
    const fkey = sectionKey + "_" + idx;
    if (fileRefs.current[fkey]) fileRefs.current[fkey].value = "";
  };
  const toggleSection = (key) => setOpenSections(o => ({ ...o, [key]: !o[key] }));

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setModelInput("");
    setSelectedModel("");
    setProduct("");
    setCustomerName("");
    setCabinSrNo("");
    setDispatchDate("");
    setAnswers({});
    setPhotos({});
    setSubmitted(false);
    setPdfBusy(false);
  };

  const buildPDF = async ({ download = true, sendEmail = false } = {}) => {
    setPdfBusy(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentWidth = pageWidth - 2 * margin;
      let yPos = margin;

      // Helper to add new page if needed
      const checkPageHeight = (minHeight) => {
        if (yPos + minHeight > pageHeight - 12) {
          doc.addPage();
          yPos = margin;
        }
      };

      // ===== MAIN HEADER =====
      doc.setFillColor(30, 58, 138);
      doc.rect(0, 0, pageWidth, 32, "F");
      
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, "bold");
      doc.text("ELECTRICAL INSPECTION REPORT", pageWidth / 2, 13, { align: "center" });
      
      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      doc.text("Aquarius Engineers Pvt. Ltd.", pageWidth / 2, 22, { align: "center" });
      
      doc.setFontSize(7.5);
      doc.setTextColor(200, 220, 255);
      doc.text("Digital Inspection & Quality Assurance System", pageWidth / 2, 28, { align: "center" });
      
      yPos = 38;

      // ===== INSPECTION DETAILS SECTION =====
      doc.setFillColor(245, 250, 255);
      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.8);
      doc.rect(margin, yPos - 2, contentWidth, 40, "FD");

      doc.setFontSize(9.5);
      doc.setFont(undefined, "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("INSPECTION DETAILS", margin + 3, yPos + 2);

      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.setTextColor(60, 60, 60);

      const colWidth = (contentWidth - 6) / 3;
      const details = [
        { label: "Date", value: date },
        { label: "Product", value: product },
        { label: "Model", value: selectedModel || modelInput },
        { label: "Customer", value: customerName || "—" },
        { label: "Cabin Sr. No", value: cabinSrNo || "—" },
        { label: "Dispatch Date", value: dispatchDate || "—" },
        { label: "Inspected By", value: currentUser.fullName },
        { label: "Contact", value: currentUser.contactNo || "—" },
        { label: "Report Date", value: new Date().toLocaleDateString() }
      ];

      let detailIdx = 0;
      let detailY = yPos + 7;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          if (detailIdx < details.length) {
            const xPos = margin + 3 + col * (colWidth + 2);
            const detail = details[detailIdx];
            
            doc.setFont(undefined, "bold");
            doc.setTextColor(30, 58, 138);
            doc.text(detail.label, xPos, detailY);
            
            doc.setFont(undefined, "normal");
            doc.setTextColor(80, 80, 80);
            const value = String(detail.value).substring(0, 25);
            doc.text(value, xPos, detailY + 4);
            
            detailIdx++;
          }
        }
        detailY += 9;
      }

      yPos += 45;

      // ===== SUMMARY STATISTICS =====
      checkPageHeight(14);
      
      const statsData = [
        { label: "Total Items", value: totalItems, color: [30, 64, 175] },
        { label: "OK", value: okCount, color: [22, 163, 74] },
        { label: "Not OK", value: notOkCount, color: [220, 38, 38] },
        { label: "Photos", value: photoCount, color: [8, 145, 178] }
      ];

      const statWidth = (contentWidth - 9) / 4;
      statsData.forEach((stat, idx) => {
        const xPos = margin + idx * (statWidth + 2.25);
        doc.setFillColor(...stat.color);
        doc.roundedRect(xPos, yPos, statWidth, 11, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, "bold");
        doc.setFontSize(15);
        doc.text(stat.value.toString(), xPos + statWidth / 2, yPos + 4.5, { align: "center" });
        doc.setFontSize(7.5);
        doc.setFont(undefined, "normal");
        doc.text(stat.label, xPos + statWidth / 2, yPos + 8.5, { align: "center" });
      });

      yPos += 16;

      // ===== CHECKLIST SECTIONS =====
      filteredSections.forEach(([sectionKey, section], sectionIdx) => {
        checkPageHeight(16);

        // Section header with number
        doc.setFillColor(30, 58, 138);
        doc.rect(margin, yPos, contentWidth, 7.5, "F");
        doc.setFontSize(9.5);
        doc.setFont(undefined, "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(`${sectionIdx + 1}. ${section.section}`, margin + 2, yPos + 5);
        doc.setFontSize(7.5);
        doc.setFont(undefined, "normal");
        doc.setTextColor(220, 220, 220);
        doc.text(`(${section.items.length} items)`, contentWidth + margin - 25, yPos + 5);
        yPos += 9;

        // Items in section
        section.items.forEach((item, idx) => {
          const ans = answers[sectionKey]?.[idx] || {};
          const ph = photos[sectionKey]?.[idx];
          const itemHeight = ph ? 38 : 12;

          checkPageHeight(itemHeight + 2);

          // Item background
          const statusColor = ans.status === "OK" ? [34, 197, 94] : ans.status === "NOT OK" ? [239, 68, 68] : [156, 163, 175];
          const statusBg = ans.status === "OK" ? [240, 253, 244] : ans.status === "NOT OK" ? [254, 242, 242] : [249, 250, 251];

          doc.setFillColor(...statusBg);
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.3);
          doc.rect(margin, yPos, contentWidth, itemHeight, "FD");

          // Item number and description
          doc.setFontSize(9);
          doc.setFont(undefined, "bold");
          doc.setTextColor(30, 50, 100);
          doc.text(`${idx + 1}.`, margin + 3, yPos + 3.5);

          const descWidth = contentWidth - 55;
          const wrappedDesc = doc.splitTextToSize(item, descWidth);
          doc.text(wrappedDesc, margin + 10, yPos + 3.5);

          // Status badge
          doc.setFillColor(...statusColor);
          doc.roundedRect(contentWidth + margin - 24, yPos + 1.5, 22, 5, 1, 1, "F");
          doc.setFontSize(7);
          doc.setFont(undefined, "bold");
          doc.setTextColor(255, 255, 255);
          const statusText = ans.status === "OK" ? "OK" : ans.status === "NOT OK" ? "NOT OK" : "PENDING";
          doc.text(statusText, contentWidth + margin - 13, yPos + 4, { align: "center" });

          // Remarks if exist
          if (ans.obs) {
            doc.setFontSize(7.5);
            doc.setFont(undefined, "normal");
            doc.setTextColor(80, 80, 80);
            const obsText = `Remarks: ${ans.obs}`;
            const wrappedObs = doc.splitTextToSize(obsText, descWidth);
            const descHeight = wrappedDesc.length * 3.5;
            doc.text(wrappedObs, margin + 10, yPos + 3.5 + descHeight + 2);
          }

          // Photo if exists
          if (ph && ph.dataUrl) {
            try {
              const descHeight = wrappedDesc.length * 3.5 + (ans.obs ? 4 : 0);
              doc.addImage(ph.dataUrl, "JPEG", margin + 3, yPos + 3.5 + descHeight + 3, 35, 20);
            } catch (imgErr) {
              console.warn("Photo embedding failed:", imgErr);
            }
          }

          yPos += itemHeight + 1;
        });

        yPos += 2;
      });

      // ===== FOOTER =====
      yPos += 3;
      checkPageHeight(6);
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 3;

      doc.setFontSize(7);
      doc.setFont(undefined, "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${new Date().toLocaleString()} | Inspector: ${currentUser.fullName}`, margin, yPos);
      doc.text(`Aquarius Engineers Pvt. Ltd. - Electrical Department`, pageWidth / 2, yPos + 4, { align: "center" });
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, yPos, { align: "right" });

      const pdfBlob = doc.output("blob");
      pdfBlobRef.current = pdfBlob;

      if (download) {
        doc.save(`Inspection_${product}_${date}.pdf`);
        showToast("✓ PDF downloaded successfully");
      }

      setPdfBusy(false);
      return { success: true, fileName: `Inspection_${product}_${date}.pdf`, blob: pdfBlob };
    } catch (e) {
      console.error("PDF generation error:", e);
      showToast("✗ Error generating PDF: " + e.message);
      setPdfBusy(false);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!product) { showToast("⚠ Please select a product first"); return; }
    setSubmitted(true);
    setPdfBusy(true);

    try {
      // Build PDF first
      const pdfResult = await buildPDF({ download: true, sendEmail: false });
      if (!pdfResult) {
        setSubmitted(false);
        setPdfBusy(false);
        return;
      }

      // Save to Firebase
      if (hasFirebase()) {
        try {
          const user = auth.currentUser;
          const rows = [];
          for (const [key, sec] of filteredSections) {
            sec.items.forEach((item, idx) => {
              const ans = answers[key]?.[idx] || {};
              rows.push({ section: sec.section, item, status: ans.status || "", obs: ans.obs || "", hasPhoto: !!(photos[key]?.[idx]) });
            });
          }
          await addDoc(collection(db, "electrical_inspections"), {
            userId: user?.uid || "",
            userEmail: user?.email || currentUser.username,
            submittedBy: currentUser.fullName,
            date, product, model: selectedModel || modelInput,
            customerName, cabinSrNo, dispatchDate,
            rows, okCount, notOkCount, photoCount,
            submittedAt: serverTimestamp()
          });
        } catch (e) { console.warn("Firestore save failed", e); }
      }

      // Send email with PDF via Power Automate or Email Service
      if (emailConfig.reportTo || emailConfig.powerAutomateWebhook) {
        await sendEmailWithPDF(pdfResult.blob, pdfResult.fileName);
      } else {
        showToast("💡 Set email address in Admin → Email Config to send reports");
      }

      setPdfBusy(false);
    } catch (e) {
      console.error("Submit error:", e);
      showToast("✗ Error during submission");
      setSubmitted(false);
      setPdfBusy(false);
    }
  };

  const sendEmailWithPDF = async (pdfBlob, fileName) => {
    try {
      // Use Power Automate webhook if available
      if (emailConfig.powerAutomateWebhook) {
        const formData = new FormData();
        formData.append("pdfReport", pdfBlob, fileName);
        formData.append("recipientEmail", emailConfig.reportTo || "");
        formData.append("ccEmail", emailConfig.ccTo || "");
        formData.append("subject", `Electrical Inspection Report — ${product} — ${date}`);
        formData.append("submittedBy", currentUser.fullName);
        formData.append("product", product);
        formData.append("model", selectedModel || modelInput);
        formData.append("inspectionDate", date);
        formData.append("customer", customerName);
        formData.append("okItems", okCount);
        formData.append("totalItems", totalItems);
        formData.append("photos", photoCount);

        const response = await fetch(emailConfig.powerAutomateWebhook, {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          showToast("✓ Report submitted and email sent successfully!");
          return true;
        } else {
          console.warn("Email webhook failed:", response.status);
          showToast("⚠ Report saved but email sending failed. Check admin settings.");
          return false;
        }
      } else if (emailConfig.reportTo) {
        // Fallback: Use browser's download + show instructions
        showToast("✓ Report generated. Please open your email client to send it.");
        return true;
      }
    } catch (e) {
      console.error("Email send error:", e);
      showToast("✗ Error sending email: " + e.message);
      return false;
    }
  };

  // Send data to Power Automate webhook
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
      formData.append("userId", currentUser?.username || "unknown");
      formData.append("userName", currentUser?.fullName || "Unknown");
      formData.append("userPhone", currentUser?.contactNo || "");
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

  const handleEmailReport = async () => {
    if (!emailConfig.reportTo && !emailConfig.powerAutomateWebhook) {
      showToast("⚠ Please set email address in Admin → Email Config first");
      return;
    }

    setEmailBusy(true);
    try {
      const pdfResult = await buildPDF({ download: false });
      if (!pdfResult) {
        setEmailBusy(false);
        return;
      }

      const success = await sendEmailWithPDF(pdfResult.blob, pdfResult.fileName);
      setEmailBusy(false);
    } catch (e) {
      showToast("✗ Error: " + e.message);
      setEmailBusy(false);
    }
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, flexDirection: "column", gap: 12 }}><Spin size={22} color={C.teal} /><div style={{ color: C.teal, fontSize: 14, fontWeight: 600 }}>Loading…</div></div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{CSS}</style>
      <Toast msg={toast} />

      {/* Header */}
      <div className="app-hdr">
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, border: "1px solid rgba(255,255,255,.2)" }}>⚡</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: ".02em" }}>Electrical Inspection</div>
          <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".09em" }}>Aquarius Engineers</div>
        </div>
        {photoCount > 0 && <div style={{ background: "rgba(245,166,35,.2)", borderRadius: 8, padding: "5px 10px", border: "1px solid rgba(245,166,35,.35)", fontSize: 12, color: "#F5A623", fontWeight: 700, flexShrink: 0 }}>📷 {photoCount}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 7, borderLeft: "1px solid rgba(255,255,255,.15)", paddingLeft: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}>{currentUser.fullName[0]}</div>
          {currentUser.role === "admin" && <button className="btn" onClick={onGotoAdmin} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", fontSize: 11.5, padding: "6px 11px" }}>⚙ Admin</button>}
          <button className="btn" onClick={onLogout} style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.15)", fontSize: 11.5, padding: "6px 11px" }}>Out</button>
        </div>
      </div>
      <div className="hdr-accent" />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 14px 90px" }}>

        {/* ── STEP 1: Form Header ── */}
        <div className="card anim" style={{ padding: 18, marginBottom: 14 }}>
          <div className="sec-hd">📅 Inspection Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
            <div>
              <label className="lbl">Product *</label>
              <select className="inp" value={product} onChange={e => { setProduct(e.target.value); setAnswers({}); setPhotos({}); setSubmitted(false); }}>
                <option value="">— Select Product —</option>
                {products.map(p => <option key={p} value={p}>{p === "Plant" ? "🏭 Plant" : "🚧 Boom Pump"}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Model (Dropdown)</label>
              <select className="inp" value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!product}>
                <option value="">— Select Model —</option>
                {filteredModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Date *</label>
              <input type="date" className="inp" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Model Number</label>
              <input className="inp" placeholder="Type model number…" value={modelInput} onChange={e => setModelInput(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Customer Name</label>
              <input className="inp" placeholder="Enter customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Cabin Sr. No.</label>
              <input className="inp" placeholder="Cabin serial number" value={cabinSrNo} onChange={e => setCabinSrNo(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Dispatch Date</label>
              <input type="date" className="inp" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Progress (only when product selected) ── */}
        {product && totalItems > 0 && (
          <div className="card anim" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[["✓ OK", okCount, "#16a34a", "#f0fdf4", "#86efac"], ["✗ Not OK", notOkCount, "#dc2626", "#fef2f2", "#fca5a5"], ["📷 Photos", photoCount, C.td, C.tl, C.border]].map(([lbl, val, tc, bg, bc]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 7, background: bg, border: `1px solid ${bc}`, borderRadius: 10, padding: "7px 13px" }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: tc, fontFamily: "Playfair Display,serif", lineHeight: 1 }}>{val}</span>
                    <span style={{ fontSize: 11, color: tc, fontWeight: 700 }}>{lbl}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="playfair" style={{ fontSize: 28, fontWeight: 800, color: pct === 100 ? "#16a34a" : C.teal, lineHeight: 1 }}>{pct}<span style={{ fontSize: 13 }}>%</span></div>
                <div style={{ fontSize: 11, color: C.textLight }}>{doneItems}/{totalItems}</div>
              </div>
            </div>
            <div className="prog-bar">
              <div className="prog-fill" style={{ width: `${pct}%`, background: pct === 100 ? "linear-gradient(to right,#16a34a,#22c55e)" : `linear-gradient(to right,${C.teal},${C.amber})` }} />
            </div>
          </div>
        )}

        {/* ── Checklist Sections ── */}
        {!product || !date ? (
          <div className="card anim" style={{ padding: 24, textAlign: "center", borderLeft: `4px solid ${C.amber}`, background: "#fffbf0" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Complete Required Fields</div>
            <div style={{ fontSize: 13, color: C.textMid }}>Please select <strong>Product</strong> and <strong>Date</strong> to begin the inspection checklist.</div>
          </div>
        ) : product && filteredSections.length === 0 && (
          <div className="card anim" style={{ padding: 36, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No checklists for {product}</div>
            <div style={{ fontSize: 13, color: C.textLight, marginTop: 5 }}>Ask admin to add sections for this product.</div>
          </div>
        )}

        {product && filteredSections.map(([key, sec]) => {
          const sOpen = openSections[key] !== false;
          const secDone = sec.items.filter((_, idx) => answers[key]?.[idx]?.status).length;
          const secOk = sec.items.filter((_, idx) => answers[key]?.[idx]?.status === "OK").length;
          const secNotOk = sec.items.filter((_, idx) => answers[key]?.[idx]?.status === "NOT OK").length;
          const secPct = sec.items.length ? Math.round(secDone / sec.items.length * 100) : 0;

          return (
            <div key={key} className="section-card anim">
              {/* Section header */}
              <div className="section-hdr" onClick={() => toggleSection(key)}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.tdeep},${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {sec.product === "Plant" ? "🏭" : "🚧"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{sec.section}</div>
                  <div style={{ fontSize: 11.5, color: C.textLight, marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{secDone}/{sec.items.length} done</span>
                    {secOk > 0 && <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ {secOk} OK</span>}
                    {secNotOk > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}>✗ {secNotOk} Not OK</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: secPct === 100 ? "#16a34a" : C.teal }}>{secPct}%</div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth="2.5" style={{ transform: sOpen ? "rotate(180deg)" : "none", transition: "transform .22s" }}><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>

              {/* Section body */}
              <div className={`section-body ${sOpen ? "open" : "closed"}`}>
                {/* Desktop header */}
                <div className="cl-hdr-row" style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 1fr 88px" }}>
                  {["Sr.", "Description", "Status", "Remarks / Observation", "Photo"].map(h => (
                    <div key={h} style={{ fontSize: 9.5, fontWeight: 800, color: C.textLight, letterSpacing: ".07em", textTransform: "uppercase", padding: "0 4px" }}>{h}</div>
                  ))}
                </div>

                {sec.items.map((item, idx) => {
                  const ans = answers[key]?.[idx] || {};
                  const ph = photos[key]?.[idx];
                  const fkey = key + "_" + idx;
                  if (!fileRefs.current[fkey]) fileRefs.current[fkey] = null;
                  const isOk = ans.status === "OK", isNotOk = ans.status === "NOT OK";

                  return (
                    <div key={idx} className={`cl-row${isOk ? " ok-row" : isNotOk ? " notok-row" : ""}`} style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 1fr 88px", gap: 8, alignItems: "center" }}>

                      {/* Sr */}
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.tl, border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: C.td, flexShrink: 0 }}>{idx + 1}</div>

                      {/* Description */}
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>
                        <span className="cl-row-mobile-label">Description</span>
                        {item}
                      </div>

                      {/* Status */}
                      <div>
                        <span className="cl-row-mobile-label">Status</span>
                        <div className="st-wrap">
                          <button className={`st-ok${isOk ? " active" : ""}`} onClick={() => setStatus(key, idx, "OK")}>✓ OK</button>
                          <button className={`st-notok${isNotOk ? " active" : ""}`} onClick={() => setStatus(key, idx, "NOT OK")}>✗ N/K</button>
                        </div>
                      </div>

                      {/* Remarks */}
                      <div>
                        <span className="cl-row-mobile-label">Remarks</span>
                        <textarea className="ta" rows={2} placeholder="Cable length / Remarks…" value={ans.obs || ""} onChange={e => setObs(key, idx, e.target.value)} />
                      </div>

                      {/* Photo */}
                      <div>
                        <span className="cl-row-mobile-label">Photo</span>
                        {ph ? (
                          <div style={{ position: "relative" }}>
                            <img src={ph.dataUrl} alt="ev" className="photo-thumb" onClick={() => setPreviewPhoto(ph.dataUrl)} style={{ cursor: "pointer" }} />
                            <button onClick={() => removePhoto(key, idx)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "#dc2626", border: "2px solid #fff", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>✕</button>
                          </div>
                        ) : (
                          <div className="upload-zone" onClick={() => { setPendingPhotoUpload({ sectionKey: key, itemIdx: idx }); setShowPhotoUploadModal(true); }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.teal} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                            <span style={{ fontSize: 10.5, color: C.teal, fontWeight: 600 }}>Upload</span>
                          </div>
                        )}
                        <input id={fkey} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                          onChange={e => { handlePhoto(key, idx, e.target.files[0]); }} />
                      </div>
                    </div>
                  );
                })}

                {/* Section signature */}
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.grayBorder}`, background: C.gray, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ borderTop: `2px solid ${C.grayBorder}`, flex: 1, paddingTop: 5, fontSize: 11, color: C.textLight }}>Signature / Name</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Submit ── */}
        {product && filteredSections.length > 0 && !submitted && (
          <div className="card anim" style={{ padding: 18, marginTop: 16 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={pdfBusy} style={{ width: "100%", padding: 16, fontSize: 15, borderRadius: 14, letterSpacing: ".02em" }}>
                {pdfBusy ? <><Spin size={15} /> Generating PDF…</> : "✓ Submit & Download PDF Report"}
              </button>
              <button className="btn btn-amber" onClick={handleEmailReport} disabled={emailBusy || pdfBusy} style={{ width: "100%", padding: 14, fontSize: 14, borderRadius: 14 }}>
                {emailBusy ? <><Spin size={14} /> Opening email…</> : `📧 Email Report${emailConfig.reportTo ? " to " + emailConfig.reportTo : ""}`}
              </button>
            </div>
            {!emailConfig.reportTo && <div style={{ marginTop: 10, fontSize: 12, color: C.textLight, textAlign: "center" }}>💡 Set the recipient email in Admin → Email Config</div>}
          </div>
        )}

        {/* Post-submit card */}
        {submitted && (
          <div className="card anim" style={{ padding: 20, marginTop: 16, borderLeft: `4px solid #16a34a` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#16a34a,#22c55e)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 20, fontWeight: 900 }}>✓</span>
              </div>
              <div>
                <div className="playfair" style={{ fontSize: 16, fontWeight: 800, color: "#15803d" }}>Report Submitted & Downloaded!</div>
                <div style={{ fontSize: 12.5, color: C.textMid, marginTop: 2 }}>{product} · {doneItems}/{totalItems} items · {photoCount} photo{photoCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <button className="btn btn-primary" onClick={() => buildPDF()} disabled={pdfBusy} style={{ padding: 13 }}>⬇ Download Again</button>
              <button className="btn btn-amber" onClick={handleEmailReport} disabled={emailBusy || pdfBusy} style={{ padding: 13 }}>📧 Email Report</button>
            </div>
            <button className="btn btn-ghost" onClick={reset} style={{ width: "100%", padding: 13 }}>✦ New Inspection</button>
          </div>
        )}
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="modal-ov" onClick={() => setPreviewPhoto(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: 0, maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderBottom: `1px solid ${C.grayBorder}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Photo Preview</div>
              <button onClick={() => setPreviewPhoto(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: C.textLight }}>✕</button>
            </div>
            <div style={{ background: "#111", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 280 }}>
              <img src={previewPhoto} alt="preview" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 10, padding: 14, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setPreviewPhoto(null)}>Close</button>
              <a href={previewPhoto} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: "none" }}>Open full size</a>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div className="modal-ov" onClick={() => setShowPhotoUploadModal(false)}>
          <div className="modal-box" style={{ padding: 22 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 16 }}>📸 Upload Photo</div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 18 }}>Choose where to get your photo from:</div>
            <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
              <button className="btn btn-primary" onClick={() => selectPhotoSource("camera")} style={{ width: "100%" }}>
                📷 Take Photo
              </button>
              <button className="btn btn-ghost" onClick={() => selectPhotoSource("gallery")} style={{ width: "100%" }}>
                🖼️ Choose from Gallery
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowPhotoUploadModal(false); setPendingPhotoUpload(null); }} style={{ width: "100%" }}>
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");

  const handleLogin = (u) => {
    setUser(u);
    setView(u.role === "admin" ? "admin" : "inspect");
  };
  const handleLogout = async () => {
    if (hasFirebase()) { try { await signOut(auth); } catch (e) { console.warn(e); } }
    setUser(null); setView("login");
  };

  return (
    <>
      <style>{CSS}</style>
      {/* User Info Bar */}
      {user && view !== "login" && (
        <div style={{
          width: "100%",
          background: "linear-gradient(90deg, #e0f2fe 60%, #f1f5f9 100%)",
          color: "#0f172a",
          padding: "7px 0 7px 0",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          borderBottom: "1.5px solid #bae6fd",
          letterSpacing: ".01em"
        }}>
          <span>👤 {user.fullName}</span>
          <span>🛡 {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}</span>
          {user.contactNo && <span>📞 {user.contactNo}</span>}
        </div>
      )}
      {view === "login" && <LoginPage onLogin={handleLogin} />}
      {view === "admin" && user?.role === "admin" && <AdminPanel currentUser={user} onLogout={handleLogout} onGotoInspect={() => setView("inspect")} />}
      {view === "inspect" && user && <InspectionForm currentUser={user} onLogout={handleLogout} onGotoAdmin={() => setView("admin")} />}
    </>
  );
}
