#!/usr/bin/env python3
import re

# Read the file
with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add products and productModels to AdminPanel state
content = content.replace(
    'const [models, setModels] = useState([]);',
    'const [models, setModels] = useState([]);\n  const [products, setProducts] = useState([]);\n  const [productModels, setProductModels] = useState({});'
)

# 2. Add product/model state variables
content = content.replace(
    '  // Model editing\n  const [newModel, setNewModel] = useState("");',
    '''  // Model editing
  const [newModel, setNewModel] = useState("");

  // Product/Model editing
  const [newProduct, setNewProduct] = useState("");
  const [selectedProductForModel, setSelectedProductForModel] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodErr, setProdErr] = useState("");'''
)

# 3. Update useEffect to load products and productModels
content = content.replace(
    'const [cls, mods, ukeys, ec] = await Promise.all([getChecklists(), getModels(), store.list("user:"), getEmailConfig()]);',
    'const [cls, mods, prods, pm, ukeys, ec] = await Promise.all([getChecklists(), getModels(), getProducts(), getProductModels(), store.list("user:"), getEmailConfig()]);'
)

content = content.replace(
    'setChecklists(cls); setModels(mods); setUsers(ulist.filter(Boolean)); setEmailConfigState(ec);',
    'setChecklists(cls); setModels(mods); setProducts(prods); setProductModels(pm); setUsers(ulist.filter(Boolean)); setEmailConfigState(ec);\n      if (prods.length > 0) setSelectedProductForModel(prods[0]);'
)

# 4. Replace the models management functions
old_models_funcs = '''  // ── Models ──
  const addModel = async () => {
    if (!newModel.trim()) return;
    if (models.includes(newModel.trim())) { showToast("⚠ Model already exists"); return; }
    const m = [...models, newModel.trim()];
    setModels(m); await saveModels(m); setNewModel("");
    showToast("✓ Model added");
  };
  const removeModel = async (m) => {
    const updated = models.filter(x => x !== m);
    setModels(updated); await saveModels(updated);
    showToast("✓ Model removed");
  };'''

new_models_funcs = '''  // ── Products ──
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
  };'''

content = content.replace(old_models_funcs, new_models_funcs)

# 5. Update the tab bar to replace "models" tab with "products"
content = re.sub(
    r'\[\["users", "👥 Users"\], \["checklists", "📋 Checklists"\], \["models", "🔩 Models"\], \["email", "📧 Email Config"\]\]\.map',
    '[["users", "👥 Users"], ["checklists", "📋 Checklists"], ["products", "📦 Products & Models"], ["email", "📧 Email Config"]].map',
    content
)

# 6. Replace the models tab content with products & models tab
old_models_tab = '''{tab === "models" && <div className="anim">
          <div style={{ marginBottom: 16 }}>
            <h2 className="playfair" style={{ fontSize: 21, fontWeight: 800, color: C.text }}>Model Management</h2>
            <p style={{ fontSize: 13, color: C.textLight }}>Manage models available in the inspection form dropdown</p>
          </div>
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div className="sec-hd">Add New Model</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input className="inp" placeholder="e.g. SP 80 C" value={newModel} onChange={e => setNewModel(e.target.value)} onKeyDown={e => e.key === "Enter" && addModel()} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={addModel}>Add Model</button>
            </div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {models.map(m => (
                <span key={m} className="tax-pill">
                  {m}
                  <button onClick={() => removeModel(m)}>−</button>
                </span>
              ))}
              {models.length === 0 && <span style={{ color: C.textLight, fontSize: 13 }}>No models added yet.</span>}
            </div>
          </div>
        </div>}'''

new_products_tab = '''{tab === "products" && <div className="anim">
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
        </div>}'''

content = content.replace(old_models_tab, new_products_tab)

# Write the file back
with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Admin panel updated successfully!")
