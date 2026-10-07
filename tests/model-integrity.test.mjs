import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modelDirectory = new URL("../public/models/", import.meta.url);
const sugarParts = JSON.parse(await readFile(new URL("../app/carbohydrateParts.json", import.meta.url), "utf8"));
const notebookModels = JSON.parse(await readFile(new URL("../app/notebookModelParts.json", import.meta.url), "utf8"));
const notebookDrawings = JSON.parse(await readFile(new URL("../app/notebookFattyParts.json", import.meta.url), "utf8"));

async function readModel(file, connected = true) {
  const lines = (await readFile(new URL(file, modelDirectory), "utf8")).split(/\r?\n/);
  const atomCount = Number(lines[3].slice(0, 3));
  const bondCount = Number(lines[3].slice(3, 6));
  const atoms = lines.slice(4, 4 + atomCount).map(line => ({
    element: line.slice(31, 34).trim(),
    xyz: [0, 10, 20].map(start => Number(line.slice(start, start + 10))),
  }));
  const bonds = lines.slice(4 + atomCount, 4 + atomCount + bondCount).map(line => ({
    a: Number(line.slice(0, 3)) - 1, b: Number(line.slice(3, 6)) - 1,
    order: Number(line.slice(6, 9)),
  }));
  const adjacency = atoms.map(() => []);
  for (const bond of bonds) {
    assert.ok(bond.a >= 0 && bond.a < atomCount && bond.b >= 0 && bond.b < atomCount);
    adjacency[bond.a].push(bond.b);
    adjacency[bond.b].push(bond.a);
    const length = Math.hypot(...atoms[bond.a].xyz.map((value, axis) => value - atoms[bond.b].xyz[axis]));
    assert.ok(length > 0.8 && length < 1.9, `${file}: unrealistic bond length ${length}`);
  }
  assert.ok(atoms.every(atom => atom.xyz.every(Number.isFinite)));
  const visited = new Set();
  function visit(index) { if (visited.has(index)) return; visited.add(index); adjacency[index].forEach(visit); }
  visit(0);
  if (connected) assert.equal(visited.size, atoms.length, `${file}: disconnected fragment`);

  // An edge is in a ring if its endpoints remain connected when that edge is removed.
  const ringAtoms = new Set();
  let smallestRing = Infinity;
  for (const { a, b } of bonds) {
    const queue = [[a, 0]], seen = new Set([a]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [index, distance] = queue[cursor];
      if (index === b) { smallestRing = Math.min(smallestRing, distance + 1); ringAtoms.add(a); ringAtoms.add(b); break; }
      for (const next of adjacency[index]) {
        if ((index === a && next === b) || (index === b && next === a) || seen.has(next)) continue;
        seen.add(next); queue.push([next, distance + 1]);
      }
    }
  }
  return { atoms, bonds, adjacency, ringAtoms, smallestRing };
}

const reactantScenes = JSON.parse(await readFile(new URL("reactant-regions.json", modelDirectory), "utf8")).scenes;
const productScenes = JSON.parse(await readFile(new URL("product-regions.json", modelDirectory), "utf8")).scenes;
test("notebook drawings use real variable groups and exclude the added phospholipid head", async () => {
  for (const [key, entry] of Object.entries({ ...notebookModels.models, ...notebookDrawings.models })) {
    const model = await readModel(entry.source.split("/").at(-1), key !== "bilayer");
    for (const part of entry.parts) {
      assert.ok(part.atomIndices.length > 0);
      assert.ok(part.atomIndices.every(index => Number.isInteger(index) && index >= 0 && index < model.atoms.length));
    }
    if (key === "amino-acid" || key === "dipeptide") {
      const variableCount = key === "amino-acid" ? 1 : 2;
      assert.equal(model.atoms.filter(atom => atom.element === "R").length, variableCount);
      for (const [index, atom] of model.atoms.entries()) {
        if (atom.element === "R") {
          assert.equal(model.adjacency[index].length, 1);
          assert.equal(model.atoms[model.adjacency[index][0]].element, "C");
        }
      }
    }
    if (key === "phospholipid" || key === "bilayer") {
      assert.ok(model.atoms.some(atom => atom.element === "P"));
      assert.ok(!model.atoms.some(atom => atom.element === "N"), "no extra choline head");
    }
    if (key === "glucose") {
      assert.equal(model.ringAtoms.size, 0, "the notebook shows open-chain glucose");
      assert.deepEqual(model.atoms.reduce((counts, atom) => ({ ...counts, [atom.element]: (counts[atom.element] ?? 0) + 1 }), {}), { O: 6, C: 6, H: 12 });
    }
  }
});

