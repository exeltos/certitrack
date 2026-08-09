// certificates_download.js
import jsPDF from "https://cdn.skypack.dev/jspdf";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.7.1/+esm";

export async function downloadSelectedCertificates(certificates) {
  if (!certificates || certificates.length === 0) {
    alert("Δεν έχετε επιλέξει πιστοποιητικά.");
    return;
  }

  const zip = new JSZip();

  for (const cert of certificates) {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Τίτλος: ${cert.title || "Άγνωστος"}`, 10, 20);
    doc.text(`Τύπος: ${cert.type || "-"}`, 10, 30);
    doc.text(`ΑΦΜ Προμηθευτή: ${cert.supplier_afm || "-"}`, 10, 40);
    doc.text(`Ημερομηνία: ${cert.date || "-"}`, 10, 50);
    const pdfBlob = doc.output("blob");
    zip.file(`${cert.title || "πιστοποιητικό"}.pdf`, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = zipUrl;
  a.download = "certificates.zip";
  a.click();
  URL.revokeObjectURL(zipUrl);
}
