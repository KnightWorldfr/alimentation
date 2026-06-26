// ============================================================
// Module Stock — vue principale : grille visuelle groupée par
// catégorie, tri, recherche, et édition directe (nom/marque/macros/
// quantité) par clic sur une carte.
// ============================================================

let triStockActuel = "nom";
let rechercheStockActuelle = "";
let regroupementCategorieActif = true;

async function chargerStock(tentative = 1) {
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

    if (regroupementCategorieActif && !rechercheStockActuelle) {
      conteneur.innerHTML = construireGroupesParCategorie(items);
    } else {
      conteneur.innerHTML = `<div class="grille-stock">${items.map(carteStockHtml).join("")}</div>`;
    }

    items.forEach(item => {
      const carte = document.getElementById(`carte-stock-${item.code_barres}`);
      if (carte) carte.addEventListener("click", () => ouvrirEditionStock(item));
    });
  } catch (e) {
    // Réessai automatique : juste après un refresh/réveil de l'app, un
    // VPN comme Tailscale (notamment sur iOS, qui suspend agressivement
    // les apps/VPN en arrière-plan) peut avoir besoin d'un court instant
    // pour rétablir la connexion. On retente avant d'afficher une erreur.
    if (tentative < 3) {
      conteneur.innerHTML = `<div class="vide">Connexion au serveur…</div>`;
      await new Promise(r => setTimeout(r, 1200));
      return chargerStock(tentative + 1);
    }

    const urlActuelle = getApiUrl();
    conteneur.innerHTML = `
      <div class="vide">
        Erreur de chargement du stock.<br>
        <span style="font-size:0.7rem; color:var(--texte-faible);">
          Détail : ${echapperHtml(e.message || "inconnue")}<br>
          Serveur configuré : ${echapperHtml(urlActuelle || "aucun")}
        </span><br>
        <button class="action secondaire petit" id="btn-reessayer-stock" style="margin-top:10px;">Réessayer</button>
      </div>
    `;
    const btn = document.getElementById("btn-reessayer-stock");
    if (btn) btn.addEventListener("click", () => chargerStock());
  }
}

function construireGroupesParCategorie(items) {
  const groupes = {};
  items.forEach(item => {
    const cat = item.categorie || "autre";
    if (!groupes[cat]) groupes[cat] = [];
    groupes[cat].push(item);
  });

  // Ordre d'affichage privilégié, "autre" toujours en dernier.
  const ordreAffichage = ["fruits_legumes", "produits_laitiers", "viande_poisson", "epicerie", "snacks_aperitif", "boissons", "autre"];
  const categoriesTriees = Object.keys(groupes).sort(
    (a, b) => ordreAffichage.indexOf(a) - ordreAffichage.indexOf(b)
  );

  return categoriesTriees.map(cat => `
    <div class="groupe-categorie">
      <h3 class="titre-categorie">${LIBELLES_CATEGORIE_JS[cat] || "Autre"} <span class="compte-categorie">${groupes[cat].length}</span></h3>
      <div class="grille-stock">${groupes[cat].map(carteStockHtml).join("")}</div>
    </div>
  `).join("");
}

const LIBELLES_CATEGORIE_JS = {
  fruits_legumes: "🥦 Fruits & légumes",
  produits_laitiers: "🥛 Produits laitiers",
  viande_poisson: "🍗 Viande & poisson",
  epicerie: "🛒 Épicerie",
  snacks_aperitif: "🍿 Snacks & apéro",
  boissons: "🥤 Boissons",
  autre: "📦 Autre",
};