test("generic notebook peptide and fat scenes conserve atoms including water and R", async () => {
  const sucrose = { reactants: notebookDrawings.reactions.sucrose.reactants, products: productScenes["products-sucrose"] };
  for (const [recipe, originalEntry] of [[notebookModels.reactions.peptide, notebookModels.models.dipeptide], [notebookDrawings.reactions.triglyceride, notebookDrawings.models.triglyceride], [sucrose, { source: "/models/sucrose.sdf" }]]) {
    const before = await readModel(recipe.reactants.source.split("/").at(-1), false);
    const after = await readModel(recipe.products.source.split("/").at(-1), false);
    const original = await readModel(originalEntry.source.split("/").at(-1));
    const count = atoms => atoms.reduce((counts, atom) => ({ ...counts, [atom.element]: (counts[atom.element] ?? 0) + 1 }), {});
    assert.deepEqual(count(before.atoms), count(after.atoms));
    assert.deepEqual(after.atoms.slice(0, original.atoms.length), original.atoms);
    for (const [scene, model] of [[recipe.reactants, before], [recipe.products, after]]) {
      const owners = new Map();
      for (const [name, indices] of Object.entries(scene.regions)) {
        for (const index of indices) {
          assert.ok(index >= 0 && index < model.atoms.length && !owners.has(index));
          owners.set(index, name);
        }
        if (name.startsWith("water")) assert.deepEqual(count(indices.map(index => model.atoms[index])), { O: 1, H: 2 });
      }
      assert.equal(owners.size, model.atoms.length);
      for (const bond of model.bonds) assert.equal(owners.get(bond.a), owners.get(bond.b));
    }
  }
});

