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
  <div class="foot"><img src="../../public/img/logo-dark.png" alt="OG" /><span class="pg">0{n}/05</span></div>
</section>'''

INS = [("INS 415","Xanthan gum","Stabilizer — keeps the shake smooth"),("INS 955","Sucralose","Zero-calorie sweetener"),
       ("INS 950","Acesulfame-K","Zero-calorie sweetener"),("INS 551","Silicon dioxide","Anticaking — stops clumping"),
       ("Papain","From papaya","Digestive enzyme")]
SEALS = [("", "FDA", "Food &amp; Drug<br/>Admin."), ("", "GMP", "Certified"), ("", "HACCP", "Certified"), ("", "WHO", "GMP"),
         ("", "ISO", "22000:2018"), ("", "ISO", "9001:2015"), ("", "ISO", "45001:2018"), ("", "ISO", "14001:2015")]
seals_html = "".join(f'<div class="seal"><div class="in">{"<small>"+t+"</small>" if t else ""}<b>{m}</b><span>{s}</span></div></div>' for t,m,s in SEALS)
lic = FSSAI_LIC or "Licence no. to be added"
ins_html = "".join(f'<div class="ins"><b>{a}</b><span>{b}</span><small>{c}</small></div>' for a,b,c in INS)

FLAV = [("Orange","creatine.webp","orange","Creatine Monohydrate, L-Taurine, Nature Identical Flavouring Substance – Orange Flavour, Sweetener (INS 955), Anticaking Agent (INS 551), Acidity Regulator (INS 330), Permitted Food Colour (INS 110)."),
        ("Fruit Fusion","creatine-fruit-fusion.webp","fruit","Creatine Monohydrate, L-Taurine, Nature Identical Flavouring Substance – Mix Fruit Flavour, Sweetener (INS 955), Anticaking Agent (INS 551), Acidity Regulator (INS 330), Permitted Food Colour (INS 124).")]
flav_html = "".join(f'<div class="flav {c}"><img src="../../public/img/{i}" alt="" /><div><div class="fh"><b>{n}</b><em>Flavour</em></div><p>{t}</p></div></div>' for n,i,c,t in FLAV)

page3 = f'''
<section class="page ingr" id="p4">
  <span class="tag"><span class="bolt"></span> What's inside · 04</span>
  <h2 class="d">Ingredients<span class="o">.</span></h2>
  <p class="sub">Nothing hidden. Here's every ingredient, straight from the pack.</p>
  <div class="ingcards">
    <div class="ing whey"><div class="ingh"><span class="dot"></span><b>Whey Protein Concentrate</b></div>
      <p>Whey Protein Concentrate, Whey Powder, Nature Identical Flavouring Substances, Stabilizer (INS 415), Sweetener (INS 955 &amp; 950), Anticaking Agent (INS 551), Digestive Enzymes (Papain).</p></div>
    <div class="ing yeast"><div class="ingh"><span class="dot"></span><b>Fermented Yeast Protein</b></div>
      <p>Fermented Yeast Protein, Cocoa Solids, Sodium Chloride, Nature Identical Flavouring Substances, Stabilizer (INS 415), Sweetener (INS 955 &amp; 950), Anticaking Agent (INS 551), Digestive Enzyme (Papain).</p></div>
  </div>
  <div class="flavs"><div class="dh">Creatine + Taurine <small>· by flavour — nutritional values are the same for both</small></div>{flav_html}</div>
  <p class="legal">Nutraceutical product. Not for medicinal use. Not intended to diagnose, treat, cure or prevent any disease. Use as part of a balanced diet and exercise routine. Keep out of reach of children. Values are approximate, as printed on the pack.</p>
  <div class="foot"><img src="../../public/img/logo-white.png" alt="OG" /><span>+91 98421 21163 · @og__energy · oonlygods@outlook.com</span><span class="pg">04/05</span></div>
