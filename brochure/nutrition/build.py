# Builds nutrition.html from label data. Run: python3 build.py
FSSAI_LIC = ""   # <-- put the 14-digit FSSAI licence number here

WHEY = dict(
  nut=[("Energy (kcal)","393.49","133.79","6.69%",0),("Protein (Dry Basis) (g)","70.60","24.00","44.45%",2),
       ("Carbohydrate (g)","18.21","6.19","**",0),("Total Sugars (g)","12.87","4.38","**",1),("Added Sugars (g)","0.00","0.00","**",1),
       ("Total Fat (g)","4.25","1.45","2.16%",0),("Saturated Fatty Acids (g)","2.17","0.74","3.36%",1),("MUFA (g)","1.63","0.55","**",1),
       ("PUFA (g)","0.45","0.15","**",1),("Trans Fatty Acids (g)","0.00","0.00","**",1),
       ("Cholesterol (mg)","44.16","15.01","**",0),("Sodium (mg)","118.02","40.13","2.01%",0)],
  amino=[("Alanine","1.05"),("Arginine","0.56"),("Aspartic Acid","2.51"),("Cysteine","0.54"),("Glutamic Acid","4.18"),("Glycine","0.43"),
         ("Histidine","0.42"),("Isoleucine","1.51"),("Leucine","2.51"),("Lysine","2.17"),("Methionine","0.53"),("Phenylalanine","0.75"),
         ("Proline","1.34"),("Serine","1.32"),("Threonine","1.90"),("Tryptophan","0.33"),("Tyrosine","0.68"),("Valine","1.40")],
  bcaa="5.42", eaa="11.52", kcal="133.79")
YEAST = dict(
  nut=[("Energy (kcal)","382.52","130.06","6.50%",0),("Protein (Dry Basis) (g)","70.60","24.00","44.45%",2),
       ("Carbohydrate (g)","12.88","4.38","**",0),("Total Sugars (g)","4.38","1.49","**",1),("Added Sugars (g)","0.00","0.00","**",1),
       ("Total Fat (g)","5.40","1.84","2.75%",0),("Saturated Fatty Acids (g)","3.51","1.19","5.41%",1),("MUFA (g)","1.68","0.57","**",1),
       ("PUFA (g)","0.21","0.07","**",1),("Trans Fatty Acids (g)","0.00","0.00","0.0%",1),("Dietary Fiber (g)","4.38","1.49","4.97%",0),
       ("Cholesterol (g)","0.00","0.00","**",0),("Sodium (mg)","275.38","93.63","4.68%",0)],
  amino=[("Alanine","1.39"),("Arginine","1.54"),("Aspartic Acid","2.56"),("Cysteine","0.16"),("Glutamic Acid","2.67"),("Glycine","1.06"),
         ("Histidine","0.60"),("Isoleucine","1.40"),("Leucine","2.18"),("Lysine","2.25"),("Methionine","0.49"),("Phenylalanine","1.34"),
         ("Proline","0.94"),("Serine","1.24"),("Threonine","1.26"),("Tryptophan","0.36"),("Tyrosine","1.11"),("Valine","1.61")],
  bcaa="5.19", eaa="11.49", kcal="130.06")
BCAA = {"Leucine","Isoleucine","Valine"}

def nut_table(rows):
  h = '<table class="nt"><thead><tr><th>Nutrients</th><th>Per 100g</th><th>Per 34g</th><th>*%RDA</th></tr></thead><tbody>'
  for n,a,b,c,k in rows:
    cls = ' class="sub"' if k==1 else (' class="hero"' if k==2 else '')
    h += f'<tr{cls}><td>{n}</td><td>{a}</td><td>{b}</td><td>{c}</td></tr>'
  return h + '</tbody></table>'

def amino_table(rows, bcaa, eaa):
  h = '<div class="at"><div class="ath">Amino acids <small>g per serving</small></div><ul>'
  for n,v in rows:
    h += f'<li{" class=b" if n in BCAA else ""}><span>{n}</span><b>{v}</b></li>'
  return h + f'</ul><div class="atf"><div><small>BCAA</small><b>{bcaa}g</b></div><div><small>EAA</small><b>{eaa}g</b></div></div></div>'

