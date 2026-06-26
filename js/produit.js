// ============================================================
// Module Produit — recherche par code-barres (scan ou saisie),
// fiche éditable, ajout au stock, et ajout manuel sans code-barres.
// ============================================================

let dernierProduitTrouve = null;
let categoriesCache = [];

async function chargerCategories() {
  try {
    categoriesCache = await API.categories();
  } catch (e) {
    categoriesCache = [
      { id: "fruits_legumes", libelle: "Fruits & légumes" },
      { id: "produits_laitiers", libelle: "Produits laitiers" },
      { id: "viande_poisson", libelle: "Viande & poisson" },
      { id: "epicerie", libelle: "Épicerie" },
      { id: "boissons", libelle: "Boissons" },
      { id: "autre", libelle: "Autre" },
    ];
  }
}

async function chercherProduit(code) {
  afficherResultatScan("Recherche en cours…", false);
  try {
    const data = await API.produit(code);
    dernierProduitTrouve = data;
    await afficherFicheProduit(data);
  } catch (e) {
    afficherResultatScan(e.message || "Produit introuvable.", true);
  }
}

function afficherResultatScan(message, estErreur) {
  const zone = document.getElementById("zone-resultat-scan");
  if (zone) zone.innerHTML = `<div class="resultat ${estErreur ? 'erreur' : ''}">${message}</div>`;
}

// Arrondit à 1 décimale pour l'affichage dans les champs — Open Food Facts
// renvoie parfois des valeurs avec de nombreuses décimales (artefacts de
// calcul flottant), peu lisibles. On garde la précision réelle en mémoire
// côté serveur, seul l'affichage dans le champ est arrondi.
function arrondirAffichage(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "";
  const nombre = parseFloat(valeur);
  return isNaN(nombre) ? "" : Math.round(nombre * 10) / 10;
}

async function afficherFicheProduit(p) {
  if (categoriesCache.length === 0) await chargerCategories();

  const nomManquant = !p.nom || p.nom === "Nom inconnu";
  const unite = p.unite_mesure || "g";
  const quantiteNumerique = extraireQuantiteNumerique(p.quantite_unite, unite);
  const labelUnite100 = unite === "ml" ? "100ml" : unite === "unite" ? "pièce" : "100g";

  document.getElementById("zone-resultat-scan").innerHTML = `
    <div class="carte">
      <label for="champ-nom">Nom du produit</label>
      <input type="text" id="champ-nom" value="${nomManquant ? '' : echapperHtml(p.nom)}"
             placeholder="${nomManquant ? 'Nom inconnu — complète-le ici' : ''}">

      <label for="champ-marque">Marque</label>
      <input type="text" id="champ-marque" value="${p.marque ? echapperHtml(p.marque) : ''}" placeholder="ex: Lipton">

      <label for="champ-categorie">Catégorie</label>
      <select id="champ-categorie">
        ${categoriesCache.map(c => `<option value="${c.id}" ${c.id === (p.categorie || 'autre') ? 'selected' : ''}>${c.libelle}</option>`).join("")}
      </select>

      <div style="display:flex; gap:8px;">
        <div style="flex:1;">
          <label for="champ-quantite-totale">Quantité du contenant</label>
          <input type="number" id="champ-quantite-totale" value="${quantiteNumerique ?? ''}"
                 placeholder="ex: 1500" style="${quantiteNumerique === null ? 'border-color:var(--alerte);' : ''}">
        </div>
        <div style="width:110px;">
          <label for="champ-unite">Unité</label>
          <select id="champ-unite">
            <option value="g" ${unite === 'g' ? 'selected' : ''}>g</option>
            <option value="ml" ${unite === 'ml' ? 'selected' : ''}>ml</option>
            <option value="unite" ${unite === 'unite' ? 'selected' : ''}>unité(s)</option>
          </select>
        </div>
      </div>
      ${quantiteNumerique === null ? `<div class="resultat erreur" style="margin-top:-6px;">Quantité du contenant inconnue — obligatoire pour ajouter au stock.</div>` : ""}

      <div class="macros-grille" style="margin-top:8px;" id="zone-macros-produit">
        <div class="macro">
          Énergie (kcal/${labelUnite100})
          <input type="number" id="champ-kcal" value="${arrondirAffichage(p.energie_kcal_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Protéines (g/${labelUnite100})
          <input type="number" id="champ-proteines" value="${arrondirAffichage(p.proteines_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Glucides (g/${labelUnite100})
          <input type="number" id="champ-glucides" value="${arrondirAffichage(p.glucides_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Lipides (g/${labelUnite100})
          <input type="number" id="champ-lipides" value="${arrondirAffichage(p.lipides_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Sucres (g/${labelUnite100})
          <input type="number" id="champ-sucres" value="${arrondirAffichage(p.sucres_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Sel (g/${labelUnite100})
          <input type="number" id="champ-sel" value="${arrondirAffichage(p.sel_100g)}" style="margin:4px 0 0; padding:6px;">
        </div>
      </div>

      <label for="input-quantite-ajout" style="margin-top:12px;">Quantité ajoutée au stock</label>
      <input type="number" id="input-quantite-ajout" placeholder="laisser vide = quantité totale du contenant">
      <button class="action" id="btn-ajouter-stock">Enregistrer et ajouter au stock</button>
    </div>
  `;

  // Met à jour les libellés "kcal/100g" -> "kcal/pièce" etc. quand on
  // change l'unité (utile par exemple si on bascule un nouveau produit
  // sans code-barres connu vers "unité(s)").
  document.getElementById("champ-unite").addEventListener("change", (e) => {
    const nouvelleUnite = e.target.value;
    const label = nouvelleUnite === "ml" ? "100ml" : nouvelleUnite === "unite" ? "pièce" : "100g";
    document.querySelectorAll("#zone-macros-produit .macro").forEach(macro => {
      macro.childNodes[0].textContent = macro.childNodes[0].textContent.replace(/\/(100g|100ml|pièce)/, `/${label}`);
    });
  });

  document.getElementById("btn-ajouter-stock").addEventListener("click", () => enregistrerEtAjouter(p.code_barres));
}

