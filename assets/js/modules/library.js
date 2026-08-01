/**
 * library.js
 *
 * The book list lives in the HTML, not here: each entry is a button carrying
 * its own `data-pdf`, `data-title` and `data-author`. That keeps the catalogue
 * crawlable and readable without JavaScript, and adding a document is one
 * `<li>` rather than a hand-written JavaScript string inside an attribute.
 *
 * One delegated listener covers the whole list, however long it grows.
 */

export function initLibrary({ list, fileInput, onOpenUrl, onOpenFile, onReject }) {
  list.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-pdf]") : null;
    if (!target || !list.contains(target)) return;
    onOpenUrl(target.dataset.pdf, {
      title: target.dataset.title || "",
      subtitle: target.dataset.author || "",
      trigger: target,
    });
  });

  if (!fileInput) return;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    // Clearing the value lets the same file be picked twice in a row.
    fileInput.value = "";
    if (!file) return;

    const looksLikePdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!looksLikePdf) {
      onReject("Ese archivo no es un PDF. Elige un documento con extensión .pdf.");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      onOpenFile({ data }, file.name.replace(/\.pdf$/i, ""));
    } catch (error) {
      console.error(error);
      onReject("No se pudo leer el archivo desde tu equipo.");
    }
  });
}
