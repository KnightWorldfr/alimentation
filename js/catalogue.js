// ============================================================
// Module Catalogue — fruits/légumes courants sans code-barres
// fiable en magasin, sélectionnables directement pour ajout au
// stock sans passer par un scan.
// ============================================================

let catalogueCache = [];

async function chargerCatalogueFruitsLegumes() {
  try {
    catalogueCache = await API.catalogueFruitsLegumes();
  } catch (e) {
    catalogueCache = [];
  }
  return catalogueCache;
}

async function ouvrirCatalogueFruitsLegumes() {
  if (catalogueCache.length === 0) await chargerCatalogueFruitsLegumes();

  ouvrirModale("Fruits & légumes", `
    <label for="recherche-catalogue">Rechercher</label>
    <input type="text" id="recherche-catalogue" placeholder="ex: tomate, avocat…">
    <div id="liste-catalogue-resultats" style="max-height:50vh; overflow-y:auto;"></div>
  `);

  afficherResultatsCatalogue(catalogueCache);

  document.getElementById("recherche-catalogue").addEventListener("input", (e) => {
    const terme = e.target.value.toLowerCase().trim();
    const filtres = terme
      ? catalogueCache.filter(a => a.nom.toLowerCase().includes(terme))
      : catalogueCache;
    afficherResultatsCatalogue(filtres);
  });
}

function afficherResultatsCatalogue(articles) {
  const zone = document.getElementById("liste-catalogue-resultats");
  if (articles.length === 0) {
    zone.innerHTML = `<div class="vide">Aucun résultat.</div>`;
    return;
  }
  zone.innerHTML = articles.map(a => `
    <div class="carte-profil" id="catalogue-${a.id}" style="cursor:pointer; margin-bottom:6px;">
      <div class="infos-profil">
        <div class="nom-profil">${echapperHtml(a.nom)}</div>
        <div class="meta-profil">${a.kcal} kcal/100${a.unite_mesure === 'unite' ? 'g (pièce ~' + a.poids_unite_g + 'g)' : a.unite_mesure}</div>
      </div>
    </div>
  `).join("");

  articles.forEach(a => {
    document.getElementById(`catalogue-${a.id}`).addEventListener("click", () => ouvrirQuantiteCatalogue(a));
  });
}

function ouvrirQuantiteCatalogue(article) {
  const uniteLabel = article.unite_mesure === "unite" ? "Nombre de pièces" : `Quantité (${article.unite_mesure})`;

  ouvrirModale(`Ajouter : ${echapperHtml(article.nom)}`, `
    <label for="qte-catalogue">${uniteLabel}</label>
    <input type="number" id="qte-catalogue" placeholder="${article.unite_mesure === 'unite' ? 'ex: 2' : 'ex: 200'}" autofocus>
    <button class="action" id="btn-valider-catalogue">Ajouter au stock</button>
  `);

  document.getElementById("btn-valider-catalogue").addEventListener("click", async () => {
    const quantite = parseFloat(document.getElementById("qte-catalogue").value);
    if (!quantite || quantite <= 0) {
      afficherToastModale("Indique une quantité valide.", true);
      return;
    }
    try {
      const resultat = await API.ajouterFruitLegumeAuStock(article.id, quantite);
      fermerModale();
      afficherResultatScan(`✓ ${resultat.message}`, false);
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}
