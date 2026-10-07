# Notebook molecular assets

## Active notebook-only catalog (2026-10-05)

The active catalog now uses `notebook-glucose.sdf` (open-chain drawing from IMG_3353), `notebook-fatty-saturated.sdf`, `notebook-fatty-unsaturated.sdf`, `notebook-triglyceride.sdf`, `notebook-phospholipid.sdf`, `notebook-bilayer.sdf`, `notebook-amino-acid.sdf`, and `notebook-dipeptide.sdf`. Generic lipids are finite structural drawings; chain lengths are illustrative and do not define a taught chemical subtype. The phospholipid scaffold excludes the previous choline substituent. Generic amino acid and dipeptide contain literal MDL `R` placeholders bonded to central carbon atoms; R represents a variable group, not an element or a glycine hydrogen.

`app/notebookModelParts.json` and `app/notebookFattyParts.json` define sources, clickable parts and complete before/after scenes. Product atom ordering is unchanged in the corresponding water scenes. Explicit element counts, including R placeholders, balance on both sides. Regenerate using `scripts/build-notebook-models.py` and `scripts/build-notebook-drawings.py` (RDKit and NumPy). The enzyme viewer renders only polymer components, excluding experimental ligands, ions and solvent.

The UI shows notebook names and simple group labels only. Specialized subtype names, fragment sum formulas, alpha/beta linkage notation, cis terminology and PDB accessions are not displayed. Sugar fragments still have chemically correct covalent graphs, but are identified as short sections, not complete polymers. The remaining sections document **earlier source assets retained for provenance**, not the current displayed generic catalog.

