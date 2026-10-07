import reactantRegions from "../public/models/reactant-regions.json";
import productRegions from "../public/models/product-regions.json";
import notebookModels from "./notebookModelParts.json";
import notebookDrawings from "./notebookFattyParts.json";
import { molecules, type MoleculePart } from "./moleculeCatalog";

type RegionScene = { source: string; regions: Record<string, number[]> };
type ReactionScene = {
  id: string; sourceId: string; productId: string; reactantsName: string; water: string;
  reactants: RegionScene; products: RegionScene; reactantParts: MoleculePart[];
};
const ingredients: Record<string, { label: string; color: string }> = {
  glucose: { label: "جلوكوز", color: "#9de6c9" },
  fructose: { label: "فركتوز", color: "#e7b477" },
  glycerol: { label: "جليسرول", color: "#c0a4e4" },
  "fatty-acid-1": { label: "الحمض الدهني الأول", color: "#9de6c9" },
  "fatty-acid-2": { label: "الحمض الدهني الثاني", color: "#e7b477" },
  "fatty-acid-3": { label: "الحمض الدهني الثالث", color: "#8eb5ec" },
  "amino-acid-1": { label: "الحمض الأميني الأول", color: "#9de6c9" },
  "amino-acid-2": { label: "الحمض الأميني الثاني", color: "#e7b477" },
};

export const reactionScenes: Record<string, ReactionScene> = {};
for (const recipe of [
  { id: "sucrose", sourceId: "glucose", productId: "sucrose", reactantsName: "جلوكوز + فركتوز", water: "H₂O" },
  { id: "triglyceride", sourceId: "glycerol", productId: "tripalmitin", reactantsName: "جليسرول + ٣ أحماض دهنية", water: "3H₂O" },
  { id: "peptide", sourceId: "glycine", productId: "dipeptide", reactantsName: "حمضان أمينيان", water: "H₂O" },
]) {
  const notebookScene = recipe.id === "peptide" ? notebookModels.reactions.peptide
    : recipe.id === "triglyceride" ? notebookDrawings.reactions.triglyceride : notebookDrawings.reactions.sucrose;
  const reactants = notebookScene.reactants ?? (reactantRegions.scenes as Record<string, RegionScene>)[`reactants-${recipe.id}`];
  const products = "products" in notebookScene ? notebookScene.products : (productRegions.scenes as Record<string, RegionScene>)[`products-${recipe.id}`];
  reactionScenes[recipe.productId] = {
    ...recipe, reactants, products,
    reactantParts: Object.entries(reactants.regions).map(([id, atomIndices]) => ({
      id, atomIndices, ...ingredients[id], note: "جزيء منفصل قبل الارتباط؛ اضغط على ذراته لتحديد عناصره.",
    })),
  };
}

export function productParts(recipe: ReactionScene): MoleculePart[] {
  const molecule = molecules.find(item => item.id === recipe.productId);
  const waters = Object.entries(recipe.products.regions).filter(([key]) => key.startsWith("water"));
  return [
    ...(molecule?.parts ?? []),
    { id: "water", label: recipe.water === "3H₂O" ? "٣ جزيئات ماء · H₂O" : "جزيء الماء · H₂O", color: "#8eb5ec",
      note: "الماء الناتج عن الارتباط، معروض منفصلًا عن الجزيء.", atomIndices: waters.flatMap(([, indices]) => indices) },
  ];
}
