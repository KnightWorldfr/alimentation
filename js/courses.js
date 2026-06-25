// ============================================================
// Module Courses — liste de courses avec cases à cocher,
// suggestion automatique des articles épuisés, et validation
// directe vers le stock sans rescanner.
// ============================================================

async function initVueCourses() {
  await chargerCourses();
}

async function chargerCourses() {
  const conteneur = document.getElementById("liste-courses");
  if (!conteneur) return;
  conteneur.innerHTML = `<div class="vide">Chargement…</div>`;

  try {
    const articles = await API.courses();
    if (articles.length === 0) {
      conteneur.innerHTML = `
        <div class="vide">
          Liste de courses vide.
          <div class="action-vide">
            <button class="action secondaire petit" id="btn-suggerer-courses-vide">Suggérer les articles épuisés</button>
          </div>
        </div>
      `;
      const btn = document.getElementById("btn-suggerer-courses-vide");
      if (btn) btn.addEventListener("click", suggererArticlesEpuises);
      return;
    }

    conteneur.innerHTML = articles.map(itemCourseHtml).join("");

    articles.forEach(a => {
      const case_ = document.getElementById(`case-course-${a.id}`);
      if (case_) case_.addEventListener("click", () => basculerAcheteCourse(a));
      const suppr = document.getElementById(`suppr-course-${a.id}`);
      if (suppr) suppr.addEventListener("click", () => supprimerArticleCourse(a));
    });

    mettreAJourVisibiliteBoutonValider(articles);
  } catch (e) {
    conteneur.innerHTML = `<div class="vide">Erreur de chargement de la liste de courses.</div>`;
  }
}

function itemCourseHtml(a) {
  const nom = a.nom_produit || a.nom_libre || "Article";
  const qte = a.quantite_prevue ? `${a.quantite_prevue}${a.unite_mesure || 'g'} prévu` : "";
  return `
    <div class="item-course ${a.achete ? 'achete' : ''}">
      <div class="case-course ${a.achete ? 'cochee' : ''}" id="case-course-${a.id}">${a.achete ? '✓' : ''}</div>
      <div class="infos-article">
        <div class="nom-article">${echapperHtml(nom)}</div>
        ${qte ? `<div class="qte-prevue">${qte}</div>` : ""}
      </div>
      <button class="btn-suppr-course" id="suppr-course-${a.id}" title="Retirer de la liste">✕</button>
    </div>
  `;
}

async function basculerAcheteCourse(article) {
  try {
    await API.majCourse(article.id, { achete: !article.achete });
    chargerCourses();
  } catch (e) {
    alert(e.message);
  }
}

async function supprimerArticleCourse(article) {
  try {
    await API.majCourse(article.id, { supprime: true });
    chargerCourses();
  } catch (e) {
    alert(e.message);
  }
}

function mettreAJourVisibiliteBoutonValider(articles) {
  const btn = document.getElementById("btn-valider-achats");
  if (!btn) return;
  const nbAchetes = articles.filter(a => a.achete).length;
  btn.style.display = nbAchetes > 0 ? "block" : "none";
  btn.textContent = `Valider ${nbAchetes} achat(s) → ajouter au stock`;
}

async function validerAchatsCourses() {
  const zone = document.getElementById("zone-resultat-courses");
  try {
    const resultat = await API.validerAchats();
    zone.innerHTML = `<div class="resultat">✓ ${resultat.message}</div>`;
    chargerCourses();
  } catch (e) {
    zone.innerHTML = `<div class="resultat erreur">${e.message}</div>`;
  }
}

async function suggererArticlesEpuises() {
  try {
    const resultat = await API.ajouterCoursesDepuisStock();
    document.getElementById("zone-resultat-courses").innerHTML = `<div class="resultat">✓ ${resultat.message}</div>`;
    chargerCourses();
  } catch (e) {
    document.getElementById("zone-resultat-courses").innerHTML = `<div class="resultat erreur">${e.message}</div>`;
  }
}

// ---------- Ajout manuel d'un article ----------

async function ajouterArticleCoursesManuel() {
  const input = document.getElementById("input-nouvel-article-course");
  const nom = input.value.trim();
  if (!nom) return;

  try {
    await API.ajouterCourse({ nom_libre: nom });
    input.value = "";
    chargerCourses();
  } catch (e) {
    document.getElementById("zone-resultat-courses").innerHTML = `<div class="resultat erreur">${e.message}</div>`;
  }
}