function carteStockHtml(item) {
  // Seuil relatif à la quantité achetée (25% du lot), pas une valeur
  // absolue — un petit sachet d'épices plein ne doit pas être signalé
  // comme "faible" juste parce qu'il pèse peu en absolu.
  const pourcentage = item.pourcentage_restant ?? 100;
  const faible = pourcentage <= 25;
  const unite = item.unite_mesure === "unite" ? "" : (item.unite_mesure || "g");
  const kcalInfo = item.energie_kcal_100g != null
    ? `${arrondirAffichage1(item.energie_kcal_100g)} kcal / ${item.unite_mesure === 'unite' ? 'pièce' : (item.unite_mesure === 'ml' ? '100ml' : '100g')}`
    : "Valeurs nutritionnelles inconnues";

  const quantiteAffichee = item.unite_mesure === "unite"
    ? `${Math.round(item.total_restant_g)} g`  // converti en interne ; affichage approx en pièces géré dans la modale
    : `${Math.round(item.total_restant_g)} ${unite}`;

  return `
    <div class="carte-stock" id="carte-stock-${item.code_barres}" tabindex="0" role="button"
         aria-label="Modifier ${echapperHtml(item.nom)}">
      <div class="ligne-haut">
        <div>
          <div class="nom">${echapperHtml(item.nom)}</div>
          ${item.marque ? `<div class="marque">${echapperHtml(item.marque)}</div>` : ""}
        </div>
        <div class="quantite ${faible ? 'faible' : ''}">${quantiteAffichee}</div>
      </div>
      <div class="kcal-info">${kcalInfo}</div>
      <div class="barre-niveau ${faible ? 'faible' : ''}" style="--niveau:${pourcentage}%"></div>
    </div>
  `;
}

function arrondirAffichage1(v) {
  if (v === null || v === undefined) return "?";
  return Math.round(parseFloat(v) * 10) / 10;
}

// ---------- Modale d'édition complète depuis la grille ----------
// Inclut maintenant nom, marque, catégorie, macros — pas seulement la
// quantité — pour pouvoir corriger une fiche produit après coup (ex:
// renommer "Riz basmati" différemment de ce qui avait été tapé au scan).

