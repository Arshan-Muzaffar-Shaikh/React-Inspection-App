#!/usr/bin/env python3
# Fix duplicate declarations
with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the duplicate state declarations in InspectionForm
content = content.replace(
    '''  const [products, setProducts] = useState([]);
  const [productModels, setProductModels] = useState({});
  const [products, setProducts] = useState(PRODUCTS);
  const [productModels, setProductModels] = useState(PRODUCT_MODELS);''',
    '''  const [products, setProducts] = useState([]);
  const [productModels, setProductModels] = useState({});'''
)

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Fixed duplicate declarations")