`popc.sdf` is a representative phospholipid with one 16:0 saturated acyl tail and one cis-18:1 unsaturated acyl tail. Identity is PubChem CID 5497103 (https://pubchem.ncbi.nlm.nih.gov/compound/5497103), formula C42H82NO8P. It is a neutral zwitterion (phosphate -1 and choline +1).

Coordinates were generated locally using RDKit ETKDGv3 and MMFF, with extended alkyl torsions and adjusted glycerol torsions to make the two tails inspectable. It is an illustrative molecular conformer, not an experimental membrane structure or a dynamics simulation. The covalent graph, cis alkene, and glycerol stereochemistry follow the source InChI. Explicit hydrogens are present.

`popc-regions.json` records **zero-based SDF atom indices**, including attached hydrogens. The four disjoint display groups head, glycerol, saturated, and unsaturated cover all 134 atoms. The phosphate subset overlaps the head group intentionally. The tail groups include the acyl carbonyl; ester linking oxygens are grouped with glycerol. Atom groups are for visual explanation and do not represent detached molecules.

Notebook correspondence: IMG_3363 shows a phosphate head, glycerol and two tails (one kinked); IMG_3364 shows a bilayer and cholesterol. IMG_3362 shows triglyceride formation. IMG_3353–3354 cover mono/disaccharides and condensation. IMG_3365–3366 show a general amino acid and peptide bond; glycine and glycylglycine are concrete examples of those generic diagrams. IMG_3367 explicitly names amylase and lipase.

The catalog in `app/moleculeCatalog.ts` uses generic notebook concept names for fatty acids, triglyceride, phospholipid, and amino acid. Specialized model names are labeled as examples. Standalone monopalmitin, phosphocholine, alanine, and duplicate saturated fatty acid models are excluded from the catalog.

`bilayer.sdf` is a single disconnected SDF record containing four chemically identical POPC molecules (536 explicit atoms), two per leaflet. Upper-leaflet heads face +Y; lower-leaflet heads face -Y. Hydrocarbon tails face inward. The lower leaflet uses a proper 180-degree rotation, preserving molecular chirality. Molecules were separated deliberately for visual clarity; this is an illustrative patch rather than equilibrium membrane packing or a dynamics simulation. Recomputed minimum interleaflet separation: 2.469 Å for all atoms and 4.475 Å for heavy atoms. Each molecular graph and stereochemical SMILES was verified against `popc.sdf`; the sum formula is C168H328N4O32P4. `bilayer-regions.json` records a disjoint partition into upper heads, lower heads, tails, and glycerol connectors, covering all 536 atoms. This model corresponds to IMG_3364.

## Notebook polysaccharides and sugar readability

IMG_3359 explicitly compares starch (amylose and amylopectin), glycogen, and cellulose. Added three **representative fragments**, each labeled as a fragment in the catalog. They do not represent an entire polymer or its bulk morphology:

- `starch-fragment.sdf`: four D-glucopyranose units with three alpha-(1→4) linkages, representing an amylose segment; C24H42O21, 87 explicit atoms. Amylopectin is explained in the catalog but not mislabeled as this unbranched fragment.
- `glycogen-fragment.sdf`: a four-residue alpha-(1→4) chain with one additional alpha-(1→6) branch at an internal residue; C30H52O26, 108 atoms. It illustrates linkage topology, not glycogen's full branching frequency. The same local motif also occurs in amylopectin.
- `cellulose-fragment.sdf`: four D-glucopyranose units with three beta-(1→4) linkages; C24H42O21, 87 atoms. This is one chain segment, not a cellulose microfibril.

The glucose stereochemistry was taken from the existing glucose model. The alpha-(1→4) construction was cross-checked by generating a dimer and verifying its full stereochemical SMILES exactly matches the existing maltose model. Linkage atoms are tracked throughout construction, and all residue groups include explicit hydrogens. Linkage focus groups intentionally overlap residue groups. Conformers use RDKit ETKDGv3 and MMFF; representative extended conformers and rigid camera-facing orientations were selected for inspection. Coordinates are illustrative, not crystallographic measurements. Linkage reference: https://pmc.ncbi.nlm.nih.gov/articles/PMC2854524/ ; glycogen reference: https://pubmed.ncbi.nlm.nih.gov/19217615/ .

`fructose.sdf` now contains a **beta-D-fructofuranose** representative with a five-membered ring, instead of the old open-chain ketose. It was derived by severing the inter-ring glycosidic bond in the existing sucrose model, keeping the fructose ring's stereochemistry, then adding hydrogens and generating an MMFF conformer. The catalog explicitly says fructose has other cyclic and open-chain forms. Its clickable groups were regenerated for its new atom ordering. Glucose, galactose, maltose, lactose, and sucrose received only proper rigid rotations: their atom ordering, bonding, and stereo remain unchanged. Ring faces now point toward the default viewer to reduce edge-on presentations.

## Complete reactant comparison scenes

These disconnected SDF records contain all named reactant molecules, deliberately separated spatially. They are static before/after comparison scenes, not simulated reaction trajectories. No intercomponent bonds are present. Each component's stereochemical SMILES matches its corresponding source SDF, and `reactant-regions.json` contains exact zero-based per-molecule atom indices including hydrogens.

- `reactants-sucrose.sdf`: C12H24O12; 2 separate molecules; minimum intercomponent atomic separation 4.527 Å.
- `reactants-triglyceride.sdf`: C51H104O9; 4 separate molecules; minimum intercomponent atomic separation 4.278 Å.
- `reactants-peptide.sdf`: C4H10N2O4; 2 separate molecules; minimum intercomponent atomic separation 4.203 Å.

The sucrose reactants are glucose plus cyclic fructofuranose; triglyceride reactants are glycerol plus three palmitic acids; peptide reactants are two glycine molecules. Condensation also produces water (one, three, or one molecule respectively). Reverse hydrolysis requires that water as a reactant; these files only describe the separated sugar/fat/amino-acid side of the comparison.

## Balanced condensation product scenes

`products-sucrose.sdf`, `products-triglyceride.sdf`, and `products-peptide.sdf` contain the existing sucrose, tripalmitin, or glycylglycine molecule **first**, preserving every product atom index and coordinate, followed by one, three, or one separate water molecules. Each water is a bonded O + 2H molecule with approximately 0.957 Å O–H distances and a 104.5° H–O–H angle. There are no intermolecular bonds. `product-regions.json` provides the same scene/region schema as reactants, with a `product` group and individual `water-N` groups. Each full product scene's formula exactly matches its corresponding complete-reactant scene. These are static balanced comparisons; reversing them represents reactants and products of hydrolysis without claiming an atom-resolved trajectory.

- `products-sucrose.sdf`: C12H24O12; minimum intercomponent atomic separation 4.819 Å.
- `products-triglyceride.sdf`: C51H104O9; minimum intercomponent atomic separation 3.581 Å.
- `products-peptide.sdf`: C4H10N2O4; minimum intercomponent atomic separation 4.961 Å.