def product_page(pid, cls, label, title, sub, img, d, n):
  return f'''
<section class="page {cls}" id="p{n}">
  <div class="head">
    <div>
      <span class="tag"><span class="bolt"></span> Nutrition facts · {label}</span>
      <h2 class="d">{title}</h2>
      <p class="sub">{sub}</p>
    </div>
    <img class="sachet" src="../../public/img/{img}" alt="" />
  </div>
  <div class="kpis">
    <div class="kpi hero"><b>24g</b><span>Protein / sachet</span></div>
    <div class="kpi"><b>{d["kcal"]}</b><span>kcal / sachet</span></div>
    <div class="kpi"><b>{d["bcaa"]}g</b><span>BCAA</span></div>
    <div class="kpi"><b>{d["eaa"]}g</b><span>EAA</span></div>
  </div>
  <div class="tables">
    <div class="card nut"><div class="cardh"><b>Nutritional information</b> <span>(Approx.) · Serving size: 1 sachet (34g)</span></div>{nut_table(d["nut"])}</div>
    {amino_table(d["amino"], d["bcaa"], d["eaa"])}
  </div>
  <p class="fn">*%RDA values per serve established as per ICMR 2020 guidelines for men, sedentary work. **RDA values not established. <span class="key"><i></i> Highlighted = BCAAs (leucine, isoleucine, valine)</span></p>
  <div class="foot"><img src="../../public/img/logo-dark.png" alt="OG" /><span class="pg">0{n}/03</span></div>
</section>'''

INS = [("INS 415","Xanthan gum","Stabilizer — keeps the shake smooth"),("INS 955","Sucralose","Zero-calorie sweetener"),
       ("INS 950","Acesulfame-K","Zero-calorie sweetener"),("INS 551","Silicon dioxide","Anticaking — stops clumping"),
       ("Papain","From papaya","Digestive enzyme")]
lic = FSSAI_LIC or "Licence no. to be added"
ins_html = "".join(f'<div class="ins"><b>{a}</b><span>{b}</span><small>{c}</small></div>' for a,b,c in INS)

page3 = f'''
<section class="page ingr" id="p3">
  <span class="tag"><span class="bolt"></span> What's inside · 03</span>
  <h2 class="d">Ingredients<span class="o">.</span></h2>
  <p class="sub">Nothing hidden. Here's every ingredient, straight from the pack.</p>
  <div class="ingcards">
    <div class="ing whey"><div class="ingh"><span class="dot"></span><b>Whey Protein Concentrate</b><em>Vanilla</em></div>
      <p>Whey Protein Concentrate, Whey Powder, Nature Identical Flavouring Substances – Vanilla Flavour, Stabilizer (INS 415), Sweetener (INS 955 &amp; 950), Anticaking Agent (INS 551), Digestive Enzymes (Papain).</p></div>
    <div class="ing yeast"><div class="ingh"><span class="dot"></span><b>Fermented Yeast Protein</b><em>Choco Berry</em></div>
      <p>Fermented Yeast Protein, Cocoa Solids, Sodium Chloride, Nature Identical Flavouring Substances – Chocolate Berry Flavour, Stabilizer (INS 415), Sweetener (INS 955 &amp; 950), Anticaking Agent (INS 551), Digestive Enzyme (Papain).</p></div>
  </div>
  <div class="decoder"><div class="dh">Label decoder</div><div class="insgrid">{ins_html}</div></div>
  <div class="trust">
    <div class="badge fssai"><div class="fs">fssai</div><div><small>FSSAI licensed</small><b class="{"" if FSSAI_LIC else "todo"}">{lic}</b></div></div>
    <div class="badge"><div class="veg"><i></i></div><div><small>Vegetarian</small><b>Green dot mark</b></div></div>
    <div class="badge"><div class="nb">N</div><div><small>Category</small><b>Nutraceutical</b></div></div>
    <div class="badge"><div class="eu">🇪🇺</div><div><small>Protein source</small><b>Imported from Europe</b></div></div>
  </div>
  <div class="zero"><span>0g added sugar</span><span>0g trans fat</span><span>Papain in every sachet</span></div>
  <p class="legal">Nutraceutical product. Not for medicinal use. Not intended to diagnose, treat, cure or prevent any disease. Use as part of a balanced diet and exercise routine. Keep out of reach of children. Values are approximate, as printed on the pack.</p>
  <div class="foot"><img src="../../public/img/logo-white.png" alt="OG" /><span>+91 98421 21163 · @og__energy · oonlygods@outlook.com</span><span class="pg">03/03</span></div>
</section>'''

html = open("template.html").read()
html = html.replace("<!--PAGES-->",
  product_page("whey","whey","Whey","Whey Protein<br/>Concentrate","Classic dairy protein · imported from Europe","whey-box.webp",WHEY,1)
  + product_page("yeast","yeast","Yeast","Fermented<br/>Yeast Protein","Dairy-free protein · Choco Berry","yeast-box.webp",YEAST,2)
  + page3)
open("nutrition.html","w").write(html)
print("ok")
