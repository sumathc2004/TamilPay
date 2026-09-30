// Converts an image URL (local asset or remote CDN) to a data URL so it can be
// embedded in a jsPDF document, which needs image bytes up front, not a URL.
// Returns null on any failure (e.g. a CORS-blocked logo) so PDF generation can just
// skip that image rather than fail outright.
export const loadImageAsDataUrl = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};