test("displayed notebook text excludes added chemical subtype and linkage lessons", async () => {
  const catalog = await readFile(new URL("../app/moleculeCatalog.ts", import.meta.url), "utf8");
  // These names may remain as internal stable IDs; quoted UI names must not contain them.
  const uiStrings = [...catalog.matchAll(/(?:english|label|detail|example):"([^"]*)"/g)].map(match => match[1]);
  const partsText = JSON.stringify([...Object.values(sugarParts).flat(), ...Object.values(notebookModels.models).flatMap(model => model.parts), ...Object.values(notebookDrawings.models).flatMap(model => model.parts)].map(({ label, note }) => ({ label, note })));
  assert.doesNotMatch(uiStrings.join(" ") + partsText, /POPC|Palmitic|Oleic|Tripalmitin|Glycine|Glycylglycine|Fructofuranose|PDB|cis|α|β|1→4|1→6|إستر/);
});
for (const recipe of [
  { id: "sucrose", original: "sucrose.sdf", waters: 1, ingredients: 2 },
  { id: "triglyceride", original: "tripalmitin.sdf", waters: 3, ingredients: 4 },
  { id: "peptide", original: "glycylglycine.sdf", waters: 1, ingredients: 2 },
]) {
  test(`${recipe.id}: full reaction scenes conserve atoms and preserve product selections`, async () => {
    const before = await readModel(`reactants-${recipe.id}.sdf`, false);
    const after = await readModel(`products-${recipe.id}.sdf`, false);
    const original = await readModel(recipe.original);
    const counts = atoms => atoms.reduce((result, atom) => ({ ...result, [atom.element]: (result[atom.element] ?? 0) + 1 }), {});
    assert.deepEqual(counts(before.atoms), counts(after.atoms), "reaction sides must conserve all atoms");
    assert.deepEqual(after.atoms.slice(0, original.atoms.length), original.atoms, "product atom order/positions must remain intact");
    const normalizedBonds = bonds => bonds.map(({ a, b, order }) => `${Math.min(a, b)}:${Math.max(a, b)}:${order}`).sort();
    assert.deepEqual(normalizedBonds(after.bonds.filter(bond => bond.a < original.atoms.length && bond.b < original.atoms.length)), normalizedBonds(original.bonds));
    for (const [scene, model, expectedCount] of [
      [reactantScenes[`reactants-${recipe.id}`], before, recipe.ingredients],
      [productScenes[`products-${recipe.id}`], after, recipe.waters + 1],
    ]) {
      const regions = Object.entries(scene.regions);
      assert.equal(regions.length, expectedCount);
      const owners = new Map();
      for (const [name, indices] of regions) {
        for (const index of indices) {
          assert.ok(index >= 0 && index < model.atoms.length && !owners.has(index));
          owners.set(index, name);
        }
        if (name.startsWith("water")) {
          assert.deepEqual(counts(indices.map(index => model.atoms[index])), { O: 1, H: 2 });
          assert.equal(model.bonds.filter(bond => indices.includes(bond.a) && indices.includes(bond.b)).length, 2);
        }
      }
      assert.equal(owners.size, model.atoms.length, "every atom must belong to a component");
      model.bonds.forEach(bond => assert.equal(owners.get(bond.a), owners.get(bond.b), "no bonds between separate components"));
    }
  });
}

for (const expected of [
  { id: "fructose", file: "fructose.sdf", formula: { C: 6, H: 12, O: 6 }, rings: 1, size: 5, links: 0 },
  { id: "starch", file: "starch-fragment.sdf", formula: { C: 24, H: 42, O: 21 }, rings: 4, size: 6, links: 3 },
  { id: "glycogen", file: "glycogen-fragment.sdf", formula: { C: 30, H: 52, O: 26 }, rings: 5, size: 6, links: 4 },
  { id: "cellulose", file: "cellulose-fragment.sdf", formula: { C: 24, H: 42, O: 21 }, rings: 4, size: 6, links: 3 },
]) {
  test(`${expected.id}: formula, ring structure and clickable parts are intact`, async () => {
    const model = await readModel(expected.file);
    const formula = {};
    model.atoms.forEach(atom => { formula[atom.element] = (formula[atom.element] ?? 0) + 1; });
    assert.deepEqual(formula, expected.formula);
    assert.equal(model.bonds.length - model.atoms.length + 1, expected.rings);
    assert.equal(model.smallestRing, expected.size);
    const links = model.atoms.map((atom, index) => ({ atom, index })).filter(({ atom, index }) =>
      atom.element === "O" && !model.ringAtoms.has(index) && model.adjacency[index].length === 2 &&
      model.adjacency[index].every(neighbor => model.atoms[neighbor].element === "C"));
    assert.equal(links.length, expected.links);
    if (expected.id === "glycogen") {
      assert.equal(links.filter(({ index }) => model.adjacency[index].some(neighbor => !model.ringAtoms.has(neighbor))).length, 1,
        "glycogen must retain its C6 branch linkage");
    }
    assert.ok(sugarParts[expected.id]?.length > 0);
    for (const part of sugarParts[expected.id]) {
      assert.ok(part.atomIndices.length > 0);
      assert.equal(new Set(part.atomIndices).size, part.atomIndices.length);
      assert.ok(part.atomIndices.every(index => Number.isInteger(index) && index >= 0 && index < model.atoms.length), part.label);
    }
  });
}
