import { describe, expect, it } from "vitest";
import { categoriesOf } from "../lib/catalog";

describe("categoriesOf", () => {
  it("lists every category the store's products use, so no product is hidden", () => {
    const products = [{ category: "Pendants" }, { category: "Floor lamps" }, { category: "Pendants" }, { category: "Desk lamps" }];
    expect(categoriesOf(products)).toEqual(["Desk lamps", "Floor lamps", "Pendants"]);
  });

  it("keeps the familiar food order first, then any others alphabetically", () => {
    const products = [{ category: "Zebra" }, { category: "Bakery" }, { category: "Produce" }, { category: "Apples" }];
    expect(categoriesOf(products)).toEqual(["Produce", "Bakery", "Apples", "Zebra"]);
  });
});
