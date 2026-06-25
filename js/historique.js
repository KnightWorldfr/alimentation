// ============================================================
// Module Historique — timeline enrichie : profils, recettes,
// type de mouvement, filtrable.
// ============================================================

const LIBELLES_MOUVEMENT = {
  ajout: "Ajout au stock",
  consommation_libre: "Consommation",
  recette_part: "Ingrédient de recette",
  correction_stock: "Correction",
};

const ICONES_MOUVEMENT = {
  ajout: "+",
  consommation_libre: "−",
  recette_part: "🍳",
  correction_stock: "✎",
};

let filtreProfilHistorique = null;
let filtreTypeHistorique = null;

async function initVueHistorique() {
  await chargerProfils();
  remplirFiltreProfilHistorique();
  await chargerHistoriqueAffiche();
}

function remplirFiltreProfilHistorique() {
  const select = document.getElementById("filtre-profil-historique");
  if (!select) return;
  select.innerHTML = `<option value="">Tous les profils</option>` +
    profilsCache.map(p => `<option value="${p.id}">${echapperHtml(p.nom)}</option>`).join("");
  select.addEventListener("change", () => {
    filtreProfilHistorique = select.value || null;
    chargerHistoriqueAffiche();
  });

  const selectType = document.getElementById("filtre-type-historique");
  if (selectType) {
    selectType.addEventListener("change", () => {
      filtreTypeHistorique = selectType.value || null;
      chargerHistoriqueAffiche();
    });
  }
}

async function chargerHistoriqueAffiche() {
  const conteneur = document.getElementById("liste-historique");
  if (!conteneur) return;
  conteneur.innerHTML = `<div class="vide">Chargement…</div>`;

  try {
    const items = await API.historique(80, filtreProfilHistorique, filtreTypeHistorique);
    if (items.length === 0) {
      conteneur.innerHTML = `<div class="vide">Aucun mouvement pour ces filtres.</div>`;
      return;
    }
    conteneur.innerHTML = items.map(itemHistoriqueHtml).join("");
  } catch (e) {
    conteneur.innerHTML = `<div class="vide">Erreur de chargement.</div>`;
  }
}

function itemHistoriqueHtml(h) {
  const libelle = LIBELLES_MOUVEMENT[h.type_mouvement] || h.type_mouvement;
  const icone = ICONES_MOUVEMENT[h.type_mouvement] || "•";
  const signe = h.type_mouvement === "consommation_libre" || h.type_mouvement === "recette_part" ? "−" : "+";
  const quantiteAffichee = h.quantite_g != null ? `${signe}${Math.abs(Math.round(h.quantite_g))}g` : "";

  const dateFormatee = formaterDateRelative(h.date_mouvement);

  let metaLignes = [];
  if (h.nom_profil) {
    metaLignes.push(`<span class="badge-profil" style="background:${h.couleur_profil || '#10b981'}">${echapperHtml(h.nom_profil)}</span>`);
  }
  if (h.nom_recette) metaLignes.push(`Recette : ${echapperHtml(h.nom_recette)}`);
  if (h.contexte && h.contexte !== h.nom_recette) metaLignes.push(echapperHtml(h.contexte));

  return `
    <div class="item-historique">
      <div class="icone-mouvement ${h.type_mouvement}">${icone}</div>
      <div class="details">
        <div class="ligne-principale">
          <span>${libelle}${h.nom_produit ? ` · ${echapperHtml(h.nom_produit)}` : ""}</span>
          <span class="quantite-mouvement">${quantiteAffichee}</span>
        </div>
        <div class="meta">${metaLignes.join(" · ")} ${metaLignes.length ? "·" : ""} ${dateFormatee}</div>
      </div>
    </div>
  `;
}

function formaterDateRelative(dateStr) {
  // dateStr est en UTC format SQLite "YYYY-MM-DD HH:MM:SS"
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  const maintenant = new Date();
  const diffMs = maintenant - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffJ = Math.floor(diffH / 24);
  if (diffJ === 1) return "Hier";
  if (diffJ < 7) return `Il y a ${diffJ} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
