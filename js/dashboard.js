// ============================================================
// Module Dashboard — cœur de l'onglet "Suivi". Remplace l'ancien
// historique brut par un vrai tableau de bord par profil : calories
// et macros par jour (graphique en barres), courbe de poids dans le
// temps, sélecteur de période, ajout de relevé de poids.
//
// Graphiques en SVG fait main (pas de lib externe) — léger et facile
// à adapter au thème clair/sombre via les variables CSS.
// ============================================================

let periodeDashboardActuelle = 7; // en jours
let dashboardActuel = null;

const OPTIONS_PERIODE = [
  { jours: 7, label: "7 jours" },
  { jours: 14, label: "14 jours" },
  { jours: 30, label: "30 jours" },
  { jours: 90, label: "3 mois" },
  { jours: 180, label: "6 mois" },
  { jours: 365, label: "1 an" },
];

async function initVueDashboard() {
  await chargerProfils();
  const conteneur = document.getElementById("contenu-dashboard");
  if (!conteneur) return;

  const profilId = getProfilActifId();
  if (!profilId) {
    conteneur.innerHTML = `
      <div class="vide">
        Sélectionne un profil en haut de l'écran pour voir son dashboard.
      </div>
    `;
    return;
  }

  renderSquelletteDashboard(conteneur);
  await chargerDonneesDashboard(profilId);
}

function renderSquelletteDashboard(conteneur) {
  conteneur.innerHTML = `
    <div class="barre-periode" id="barre-periode-dashboard">
      ${OPTIONS_PERIODE.map(o =>
        `<button class="chip-periode ${o.jours === periodeDashboardActuelle ? 'actif' : ''}" data-jours="${o.jours}">${o.label}</button>`
      ).join("")}
    </div>

    <div id="zone-dashboard-contenu"><div class="vide">Chargement…</div></div>
  `;

  document.querySelectorAll(".chip-periode").forEach(chip => {
    chip.addEventListener("click", async () => {
      periodeDashboardActuelle = parseInt(chip.dataset.jours);
      document.querySelectorAll(".chip-periode").forEach(c => c.classList.toggle("actif", c === chip));
      await chargerDonneesDashboard(getProfilActifId());
    });
  });
}

async function chargerDonneesDashboard(profilId) {
  const zone = document.getElementById("zone-dashboard-contenu");
  if (!zone) return;
  zone.innerHTML = `<div class="vide">Chargement…</div>`;

  try {
    dashboardActuel = await API.dashboardProfil(profilId, periodeDashboardActuelle);
    renderDashboard(zone, dashboardActuel);
  } catch (e) {
    zone.innerHTML = `<div class="vide">Erreur de chargement du dashboard : ${e.message}</div>`;
  }
}