function extraireQuantiteNumerique(texte, unite) {
  if (!texte) return null;
  if (unite === "unite") {
    const matchUnite = texte.match(/(\d+)/);
    return matchUnite ? parseFloat(matchUnite[1]) : null;
  }
  const match = texte.toLowerCase().replace(",", ".").match(/([\d.]+)\s*(kg|g|l|cl|ml)\b/);
  if (!match) return null;
  const valeur = parseFloat(match[1]);
  const u = match[2];
  const conversions = { g: 1, kg: 1000, ml: 1, cl: 10, l: 1000 };
  return valeur * (conversions[u] ?? 1);
}

function fmt(v) {
  if (v === null || v === undefined) return "?";
  const n = parseFloat(v);
  return isNaN(n) ? v : Math.round(n * 10) / 10;
}

async function enregistrerEtAjouter(codeBarres) {
  const valeur = (id) => {
    const v = document.getElementById(id).value;
    return v === "" ? null : parseFloat(v);
  };
  const texte = (id) => document.getElementById(id).value.trim();

  const quantiteTotale = valeur("champ-quantite-totale");
  const uniteMesure = document.getElementById("champ-unite").value;

  if (quantiteTotale === null) {
    afficherResultatScan("Merci de renseigner la quantité du contenant (obligatoire).", true);
    return;
  }

  const payload = {
    nom: texte("champ-nom") || null,
    marque: texte("champ-marque") || null,
    categorie: document.getElementById("champ-categorie").value,
    quantite_totale: quantiteTotale,
    unite_mesure: uniteMesure,
    energie_kcal_100g: valeur("champ-kcal"),
    proteines_100g: valeur("champ-proteines"),
    glucides_100g: valeur("champ-glucides"),
    lipides_100g: valeur("champ-lipides"),
    sucres_100g: valeur("champ-sucres"),
    sel_100g: valeur("champ-sel"),
  };

  try {
    await API.majProduit(codeBarres, payload);

    const qteAjout = document.getElementById("input-quantite-ajout").value;
    const quantiteAjoutee = qteAjout ? parseFloat(qteAjout) : quantiteTotale;

    const dataStock = await API.ajouterStock(codeBarres, quantiteAjoutee);
    afficherResultatScan(`✓ ${dataStock.message}`, false);
    document.getElementById("input-code-manuel").value = "";
  } catch (e) {
    afficherResultatScan(e.message || "Erreur lors de l'enregistrement.", true);
  }
}

// ---------- Ajout manuel sans code-barres ----------

// Génère un identifiant interne unique pour un produit saisi 100% à la
// main (pas de vrai EAN). Préfixe MAN- pour ne jamais collisionner avec
// un EAN réel (toujours numérique) ni avec le catalogue fruits/légumes
// (préfixe FL-).
function genererCodeBarresManuel() {
  return "MAN-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function ouvrirAjoutManuel() {
  if (categoriesCache.length === 0) await chargerCategories();

  const codeGenere = genererCodeBarresManuel();
  await afficherFicheProduit({
    code_barres: codeGenere,
    nom: "",
    marque: "",
    categorie: "autre",
    unite_mesure: "g",
    quantite_unite: "",
    energie_kcal_100g: null,
    proteines_100g: null,
    glucides_100g: null,
    lipides_100g: null,
    sucres_100g: null,
    sel_100g: null,
  });
  // Insère le message d'intro juste avant le formulaire (pas à la place,
  // contrairement à afficherResultatScan qui écraserait tout).
  const zone = document.getElementById("zone-resultat-scan");
  const messageIntro = document.createElement("div");
  messageIntro.className = "resultat";
  messageIntro.textContent = "Produit sans code-barres — remplis les informations puis ajoute-le au stock.";
  zone.insertBefore(messageIntro, zone.firstChild);
}
