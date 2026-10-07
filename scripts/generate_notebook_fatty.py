"""Build short, explicitly illustrative C/H/O notebook diagrams.

The six-carbon tails are drawing fragments, not a claim that the notebook
specified a chain length or a named fatty acid.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.Geometry import Point3D


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "public" / "models"
SATURATED = "CCCCCC(=O)O"
UNSATURATED = r"CC/C=C\CC(=O)O"
GLYCEROL = "OCC(O)CO"
TRIGLYCERIDE = "CCCCCC(=O)OCC(COC(=O)CCCCC)OC(=O)CCCCC"


def embed(smiles: str, seed: int) -> Chem.Mol:
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    if AllChem.EmbedMolecule(mol, randomSeed=seed) != 0:
        raise RuntimeError(f"Could not embed {smiles}")
    AllChem.UFFOptimizeMolecule(mol, maxIters=300)
    return mol


def shift(mol: Chem.Mol, x: float, y: float, z: float = 0) -> Chem.Mol:
    result = Chem.Mol(mol)
    conf = result.GetConformer()
    for i in range(result.GetNumAtoms()):
        p = conf.GetAtomPosition(i)
        conf.SetAtomPosition(i, Point3D(p.x + x, p.y + y, p.z + z))
    return result


def join(mols: list[Chem.Mol]) -> Chem.Mol:
    result = mols[0]
    for mol in mols[1:]:
        result = Chem.CombineMols(result, mol)
    return result


def atom_count(mol: Chem.Mol) -> Counter[str]:
    return Counter(atom.GetSymbol() for atom in mol.GetAtoms())


def with_hydrogens(mol: Chem.Mol, heavy_indices: set[int]) -> list[int]:
    selected = set(heavy_indices)
    for idx in list(heavy_indices):
        selected.update(
            neighbor.GetIdx()
            for neighbor in mol.GetAtomWithIdx(idx).GetNeighbors()
            if neighbor.GetSymbol() == "H"
        )
    return sorted(selected)


def matches(mol: Chem.Mol, smarts: str) -> set[int]:
    query = Chem.MolFromSmarts(smarts)
    return {index for match in mol.GetSubstructMatches(query) for index in match}


def write_sdf(name: str, mol: Chem.Mol, title: str) -> str:
    mol.SetProp("_Name", title)
    output = MODELS / name
    output.write_text(Chem.MolToMolBlock(mol) + "\n$$$$\n", encoding="utf-8")
    check = Chem.SDMolSupplier(str(output), removeHs=False)
    if len(check) != 1 or check[0] is None:
        raise RuntimeError(f"SDF round trip failed: {name}")
    assert atom_count(check[0]) == atom_count(mol), name
    return f"/models/{name}"


def part(id: str, label: str, note: str, color: str, indices: list[int]) -> dict:
    return {"id": id, "label": label, "note": note, "color": color, "atomIndices": indices}


def acid_parts(mol: Chem.Mol, unsaturated: bool) -> list[dict]:
    carboxyl = matches(mol, "[CX3](=[OX1])[OX2H1]")
    if not carboxyl:
        raise RuntimeError("Acid lacks COOH")
    chain = set(range(mol.GetNumAtoms())) - set(with_hydrogens(mol, carboxyl))
    result = [
        part("carboxyl", "مجموعة الكربوكسيل", "طرف COOH في الرسم المبسّط.", "#e7b16e", with_hydrogens(mol, carboxyl)),
        part("chain", "السلسلة الكربونية", "جزء قصير مرسوم من السلسلة الدهنية.", "#70c5b4", sorted(chain)),
    ]
    if unsaturated:
        double = {
            bond.GetBeginAtomIdx() for bond in mol.GetBonds()
            if bond.GetBondType() == Chem.BondType.DOUBLE
            and bond.GetBeginAtom().GetSymbol() == "C"
            and bond.GetEndAtom().GetSymbol() == "C"
        } | {
            bond.GetEndAtomIdx() for bond in mol.GetBonds()
            if bond.GetBondType() == Chem.BondType.DOUBLE
            and bond.GetBeginAtom().GetSymbol() == "C"
            and bond.GetEndAtom().GetSymbol() == "C"
        }
        result.append(part("double-bond", "الرابطة المزدوجة", "C=C تصنع انحناءة في السلسلة المرسومة.", "#87aee4", with_hydrogens(mol, double)))
    return result


def triglyceride_parts(mol: Chem.Mol) -> list[dict]:
    glycerol = matches(mol, "[CH2]([O])[CH]([O])[CH2][O]")
    ester = matches(mol, "[CX3](=[OX1])[OX2][C]")
    if len(glycerol) < 6 or len(ester) < 9:
        raise RuntimeError("Triglyceride scaffold not found")
    chain = set(range(mol.GetNumAtoms())) - set(with_hydrogens(mol, glycerol | ester))
    return [
        part("glycerol", "الجليسرول", "الهيكل الذي تتصل به ثلاث سلاسل دهنية.", "#b3a1dd", with_hydrogens(mol, glycerol)),
        part("ester", "روابط الإستر", "ثلاث وصلات بين الجليسرول والسلاسل.", "#e7b16e", with_hydrogens(mol, ester)),
        part("chains", "السلاسل الدهنية", "ثلاث سلاسل قصيرة في رسم مبسّط.", "#70c5b4", sorted(chain)),
    ]


def scene_parts(components: list[tuple[str, str, str, Chem.Mol]], color: str) -> list[dict]:
    output = []
    offset = 0
    for id, label, note, mol in components:
        output.append(part(id, label, note, color, list(range(offset, offset + mol.GetNumAtoms()))))
        offset += mol.GetNumAtoms()
    return output


def main() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)
    saturated = embed(SATURATED, 41)
    unsaturated = embed(UNSATURATED, 43)
    glycerol = embed(GLYCEROL, 47)
    triglyceride = embed(TRIGLYCERIDE, 53)
    water = embed("O", 59)

    # Check the drawn condensation equation, including explicit hydrogen atoms.
    left = atom_count(glycerol) + 3 * atom_count(saturated)
    right = atom_count(triglyceride) + 3 * atom_count(water)
    if left != right:
        raise RuntimeError(f"Unbalanced drawing: {left} != {right}")
    if not any(bond.GetBondType() == Chem.BondType.DOUBLE and bond.GetBeginAtom().GetSymbol() == "C" and bond.GetEndAtom().GetSymbol() == "C" for bond in unsaturated.GetBonds()):
        raise RuntimeError("Unsaturated drawing lacks C=C")

    reactant_components = [
        ("glycerol", "الجليسرول", "طرف فيه ثلاث مجموعات OH.", shift(glycerol, 0, 0)),
        ("acid-1", "حمض دهني ١", "سلسلة مرسومة مع COOH.", shift(saturated, -9, 7)),
        ("acid-2", "حمض دهني ٢", "سلسلة مرسومة مع COOH.", shift(saturated, 9, 7)),
        ("acid-3", "حمض دهني ٣", "سلسلة مرسومة مع COOH.", shift(saturated, 0, -9)),
    ]
    reactants = join([item[3] for item in reactant_components])
    water_components = [shift(water, 10, 1), shift(water, 11, 3.2), shift(water, 11, -1.2)]
    products = join([triglyceride, *water_components])
    # The product is deliberately first so atom indices agree with the solo model.
    assert products.GetNumAtoms() >= triglyceride.GetNumAtoms()
    for i in range(triglyceride.GetNumAtoms()):
        assert products.GetAtomWithIdx(i).GetSymbol() == triglyceride.GetAtomWithIdx(i).GetSymbol()

    catalog = {
        "saturated": {
            "source": write_sdf("notebook-fatty-saturated.sdf", saturated, "Simplified saturated fatty-acid drawing"),
            "parts": acid_parts(saturated, False),
        },
        "unsaturated": {
            "source": write_sdf("notebook-fatty-unsaturated.sdf", unsaturated, "Simplified unsaturated fatty-acid drawing"),
            "parts": acid_parts(unsaturated, True),
        },
        "triglyceride": {
            "source": write_sdf("notebook-triglyceride.sdf", triglyceride, "Simplified triglyceride drawing"),
            "parts": triglyceride_parts(triglyceride),
        },
        "reactantsTriglyceride": {
            "source": write_sdf("notebook-reactants-triglyceride.sdf", reactants, "Glycerol plus three drawn fatty acids"),
            "parts": scene_parts(reactant_components, "#70c5b4"),
        },
        "productsTriglyceride": {
            "source": write_sdf("notebook-products-triglyceride.sdf", products, "Drawn triglyceride plus three waters"),
            "parts": triglyceride_parts(triglyceride) + [
                part("water", "٣ جزيئات ماء", "الماء الناتج في رسم التفاعل.", "#8db9e2", list(range(triglyceride.GetNumAtoms(), products.GetNumAtoms())))
            ],
            "productAtomCount": triglyceride.GetNumAtoms(),
        },
        "balance": {"reactants": dict(left), "products": dict(right), "waterCount": 3},
    }
    (ROOT / "app" / "notebookFattyParts.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