</section>'''


CREA_NUT = [("Energy (kcal)","0","0"),("Protein (g)","0","0"),("Carbohydrate (g)","0","**"),("Total Sugars (g)","0","**"),
            ("Added Sugars (g)","0","**"),("Total Fat (g)","0","0"),("Sodium (mg)","0","0.00")]
crea_rows = "".join(f'<tr{" class=sub" if n.startswith(("Total Sugars","Added")) else ""}><td>{n}</td><td>{q}</td><td>{r}</td></tr>' for n,q,r in CREA_NUT)

cover = """
<section class="page cover" id="p1">
  <div class="glow"></div>
  <div class="top"><img src="../../public/img/logo-white.png" alt="OG" /><span class="tag ghost"><span class="bolt"></span> Nutrition guide</span></div>
  <h1 class="d">Do you<br/>know what's<br/><span class="o">inside</span> the<br/>box<span class="o">?</span></h1>
  <p class="lede">Every gram, every amino acid, every ingredient — laid out in plain sight. <b>Because you deserve to know exactly what you're fuelling with.</b></p>
  <div class="hero-shot">
    <img class="b1" src="../../public/img/whey-box.webp" alt="" />
    <img class="b2" src="../../public/img/yeast-box.webp" alt="" />
    <img class="b3" src="../../public/img/creatine.webp" alt="" />
  </div>
  <div class="index">
    <div><span>02</span><b>Whey Protein</b><small>Nutrition &amp; amino acids</small></div>
    <div><span>03</span><b>Yeast Protein</b><small>Nutrition &amp; amino acids</small></div>
    <div><span>04</span><b>Ingredients</b><small>Every product, in full</small></div>
    <div><span>05</span><b>Creatine + Taurine</b><small>Nutrition &amp; certifications</small></div>
  </div>
  <div class="foot"><span>Nothing hidden · Swipe to open the box →</span><span class="pg">01/05</span></div>
</section>"""

creatine = f"""
<section class="page crea" id="p5">
  <div class="head">
    <span class="tag"><span class="bolt"></span> Nutrition facts · Creatine</span>
    <h2 class="d">Creatine<br/>Monohydrate<br/><span class="t">+ Taurine</span></h2>
    <p class="sub">Serving size 5g · Mix in 200ml water</p>
    <div class="tubs"><img src="../../public/img/creatine-fruit-fusion.webp" alt="" /><img src="../../public/img/creatine.webp" alt="" /></div>
  </div>
  <div class="kpis">
    <div class="kpi hero"><b>3000mg</b><span>Creatine / serving</span></div>
    <div class="kpi hero"><b>1000mg</b><span>L-Taurine / serving</span></div>
    <div class="kpi"><b>0</b><span>kcal</span></div>
    <div class="kpi"><b>0g</b><span>Sugar</span></div>
  </div>
  <div class="ctables">
    <div class="card"><div class="cardh"><b>Nutritional information</b><span>Per serving (5g)</span></div>
      <table class="nt c3"><thead><tr><th>Nutrient</th><th>Qty / serving</th><th>*%RDA</th></tr></thead><tbody>{crea_rows}</tbody></table></div>
    <div class="card"><div class="cardh"><b>Active ingredients</b><span>Per serving (5g)</span></div>
      <table class="nt c3"><thead><tr><th>Ingredient</th><th>Qty</th><th>*%RDA</th></tr></thead><tbody>
        <tr class="hero"><td>Creatine Monohydrate</td><td>3000 mg</td><td>**</td></tr>
        <tr class="hero"><td>L-Taurine</td><td>1000 mg</td><td>**</td></tr></tbody></table>
      <div class="howto"><b>How to use</b><span>Mix 1 serving (5g) in 200ml of water. Follow the directions on the label.</span></div>
    </div>
  </div>
  <div class="certs panel"><div class="dh">Certified quality</div><div class="seals">{seals_html}</div></div>
  <p class="fn">*%RDA values based on ICMR 2020 guidelines for men, sedentary work. **RDA values not established.</p>
  <div class="foot"><img src="../../public/img/logo-dark.png" alt="OG" /><span class="pg">05/05</span></div>
</section>"""

html = open("template.html").read()
html = html.replace("<!--PAGES-->",
  cover + product_page("whey","whey","Whey","Whey Protein<br/>Concentrate","Classic dairy protein · imported from Europe","whey-box.webp",WHEY,2)
  + product_page("yeast","yeast","Yeast","Fermented<br/>Yeast Protein","Dairy-free protein · made by fermentation","yeast-box.webp",YEAST,3)
  + page3 + creatine)
open("nutrition.html","w").write(html)
print("ok")
