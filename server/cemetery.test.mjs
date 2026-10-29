import test from "node:test";
import assert from "node:assert/strict";
import { graves, cemeteryPlan, findGraves } from "../src/data/cemetery.ts";

test("fictional grave fixtures have unique plots, valid past dates and bounded coordinates", () => {
  assert.equal(graves.length, 96);
  assert.equal(new Set(graves.map((grave) => grave.id)).size, 96);
  for (const grave of graves) {
    assert.ok(grave.x > 0 && grave.x + 36 < cemeteryPlan.width);
    assert.ok(grave.y > 0 && grave.y + 32 < cemeteryPlan.height);
    assert.ok(grave.people.length >= 1);
    for (const person of grave.people) {
      assert.ok(person.born < person.died && person.died < "2026-10-29");
      assert.equal(
        new Date(person.born).toISOString().slice(0, 10),
        person.born,
      );
      assert.equal(
        new Date(person.died).toISOString().slice(0, 10),
        person.died,
      );
    }
  }
});
test("grave search matches diacritics, any word order, second occupants and plot identifiers", () => {
  assert.deepEqual(findGraves("kovac"), findGraves("KOVAČ"));
  assert.ok(
    findGraves("  Novak   Ana ").some((grave) => grave.id === "A-01-01"),
  );
  assert.ok(findGraves("Franc Novak").some((grave) => grave.id === "A-01-01"));
  assert.equal(findGraves("A-01-01").length, 1);
  assert.equal(
    findGraves("Novak", "D").every((grave) => grave.section === "D"),
    true,
  );
  assert.equal(findGraves("", "C").length, 24);
  assert.equal(findGraves("No such person").length, 0);
  assert.equal(findGraves("Ana Kovač Horvat").length, 0);
});