async function ouvrirEditionStock(item) {
  if (categoriesCache.length === 0) await chargerCategories();
  const unite = item.unite_mesure || "g";
  const nbPiecesActuel = (unite === "unite" && item.poids_unite_g)
    ? (item.total_restant_g / item.poids_unite_g).toFixed(1)
    : null;

  ouvrirModale(echapperHtml(item.nom), `
    <div class="resultat">
      Actuellement : <strong>${nbPiecesActuel ? nbPiecesActuel + ' pièce(s)' : Math.round(item.total_restant_g) + ' ' + unite}</strong>
      (${item.pourcentage_restant ?? 100}% du lot acheté)
    </div>

    <label for="ed-nom">Nom</label>
    <input type="text" id="ed-nom" value="${echapperHtml(item.nom)}">

    <label for="ed-marque">Marque</label>
    <input type="text" id="ed-marque" value="${item.marque ? echapperHtml(item.marque) : ''}">

    <label for="ed-categorie">Catégorie</label>
    <select id="ed-categorie">
      ${categoriesCache.map(c => `<option value="${c.id}" ${c.id === (item.categorie || 'autre') ? 'selected' : ''}>${c.libelle}</option>`).join("")}
    </select>

    ${unite === 'unite' ? `
      <label for="ed-poids-piece">Poids d'une pièce (g)</label>
      <input type="number" id="ed-poids-piece" value="${item.poids_unite_g ?? ''}" placeholder="ex: 125">
    ` : ''}

    <label for="ed-stock-quantite">Nouvelle quantité restante (${unite === 'unite' ? 'g' : unite})</label>
    <input type="number" id="ed-stock-quantite" value="${item.total_restant_g}">

    <label for="ed-stock-motif">Motif de la correction (optionnel)</label>
    <input type="text" id="ed-stock-motif" placeholder="ex: Périmé, consommé sans noter...">

    <div class="macros-grille" style="margin-bottom:14px;">
      <div class="macro">
        Énergie (kcal/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-kcal" value="${arrondirAffichage1(item.energie_kcal_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
      <div class="macro">
        Protéines (g/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-proteines" value="${arrondirAffichage1(item.proteines_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
      <div class="macro">
        Glucides (g/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-glucides" value="${arrondirAffichage1(item.glucides_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
      <div class="macro">
        Lipides (g/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-lipides" value="${arrondirAffichage1(item.lipides_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
      <div class="macro">
        Sucres (g/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-sucres" value="${arrondirAffichage1(item.sucres_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
      <div class="macro">
        Sel (g/${unite === 'ml' ? '100ml' : unite === 'unite' ? 'pièce' : '100g'})
        <input type="number" id="ed-sel" value="${arrondirAffichage1(item.sel_100g)}" style="margin:4px 0 0; padding:6px;">
      </div>
    </div>

    <button class="action" id="btn-valider-correction-stock">Enregistrer les modifications</button>
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

    const valeur = (id) => {
      const v = document.getElementById(id).value;
      return v === "" ? null : parseFloat(v);
    };

    try {
      // 1. Met à jour la fiche produit (nom, marque, catégorie, macros)
      const champPoidsPiece = document.getElementById("ed-poids-piece");
      await API.majProduit(item.code_barres, {
        nom: document.getElementById("ed-nom").value.trim() || null,
        marque: document.getElementById("ed-marque").value.trim() || null,
        categorie: document.getElementById("ed-categorie").value,
        poids_unite_g: champPoidsPiece ? valeur("ed-poids-piece") : null,
        energie_kcal_100g: valeur("ed-kcal"),
        proteines_100g: valeur("ed-proteines"),
        glucides_100g: valeur("ed-glucides"),
        lipides_100g: valeur("ed-lipides"),
        sucres_100g: valeur("ed-sucres"),
        sel_100g: valeur("ed-sel"),
      });
      // 2. Corrige la quantité si elle a changé
      if (nouvelleQte !== item.total_restant_g) {
        await API.corrigerStock(item.code_barres, nouvelleQte, motif || null);
      }
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
  const uniteAffichee = unite === "unite" ? "pièce(s)" : unite;
  const profilActifId = getProfilActifId();

  ouvrirModale(`Consommer : ${echapperHtml(item.nom)}`, `
    <label for="conso-rapide-quantite">Quantité consommée (${uniteAffichee})</label>
    <input type="number" id="conso-rapide-quantite" placeholder="${unite === 'unite' ? 'ex: 1' : 'ex: 50'}">

    <label for="conso-rapide-profil">Qui ?</label>
    <select id="conso-rapide-profil">
      <option value="">Sans profil</option>
      ${profilsCache.map(p => `<option value="${p.id}" ${p.id === profilActifId ? "selected" : ""}>${echapperHtml(p.nom)}</option>`).join("")}
    </select>

    <button class="action" id="btn-valider-conso-rapide">Décompter</button>
  `);

  document.getElementById("btn-valider-conso-rapide").addEventListener("click", async () => {
    const qteSaisie = parseFloat(document.getElementById("conso-rapide-quantite").value);
    const profilId = document.getElementById("conso-rapide-profil").value || null;
    if (isNaN(qteSaisie) || qteSaisie <= 0) {
      afficherToastModale("Merci de saisir une quantité valide.", true);
      return;
    }
    // Conversion pièces -> grammes internes si le produit est en "unite".
    const qte = (unite === "unite" && item.poids_unite_g) ? qteSaisie * item.poids_unite_g : qteSaisie;
    try {
      await API.consommerStock(item.code_barres, qte, "Consommation rapide", profilId ? parseInt(profilId) : null);
      fermerModale();
      chargerStock();
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}

// ---------- Barre d'outils : tri + recherche + regroupement ----------

function initBarreOutilsStock() {
  const inputRecherche = document.getElementById("recherche-stock");
  const selectTri = document.getElementById("tri-stock");
  const btnRegroupement = document.getElementById("btn-toggle-categorie");
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

  if (btnRegroupement) {
    btnRegroupement.addEventListener("click", () => {
      regroupementCategorieActif = !regroupementCategorieActif;
      btnRegroupement.classList.toggle("actif", regroupementCategorieActif);
      chargerStock();
    });
  }
}
