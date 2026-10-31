import test from "node:test";
import assert from "node:assert/strict";
import { mapPointUrl, mapAddressUrl } from "./location.js";
test("map links use the exact selected point, accept zero, and reject absent or invalid coordinates", () => {
  assert.equal(
    new URL(mapPointUrl(45.963, 14.298)).searchParams.get("query"),
    "45.963,14.298",
  );
  assert.ok(mapPointUrl(0, 0));
  for (const pair of [
    [null, null],
    ["45", "14"],
    [NaN, 14],
    [91, 14],
    [45, 181],
    [undefined, 14],
  ])
    assert.equal(mapPointUrl(...pair), null);
  const address = "Pot na Tojnice 40, 1360 Vrhnika";
  assert.equal(
    new URL(mapAddressUrl(address)).searchParams.get("query"),
    address,
  );
  assert.equal(mapAddressUrl(""), null);
});
