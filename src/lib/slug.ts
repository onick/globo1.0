// URL-safe identifier from a name: "Transporte Ñ Pérez SRL" -> "transporte-n-perez-srl".
// Accents are dropped rather than turned into dashes.
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