function renderDashboard(zone, data) {
  const { profil, totaux, moyennes_par_jour, serie_quotidienne, poids_historique, dernier_poids } = data;
  const objectifJour = profil.objectif_kcal_jour;

  zone.innerHTML = `
    <div class="grille-cartes-resume">
      <div class="carte-resume">
        <div class="label-resume">Moyenne / jour</div>
        <div class="valeur-resume">${Math.round(moyennes_par_jour.kcal)}<span class="unite-resume">kcal</span></div>
        ${objectifJour ? `<div class="souslabel-resume">Objectif : ${objectifJour} kcal</div>` : ""}
      </div>
      <div class="carte-resume">
        <div class="label-resume">Total période</div>
        <div class="valeur-resume">${Math.round(totaux.kcal)}<span class="unite-resume">kcal</span></div>
      </div>
      <div class="carte-resume">
        <div class="label-resume">Poids actuel</div>
        <div class="valeur-resume">${dernier_poids ? dernier_poids.poids_kg : '—'}<span class="unite-resume">${dernier_poids ? 'kg' : ''}</span></div>
        ${dernier_poids ? `<div class="souslabel-resume">${formaterDateCourte(dernier_poids.date_releve)}</div>` : ""}
      </div>
    </div>

    <div class="carte">
      <h2>Calories par jour</h2>
      ${svgGraphiqueBarres(serie_quotidienne, objectifJour)}
    </div>

    <div class="carte">
      <h2>Répartition des macros (moyenne/jour)</h2>
      <div class="macros-grille">
        <div class="macro">Protéines<span class="val">${Math.round(moyennes_par_jour.proteines_g)} g</span></div>
        <div class="macro">Glucides<span class="val">${Math.round(moyennes_par_jour.glucides_g)} g</span></div>
        <div class="macro">Lipides<span class="val">${Math.round(moyennes_par_jour.lipides_g)} g</span></div>
      </div>
    </div>

    <div class="carte">
      <h2>
        Poids dans le temps
        <button class="action secondaire petit" id="btn-ajouter-poids">+ Ajouter un relevé</button>
      </h2>
      ${poids_historique.length >= 2
        ? svgGraphiqueCourbe(poids_historique)
        : `<div class="vide">Ajoute au moins 2 relevés pour voir une courbe d'évolution.</div>`}
    </div>
  `;

  document.getElementById("btn-ajouter-poids").addEventListener("click", () => ouvrirFormulaireAjoutPoids(profil));
}

function formaterDateCourte(dateStr) {
  const date = new Date(dateStr.replace(" ", "T") + "Z");
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ---------- Graphique en barres : calories par jour ----------

function svgGraphiqueBarres(serie, objectif) {
  if (serie.length === 0) return `<div class="vide">Aucune donnée sur cette période.</div>`;

  const largeur = 600;
  const hauteur = 200;
  const marge = { haut: 16, bas: 28, gauche: 8, droite: 8 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const maxVal = Math.max(objectif || 0, ...serie.map(j => j.kcal), 100);
  const largeurBarre = Math.min(36, (zoneL / serie.length) * 0.6);
  const espacement = zoneL / serie.length;

  // Pour ne pas surcharger l'axe sur de longues périodes, on n'affiche
  // une étiquette de date que pour un sous-ensemble de jours.
  const pasEtiquette = Math.ceil(serie.length / 8);

  const barres = serie.map((j, i) => {
    const x = marge.gauche + i * espacement + (espacement - largeurBarre) / 2;
    const h = maxVal > 0 ? (j.kcal / maxVal) * zoneH : 0;
    const y = marge.haut + zoneH - h;
    const depasseObjectif = objectif && j.kcal > objectif;
    const couleur = depasseObjectif ? "var(--alerte)" : "var(--accent)";
    const dateLabel = i % pasEtiquette === 0
      ? new Date(j.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" })
      : "";
    return `
      <g>
        <rect x="${x}" y="${y}" width="${largeurBarre}" height="${Math.max(h, 1)}" rx="3" fill="${couleur}">
          <title>${j.date} : ${Math.round(j.kcal)} kcal</title>
        </rect>
        ${dateLabel ? `<text x="${x + largeurBarre / 2}" y="${hauteur - 8}" text-anchor="middle" class="svg-label-axe">${dateLabel}</text>` : ""}
      </g>
    `;
  }).join("");

  const ligneObjectif = objectif ? (() => {
    const y = marge.haut + zoneH - (objectif / maxVal) * zoneH;
    return `
      <line x1="${marge.gauche}" y1="${y}" x2="${largeur - marge.droite}" y2="${y}"
            stroke="var(--texte-faible)" stroke-width="1" stroke-dasharray="4,4" />
      <text x="${largeur - marge.droite}" y="${y - 4}" text-anchor="end" class="svg-label-objectif">Objectif ${objectif} kcal</text>
    `;
  })() : "";

  return `
    <svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-graphique" preserveAspectRatio="xMidYMid meet">
      ${barres}
      ${ligneObjectif}
    </svg>
  `;
}

// ---------- Graphique en courbe : poids dans le temps ----------

function svgGraphiqueCourbe(releves) {
  const largeur = 600;
  const hauteur = 200;
  const marge = { haut: 20, bas: 28, gauche: 36, droite: 12 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const valeurs = releves.map(r => r.poids_kg);
  const minVal = Math.min(...valeurs);
  const maxVal = Math.max(...valeurs);
  // Marge visuelle pour ne pas coller la courbe aux bords (évite un
  // graphique trompeur qui exagère de petites variations)
  const ecart = Math.max(maxVal - minVal, 1);
  const bas = minVal - ecart * 0.2;
  const haut = maxVal + ecart * 0.2;

  const points = releves.map((r, i) => {
    const x = marge.gauche + (i / (releves.length - 1)) * zoneL;
    const y = marge.haut + zoneH - ((r.poids_kg - bas) / (haut - bas)) * zoneH;
    return { x, y, poids: r.poids_kg, date: r.date_releve };
  });

  const chemin = points.map((p, i) => (i === 0 ? "M" : "L") + `${p.x},${p.y}`).join(" ");
  const aire = chemin + ` L${points[points.length - 1].x},${marge.haut + zoneH} L${points[0].x},${marge.haut + zoneH} Z`;

  const pasEtiquette = Math.ceil(points.length / 6);
  const etiquettes = points.map((p, i) => {
    if (i % pasEtiquette !== 0 && i !== points.length - 1) return "";
    const label = new Date(p.date.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" });
    return `<text x="${p.x}" y="${hauteur - 8}" text-anchor="middle" class="svg-label-axe">${label}</text>`;
  }).join("");

  const points_svg = points.map(p =>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent)"><title>${p.poids} kg</title></circle>`
  ).join("");

  return `
    <svg viewBox="0 0 ${largeur} ${hauteur}" class="svg-graphique" preserveAspectRatio="xMidYMid meet">
      <text x="${marge.gauche - 6}" y="${marge.haut + 4}" text-anchor="end" class="svg-label-axe">${haut.toFixed(1)}</text>
      <text x="${marge.gauche - 6}" y="${marge.haut + zoneH}" text-anchor="end" class="svg-label-axe">${bas.toFixed(1)}</text>
      <path d="${aire}" fill="var(--accent-clair)" stroke="none" />
      <path d="${chemin}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      ${points_svg}
      ${etiquettes}
    </svg>
  `;
}

// ---------- Ajout d'un relevé de poids ----------

function ouvrirFormulaireAjoutPoids(profil) {
  ouvrirModale(`Ajouter un poids : ${echapperHtml(profil.nom)}`, `
    <label for="nouveau-poids">Poids (kg)</label>
    <input type="number" id="nouveau-poids" step="0.1" placeholder="ex: 92.5" value="${profil.poids_kg ?? ''}">
    <button class="action" id="btn-valider-poids">Enregistrer</button>
  `);

  document.getElementById("btn-valider-poids").addEventListener("click", async () => {
    const poids = parseFloat(document.getElementById("nouveau-poids").value);
    if (!poids || poids <= 0) {
      afficherToastModale("Indique un poids valide.", true);
      return;
    }
    try {
      await API.ajouterReleveePoids(profil.id, poids);
      fermerModale();
      await chargerDonneesDashboard(profil.id);
      await chargerProfils(); // resynchronise le poids affiché ailleurs (Réglages)
    } catch (e) {
      afficherToastModale(e.message, true);
    }
  });
}
