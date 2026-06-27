// ============================================================
// Module Sélecteur de produit — modale de recherche réutilisable
// pour choisir un produit du stock, avec recherche texte et
// groupement par catégorie. Remplace les <select> plats peu
// lisibles dès que le stock contient beaucoup de produits.
//
// Utilisé par : ingrédients de recette, consommation libre.
// ============================================================

const ORDRE_CATEGORIES_SELECTEUR = [
  "fruits_legumes", "produits_laitiers", "viande_poisson",
  "produits_secs", "epicerie", "produits_sucres",
  "snacks_aperitif", "boissons", "autre",
];

/**
 * Ouvre une modale de sélection d'un produit du stock.
 * @param {function} onSelection - appelé avec l'item du stock choisi.
 * @param {string} titre - titre de la modale (par défaut générique).
 */
async function ouvrirSelecteurProduitStock(onSelection, titre = "Choisir un produit") {
  if (stockDisponibleCache.length === 0) {
    await rafraichirStockDisponiblePourSelects();
  }

  ouvrirModale(titre, `
    <input type="text" id="recherche-selecteur-produit" placeholder="Rechercher un produit…" autofocus>
    <div id="liste-selecteur-produit" style="max-height:48vh; overflow-y:auto;"></div>
    <div class="separateur-selecteur"></div>
    <p style="font-size:0.78rem; color:var(--texte-att); margin-bottom:8px;">
      Le produit n'est pas dans le stock ?
    </p>
    <button class="action secondaire petit" id="btn-aller-scanner-depuis-selecteur" style="width:100%;">
      📷 Aller le scanner ou l'ajouter (ta saisie en cours sera conservée)
    </button>
  `);

  afficherResultatsSelecteur(stockDisponibleCache, onSelection);

  document.getElementById("recherche-selecteur-produit").addEventListener("input", (e) => {
    const terme = e.target.value.toLowerCase().trim();
    const filtres = terme
      ? stockDisponibleCache.filter(item =>
          item.nom.toLowerCase().includes(terme) ||
          (item.marque && item.marque.toLowerCase().includes(terme))
        )
      : stockDisponibleCache;
    afficherResultatsSelecteur(filtres, onSelection);
  });

  document.getElementById("btn-aller-scanner-depuis-selecteur").addEventListener("click", () => {
    fermerModale();
    sauvegarderEtatRecetteEnCours();
    activerVue("scan");
  });
}

function afficherResultatsSelecteur(items, onSelection) {
  const zone = document.getElementById("liste-selecteur-produit");
  if (items.length === 0) {
    zone.innerHTML = `<div class="vide">Aucun produit ne correspond.</div>`;
    return;
  }

  // Groupe par catégorie pour une lecture plus rapide, comme dans le Stock.
  const groupes = {};
  items.forEach(item => {
    const cat = item.categorie || "autre";
    if (!groupes[cat]) groupes[cat] = [];
    groupes[cat].push(item);
  });
  const categoriesTriees = Object.keys(groupes).sort(
    (a, b) => ORDRE_CATEGORIES_SELECTEUR.indexOf(a) - ORDRE_CATEGORIES_SELECTEUR.indexOf(b)
  );

  zone.innerHTML = categoriesTriees.map(cat => `
    <div class="groupe-categorie-selecteur">
      <div class="titre-categorie-selecteur">${LIBELLES_CATEGORIE_JS[cat] || "Autre"}</div>
      ${groupes[cat].map(item => itemSelecteurHtml(item)).join("")}
    </div>
  `).join("");

  items.forEach(item => {
    const el = document.getElementById(`selecteur-item-${item.code_barres}`);
    if (el) el.addEventListener("click", () => {
      fermerModale();
      onSelection(item);
    });
  });
}

function itemSelecteurHtml(item) {
  const uniteAffichee = item.unite_mesure === "unite" ? "pièce(s)" : item.unite_mesure;
  const restantAffiche = item.unite_mesure === "unite" && item.poids_unite_g
    ? (item.total_restant_g / item.poids_unite_g).toFixed(1)
    : Math.round(item.total_restant_g);

  return `
    <div class="item-selecteur-produit" id="selecteur-item-${item.code_barres}">
      <div class="infos-item-selecteur">
        <div class="nom-item-selecteur">${echapperHtml(item.nom)}</div>
        ${item.marque ? `<div class="marque-item-selecteur">${echapperHtml(item.marque)}</div>` : ""}
      </div>
      <div class="quantite-item-selecteur">${restantAffiche} ${uniteAffichee}</div>
    </div>
  `;
}
