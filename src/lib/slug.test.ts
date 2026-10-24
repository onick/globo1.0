import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it.each([
    ["Transporte Ñ Pérez SRL", "transporte-n-perez-srl"],
    ["Logística Ágil, S.A.", "logistica-agil-s-a"],
    ["  Flota de Prueba  ", "flota-de-prueba"],
    ["ACME---Corp", "acme-corp"],
  ])("%s -> %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
