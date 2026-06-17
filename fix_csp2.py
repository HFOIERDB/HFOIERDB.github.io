with open("F:/codex/HFOI/site.js","r",encoding="utf-8") as f:
    c = f.read()
c = c.replace('"CSP 2025":3', '"CSP-S 2025":3')
c = c.replace('"CSP 2025":4', '"CSP-S 2025":4')
# Also update CSP rating check - "CSP" in contest will still match "CSP-S"
# so no change needed for isCSP
print("Updated:", '"CSP-S 2025":4' in c)
with open("F:/codex/HFOI/site.js","w",encoding="utf-8") as f:
    f.write(c)
