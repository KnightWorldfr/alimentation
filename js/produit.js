// ============================================================
// Module Produit — recherche par code-barres (scan ou saisie),
// fiche éditable, ajout au stock. Inchangé dans sa logique
// (validée précédemment), juste réécrit pour utiliser le module
// API centralisé au lieu de fetch() direct.
// ============================================================

let dernierProduitTrouve = null;

async function chercherProduit(code) {
  afficherResultatScan("Recherche en cours…", false);
  try {
    const data = await API.produit(code);
    dernierProduitTrouve = data;
    afficherFicheProduit(data);
  } catch (e) {
    afficherResultatScan(e.message || "Produit introuvable.", true);
  }
}

function afficherResultatScan(message, estErreur) {
  const zone = document.getElementById("zone-resultat-scan");
  if (zone) zone.innerHTML = `<div class="resultat ${estErreur ? 'erreur' : ''}">${message}</div>`;
}

function afficherFicheProduit(p) {
  const nomManquant = !p.nom || p.nom === "Nom inconnu";
  const unite = p.unite_mesure || "g";
  const quantiteNumerique = extraireQuantiteNumerique(p.quantite_unite, unite);

  document.getElementById("zone-resultat-scan").innerHTML = `
    <div class="carte">
      <label for="champ-nom">Nom du produit</label>
      <input type="text" id="champ-nom" value="${nomManquant ? '' : echapperHtml(p.nom)}"
             placeholder="${nomManquant ? 'Nom inconnu — complète-le ici' : ''}">

      <label for="champ-marque">Marque</label>
      <input type="text" id="champ-marque" value="${p.marque ? echapperHtml(p.marque) : ''}" placeholder="ex: Lipton">

      <div style="display:flex; gap:8px;">
        <div style="flex:1;">
          <label for="champ-quantite-totale">Quantité du contenant</label>
          <input type="number" id="champ-quantite-totale" value="${quantiteNumerique ?? ''}"
                 placeholder="ex: 1500" style="${quantiteNumerique === null ? 'border-color:var(--rouge-alerte);' : ''}">
        </div>
        <div style="width:90px;">
          <label for="champ-unite">Unité</label>
          <select id="champ-unite">
            <option value="g" ${unite === 'g' ? 'selected' : ''}>g</option>
            <option value="ml" ${unite === 'ml' ? 'selected' : ''}>ml</option>
          </select>
        </div>
      </div>
      ${quantiteNumerique === null ? `<div class="resultat erreur" style="margin-top:-6px;">Quantité du contenant inconnue — obligatoire pour ajouter au stock.</div>` : ""}

      <div class="macros-grille" style="margin-top:8px;">
        <div class="macro">
          Énergie (kcal/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-kcal" value="${p.energie_kcal_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Protéines (g/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-proteines" value="${p.proteines_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Glucides (g/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-glucides" value="${p.glucides_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Lipides (g/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-lipides" value="${p.lipides_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Sucres (g/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-sucres" value="${p.sucres_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
        <div class="macro">
          Sel (g/100${unite === 'ml' ? 'ml' : 'g'})
          <input type="number" id="champ-sel" value="${p.sel_100g ?? ''}" style="margin:4px 0 0; padding:6px;">
        </div>
      </div>

      <label for="input-quantite-ajout" style="margin-top:12px;">Quantité ajoutée au stock</label>
      <input type="number" id="input-quantite-ajout" placeholder="laisser vide = quantité totale du contenant">
      <button class="action" id="btn-ajouter-stock">Enregistrer et ajouter au stock</button>
    </div>
  `;
  document.getElementById("btn-ajouter-stock").addEventListener("click", () => enregistrerEtAjouter(p.code_barres));
}

function extraireQuantiteNumerique(texte, unite) {
  if (!texte) return null;
  const match = texte.toLowerCase().replace(",", ".").match(/([\d.]+)\s*(kg|g|l|cl|ml)\b/);
  if (!match) return null;
  const valeur = parseFloat(match[1]);
  const u = match[2];
  const conversions = { g: 1, kg: 1000, ml: 1, cl: 10, l: 1000 };
  return valeur * (conversions[u] ?? 1);
}

function fmt(v) { return v === null || v === undefined ? "?" : v; }

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
