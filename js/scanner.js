// ---------- Scan caméra ----------
let scannerActif = null;          // instance Html5Qrcode (fallback)
let detecteurNatifActif = null;   // { stream, video, intervalId } si BarcodeDetector natif utilisé
let derniereLectureNative = null; // pour la double-confirmation anti-faux-positif

// Vérifie le chiffre de contrôle d'un code EAN-13 : le 13e chiffre est
// calculé à partir des 12 premiers. Si ça ne correspond pas, la lecture
// caméra a probablement mal interprété une ou plusieurs barres — on rejette
// plutôt que d'envoyer un code-barres faux à l'API.
function checksumEAN13Valide(code) {
  if (!/^\d{13}$/.test(code)) return true; // pas un EAN-13 (EAN-8, Code128...) : pas de vérif possible, on laisse passer
  const chiffres = code.split("").map(Number);
  const somme = chiffres.slice(0, 12).reduce((acc, chiffre, i) => acc + chiffre * (i % 2 === 0 ? 1 : 3), 0);
  const checksumAttendu = (10 - (somme % 10)) % 10;
  return checksumAttendu === chiffres[12];
}

function arreterScan() {
  const bouton = document.getElementById("btn-camera");
  if (scannerActif) {
    scannerActif.stop();
    scannerActif = null;
  }
  if (detecteurNatifActif) {
    clearInterval(detecteurNatifActif.intervalId);
    detecteurNatifActif.stream.getTracks().forEach(track => track.stop());
    detecteurNatifActif = null;
  }
  derniereLectureNative = null;
  document.getElementById("lecteur-camera").innerHTML = "";
  bouton.textContent = "Activer la caméra";
}

function onCodeBarreValide(codeDetecte) {
  arreterScan();
  // Affiche le code détecté avant de lancer la recherche, pour que tu
  // puisses vérifier visuellement que c'est bien le bon produit avant
  // l'appel réseau (utile si jamais deux codes étaient visibles à la fois).
  document.getElementById("input-code-manuel").value = codeDetecte;
  afficherResultatScan(`Code détecté : ${codeDetecte} — recherche en cours…`, false);
  chercherProduit(codeDetecte);
}

// Utilise l'API native du navigateur (BarcodeDetector), qui s'appuie sur le
// moteur de vision du système (Android/macOS) plutôt que sur du JS pur —
// nettement plus rapide et fiable que la lib de repli quand disponible.
async function demarrerScanNatif() {
  const detecteur = new BarcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
  });

  const video = document.createElement("video");
  video.setAttribute("playsinline", "true"); // requis sur iOS pour éviter le plein écran auto
  video.style.width = "100%";
  video.style.borderRadius = "2px";
  document.getElementById("lecteur-camera").appendChild(video);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },   // résolution haute : plus de détail pour distinguer les barres fines
      height: { ideal: 1080 },
      advanced: [{ focusMode: "continuous" }],
    },
  });
  video.srcObject = stream;
  await video.play();

  const intervalId = setInterval(async () => {
    try {
      const codes = await detecteur.detect(video);
      if (codes.length === 0) return;

      const valeur = codes[0].rawValue;
      if (!checksumEAN13Valide(valeur)) return; // lecture suspecte, on ignore

      // Double-confirmation : on attend que la même valeur soit lue deux
      // fois de suite avant de valider, pour éliminer les faux positifs
      // dus à un flou transitoire pendant que l'image se stabilise.
      if (derniereLectureNative === valeur) {
        onCodeBarreValide(valeur);
      } else {
        derniereLectureNative = valeur;
      }
    } catch (e) {
      // détection échouée sur cette frame, on retente à la prochaine
    }
  }, 200);

  detecteurNatifActif = { stream, video, intervalId };
}

// Repli sur html5-qrcode si BarcodeDetector n'est pas supporté par le
// navigateur (Safari, Firefox notamment).
async function demarrerScanFallback() {
  scannerActif = new Html5Qrcode("lecteur-camera", {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
    ],
  });

  const config = {
    fps: 10,
    qrbox: { width: 280, height: 120 },
    aspectRatio: 1.7,
    videoConstraints: {
      focusMode: "continuous",
      advanced: [{ focusMode: "continuous" }],
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };

  const cameras = await Html5Qrcode.getCameras();
  if (!cameras || cameras.length === 0) {
    afficherResultatScan("Aucune caméra détectée sur cet appareil.", true);
    scannerActif = null;
    return;
  }
  const camArriere = cameras.find(c => /back|rear|environment/i.test(c.label));
  const idCamera = camArriere ? camArriere.id : cameras[0].id;

  let derniereLectureFallback = null;
  await scannerActif.start(
    idCamera,
    config,
    (codeDetecte) => {
      if (!checksumEAN13Valide(codeDetecte)) return;
      // Même logique de double-confirmation que le mode natif.
      if (derniereLectureFallback === codeDetecte) {
        onCodeBarreValide(codeDetecte);
      } else {
        derniereLectureFallback = codeDetecte;
      }
    }
  );
}

document.getElementById("btn-camera").addEventListener("click", async () => {
  const bouton = document.getElementById("btn-camera");
  if (scannerActif || detecteurNatifActif) {
    arreterScan();
    return;
  }

  try {
    if ("BarcodeDetector" in window) {
      await demarrerScanNatif();
    } else {
      await demarrerScanFallback();
    }
    bouton.textContent = "Désactiver la caméra";
  } catch (err) {
    afficherResultatScan(`Impossible d'accéder à la caméra : ${err}. Vérifie que tu es bien en HTTPS ou en localhost, et que tu as autorisé l'accès caméra.`, true);
    arreterScan();
  }
});
