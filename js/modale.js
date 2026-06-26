// ============================================================
// Module Modale — boîte de dialogue générique réutilisée partout
// (édition stock, création profil, attribution de parts...).
// Sur mobile : feuille qui glisse depuis le bas.
// Sur desktop : panneau centré (géré en CSS via media query).
// ============================================================

function ouvrirModale(titre, contenuHtml) {
  fermerModale(); // au cas où une modale était déjà ouverte

  const fond = document.createElement("div");
  fond.className = "fond-modale";
  fond.id = "fond-modale-actuelle";
  fond.innerHTML = `
    <div class="contenu-modale">
      <div class="entete-modale">
        <h3>${titre}</h3>
        <button class="btn-fermer-modale" id="btn-fermer-modale" aria-label="Fermer">✕</button>
      </div>
      ${contenuHtml}
    </div>
  `;
  document.body.appendChild(fond);

  document.getElementById("btn-fermer-modale").addEventListener("click", fermerModale);

  // Clic en dehors du contenu = ferme la modale
  fond.addEventListener("click", (e) => {
    if (e.target === fond) fermerModale();
  });

  // Échap = ferme la modale
  document.addEventListener("keydown", gestionEchapModale);
}

function gestionEchapModale(e) {
  if (e.key === "Escape") fermerModale();
}

function fermerModale() {
  const fond = document.getElementById("fond-modale-actuelle");
  if (fond) fond.remove();
  document.removeEventListener("keydown", gestionEchapModale);
}

// Affiche un message d'erreur/succès à l'intérieur de la modale ouverte,
// sans la fermer (utile pour signaler une erreur de validation).
function afficherToastModale(message, estErreur) {
  const contenu = document.querySelector(".contenu-modale");
  if (!contenu) return;
  let zone = contenu.querySelector(".toast-modale");
  if (!zone) {
    zone = document.createElement("div");
    zone.className = "toast-modale resultat";
    contenu.insertBefore(zone, contenu.firstChild.nextSibling);
  }
  zone.className = `toast-modale resultat ${estErreur ? "erreur" : ""}`;
  zone.textContent = message;
}
