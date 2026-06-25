// ============================================================
// Module Stock — vue principale refondue : grille visuelle,
// tri, recherche, et édition directe par clic sur une carte.
// ============================================================

let triStockActuel = "nom";
let rechercheStockActuelle = "";

async function chargerStock() {
  const conteneur = document.getElementById("grille-stock");
  if (!conteneur) return;

  try {
    const items = await API.stock(triStockActuel, rechercheStockActuelle);

    if (items.length === 0) {
      conteneur.innerHTML = `
        <div class="vide">
          ${rechercheStockActuelle
            ? "Aucun produit ne correspond à cette recherche."
            : "Rien en stock pour l'instant. Scanne tes courses pour commencer !"}
        </div>
      `;
      return;
    }

    conteneur.innerHTML = items.map(carteStockHtml).join("");

    items.forEach(item => {
      const carte = document.getElementById(`carte-stock-${item.code_barres}`);
      if (carte) carte.addEventListener("click", () => ouvrirEditionStock(item));
    });
  } catch (e) {
    conteneur.innerHTML = `<div class="vide">Erreur de chargement du stock : ${e.message}</div>`;
  }
}

// Seuil arbitraire pour signaler visuellement un stock bas (sous 15% d'un
// contenant "moyen" de 500g/ml — heuristique simple, pas une vraie limite
// produit par produit, qui nécessiterait une donnée qu'on n'a pas encore).
const SEUIL_STOCK_FAIBLE_G = 75;

function carteStockHtml(item) {
  const faible = item.total_restant_g <= SEUIL_STOCK_FAIBLE_G;
  const kcalInfo = item.energie_kcal_100g != null
    ? `${item.energie_kcal_100g} kcal / 100${item.unite_mesure === "ml" ? "ml" : "g"}`
    : "Valeurs nutritionnelles inconnues";

  // Barre de niveau visuelle (proportion arbitraire sur une base de 500 pour donner un repère)
  const proportion = Math.min(100, (item.total_restant_g / 500) * 100);

  return `
    <div class="carte-stock" id="carte-stock-${item.code_barres}" tabindex="0" role="button"
         aria-label="Modifier ${echapperHtml(item.nom)}">
      <div class="ligne-haut">
        <div>
          <div class="nom">${echapperHtml(item.nom)}</div>
          ${item.marque ? `<div class="marque">${echapperHtml(item.marque)}</div>` : ""}
        </div>
        <div class="quantite ${faible ? 'faible' : ''}">${Math.round(item.total_restant_g)} ${item.unite_mesure || 'g'}</div>
      </div>
      <div class="kcal-info">${kcalInfo}</div>
      <div class="barre-niveau ${faible ? 'faible' : ''}" style="width:${proportion}%"></div>
    </div>
  `;
}

// ---------- Modale d'édition rapide depuis la grille ----------

function ouvrirEditionStock(item) {
  const unite = item.unite_mesure || "g";
  ouvrirModale(echapperHtml(item.nom), `
    <div class="resultat">
      Actuellement : <strong>${Math.round(item.total_restant_g)} ${unite}</strong>
    </div>

    <label for="ed-stock-quantite">Nouvelle quantité (${unite})</label>
    <input type="number" id="ed-stock-quantite" value="${item.total_restant_g}">

    <label for="ed-stock-motif">Motif (optionnel)</label>
    <input type="text" id="ed-stock-motif" placeholder="ex: Périmé, consommé sans noter...">

    <button class="action" id="btn-valider-correction-stock">Mettre à jour le stock</button>
    <button class="action secondaire" id="btn-consommer-rapide" style="margin-top:8px;">
      Décompter une quantité consommée
    </button>
  `);

  document.getElementById("btn-valider-correction-stock").addEventListener("click", async () => {
    const nouvelleQte = parseFloat(document.getElementById("ed-stock-quantite").value);
    const motif = document.getElementById("ed-stock-motif").value.trim();
    if (isNaN(nouvelleQte) || nouvelleQte < 0) {
      afficherToastModale("Merci de saisir une quantité valide.", true);
      return;
    }
    try {
      await API.corrigerStock(item.code_barres, nouvelleQte, motif || null);
      fermerModale();
      chargerStock();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });

  document.getElementById("btn-consommer-rapide").addEventListener("click", () => {
    ouvrirFormulaireConsommationRapide(item);
  });
}

function ouvrirFormulaireConsommationRapide(item) {
  const unite = item.unite_mesure || "g";
  const profilActifId = getProfilActifId();

  ouvrirModale(`Consommer : ${echapperHtml(item.nom)}`, `
    <label for="conso-rapide-quantite">Quantité consommée (${unite})</label>
    <input type="number" id="conso-rapide-quantite" placeholder="ex: 50">

    <label for="conso-rapide-profil">Qui ?</label>
    <select id="conso-rapide-profil">
      <option value="">Sans profil</option>
      ${profilsCache.map(p => `<option value="${p.id}" ${p.id === profilActifId ? "selected" : ""}>${echapperHtml(p.nom)}</option>`).join("")}
    </select>

    <button class="action" id="btn-valider-conso-rapide">Décompter</button>
  `);

  document.getElementById("btn-valider-conso-rapide").addEventListener("click", async () => {
    const qte = parseFloat(document.getElementById("conso-rapide-quantite").value);
    const profilId = document.getElementById("conso-rapide-profil").value || null;
    if (isNaN(qte) || qte <= 0) {
      afficherToastModale("Merci de saisir une quantité valide.", true);
      return;
    }
    try {
      await API.consommerStock(item.code_barres, qte, "Consommation rapide", profilId ? parseInt(profilId) : null);
      fermerModale();
      chargerStock();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

// ---------- Barre d'outils : tri + recherche ----------

function initBarreOutilsStock() {
  const inputRecherche = document.getElementById("recherche-stock");
  const selectTri = document.getElementById("tri-stock");
  if (!inputRecherche || !selectTri) return;

  let debounceTimer = null;
  inputRecherche.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      rechercheStockActuelle = inputRecherche.value.trim();
      chargerStock();
    }, 250);
  });

  selectTri.addEventListener("change", () => {
    triStockActuel = selectTri.value;
    chargerStock();
  });
}
