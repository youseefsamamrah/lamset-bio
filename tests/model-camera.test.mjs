import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fitModelCamera } from "../app/modelCamera.mjs";

const modelDirectory = new URL("../public/models/", import.meta.url);
const generic = JSON.parse(await readFile(new URL("../app/notebookModelParts.json", import.meta.url), "utf8"));
const drawings = JSON.parse(await readFile(new URL("../app/notebookFattyParts.json", import.meta.url), "utf8"));
const files = [...new Set([
  ...Object.values(generic.models).map(model => model.source.split("/").at(-1)),
  ...Object.values(drawings.models).map(model => model.source.split("/").at(-1)),
  "fructose.sdf", "galactose.sdf", "sucrose.sdf", "maltose.sdf", "lactose.sdf",
  "starch-fragment.sdf", "glycogen-fragment.sdf", "cellulose-fragment.sdf",
  "glycerol.sdf", "cholesterol.sdf", "amylase.pdb",
  "notebook-reactants-sucrose.sdf", "products-sucrose.sdf",
  "notebook-reactants-peptide.sdf", "notebook-products-peptide.sdf",
  "notebook-reactants-triglyceride.sdf", "notebook-products-triglyceride.sdf",
])];

test("all notebook models and reaction scenes fit desktop and phone viewports", async () => {
  for (const file of files) {
    const lines = (await readFile(new URL(file, modelDirectory), "utf8")).split(/\r?\n/);
    const atoms = file.endsWith(".pdb")
      ? lines.filter(line => line.startsWith("ATOM  ")).map(line => [30, 38, 46].map(start => Number(line.slice(start, start + 8))))
      : lines.slice(4, 4 + Number(lines[3].slice(0, 3))).map(line => [0, 10, 20].map(start => Number(line.slice(start, start + 10))));
    assert.ok(atoms.length > 0);
    const min = [0, 1, 2].map(axis => Math.min(...atoms.map(point => point[axis])));
    const max = [0, 1, 2].map(axis => Math.max(...atoms.map(point => point[axis])));
    for (const viewport of [{ width: 880, height: 420 }, { width: 355, height: 390 }]) {
      for (const margin of [0.9, 1.9]) {
        const camera = fitModelCamera(min, max, viewport, Math.PI / 4, margin);
        assert.ok(camera, file);
        const tangent = Math.tan(Math.PI / 8), aspect = viewport.width / viewport.height;
        for (const point of atoms) {
          const depth = camera.position[2] - point[2];
          assert.ok(depth > 0, `${file}: camera must remain in front of all atoms`);
          const x = Math.abs(point[0] - camera.target[0]) + margin;
          const y = Math.abs(point[1] - camera.target[1]) + margin;
          assert.ok(x / (depth * tangent * aspect) < 0.83, `${file}: horizontal clipping`);
          assert.ok(y / (depth * tangent) < 0.83, `${file}: vertical clipping`);
          assert.ok(Math.hypot(...point.map((value, axis) => value - camera.target[axis])) < camera.radius, `${file}: clipping sphere must include all atoms`);
        }
      }
    }
  }
});

test("compact models occupy useful space instead of inheriting inflated label bounds", () => {
  const camera = fitModelCamera([-2, -2, -1], [2, 2, 1], { width: 880, height: 420 });
  assert.ok(camera);
  const distance = camera.position[2] - camera.target[2];
  const occupancy = 4 / (2 * distance * Math.tan(Math.PI / 8));
  assert.ok(occupancy > 0.4 && occupancy < 0.82);
  assert.deepEqual(camera.up, [0, 1, 0]);
});

test("camera fitting skips hidden or unmeasured hosts", () => {
  assert.equal(fitModelCamera([0, 0, 0], [1, 1, 1], { width: 0, height: 420 }), null);
  assert.equal(fitModelCamera([Infinity, 0, 0], [1, 1, 1], { width: 880, height: 420 }), null);
});
