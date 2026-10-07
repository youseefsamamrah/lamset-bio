from pathlib import Path
from collections import Counter
import json
import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit.Geometry import Point3D

root = Path('public/models')
meta = {'models': {}, 'reactions': {}}

def save(m, name):
    m.SetProp('_Name', name)
    writer = Chem.SDWriter(str(root / (name + '.sdf')))
    writer.write(m); writer.close()

def coords(m, offset=(0, 0, 0)):
    m = Chem.Mol(m)
    for i, p in enumerate(m.GetConformer().GetPositions() + np.array(offset)):
        m.GetConformer().SetAtomPosition(i, Point3D(*p))
    return m

def embed(smiles):
    m = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3(); params.randomSeed = 3362
    assert AllChem.EmbedMolecule(m, params) == 0
    AllChem.MMFFOptimizeMolecule(m)
    p = m.GetConformer().GetPositions(); heavy = [a.GetIdx() for a in m.GetAtoms() if a.GetAtomicNum() != 1]
    q = p - p[heavy].mean(axis=0); _, _, v = np.linalg.svd(q[heavy])
    x, z = v[0], v[-1]; y = np.cross(z, x); basis = np.column_stack([x, y, z])
    for i, point in enumerate(q @ basis): m.GetConformer().SetAtomPosition(i, Point3D(*point))
    return m

def with_h(m, ids):
    return sorted(set(ids) | {n.GetIdx() for i in ids for n in m.GetAtomWithIdx(i).GetNeighbors() if n.GetAtomicNum() == 1})

def part(key, label, note, color, ids):
    return dict(id=key, label=label, note=note, color=color, atomIndices=sorted(set(ids)))

def record(key, m, name, parts, note):
    save(m, name)
    meta['models'][key] = dict(source='/models/'+name+'.sdf', elements=['C','H','O'], parts=parts, note=note)

for key, smiles in [('saturated', 'CCCCCC(=O)O'), ('unsaturated', 'CCC/C=C\\CCC(=O)O')]:
    m = embed(smiles)
    head = with_h(m, m.GetSubstructMatch(Chem.MolFromSmarts('[CX3](=[OX1])[OX2H1]')))
    chain = sorted(set(range(m.GetNumAtoms()))-set(head))
    parts = [part('carboxyl','مجموعة الكربوكسيل','COOH','#e5a54b',head), part('chain','السلسلة الهيدروكربونية','سلسلة من الكربون والهيدروجين.','#4db6ac',chain)]
    if key == 'unsaturated':
        bond = next(b for b in m.GetBonds() if b.GetBondType() == Chem.BondType.DOUBLE and b.GetBeginAtom().GetAtomicNum() == b.GetEndAtom().GetAtomicNum() == 6)
        parts.append(part('double-bond','الرابطة المزدوجة','C=C في السلسلة غير المشبعة.','#72a4db',with_h(m,[bond.GetBeginAtomIdx(),bond.GetEndAtomIdx()])))
    record(key, m, 'notebook-fatty-'+key, parts, 'رسم مبسّط للتركيب العام؛ طول السلسلة تمثيلي.')
    if key == 'saturated': saturated = m

triglyceride = embed('CCCCCC(=O)OCC(OC(=O)CCCCC)COC(=O)CCCCC')
esters = triglyceride.GetSubstructMatches(Chem.MolFromSmarts('[CX3](=[OX1])[OX2][CX4]'))
def component(start, blocked):
    seen = set(blocked); result = []; todo = [start]
    while todo:
        i = todo.pop()
        if i in seen: continue
        seen.add(i); result.append(i); todo += [n.GetIdx() for n in triglyceride.GetAtomWithIdx(i).GetNeighbors()]
    return result
chains = [component(e[0], [e[2]]) for e in esters]
glycerol_ids = sorted(set(range(triglyceride.GetNumAtoms())) - set(sum(chains,[])))
parts = [part('glycerol','الجليسرول','يتصل بثلاث سلاسل دهنية.','#a48bd9',glycerol_ids)]
parts += [part('chain-'+str(i+1),'السلسلة الدهنية '+str(i+1),'سلسلة مرتبطة بالجليسرول.',color,ids) for i,(color,ids) in enumerate(zip(['#4db6ac','#72a4db','#e5a54b'],chains))]
record('triglyceride',triglyceride,'notebook-triglyceride',parts,'رسم مبسّط للجليسرول وثلاث سلاسل دهنية؛ أطوال السلاسل تمثيلية.')

glycerol = next(iter(Chem.SDMolSupplier(str(root/'glycerol.sdf'), removeHs=False)))
reactants = coords(glycerol,(-8,0,0)); regions = {'glycerol':list(range(glycerol.GetNumAtoms()))}
for i in range(3):
    start = reactants.GetNumAtoms(); m = coords(saturated,(5,(i-1)*6,0))
    reactants = Chem.CombineMols(reactants,m); regions['fatty-acid-'+str(i+1)] = list(range(start,reactants.GetNumAtoms()))
save(reactants,'notebook-reactants-triglyceride')
products = Chem.Mol(triglyceride); output = {'product':list(range(products.GetNumAtoms()))}
water = Chem.AddHs(Chem.MolFromSmiles('O')); conformer = Chem.Conformer(3)
for i,p in enumerate([[0,0,0],[.9572,0,0],[-.239987,.926627,0]]): conformer.SetAtomPosition(i,Point3D(*p))
water.AddConformer(conformer)
right = triglyceride.GetConformer().GetPositions()[:,0].max()+4
for i in range(3):
    start = products.GetNumAtoms(); products = Chem.CombineMols(products,coords(water,(right,(i-1)*4,0)))
    output['water-'+str(i+1)] = list(range(start,products.GetNumAtoms()))
save(products,'notebook-products-triglyceride')
assert Counter(a.GetSymbol() for a in reactants.GetAtoms()) == Counter(a.GetSymbol() for a in products.GetAtoms())
meta['reactions']['triglyceride'] = dict(reactants=dict(source='/models/notebook-reactants-triglyceride.sdf',regions=regions),products=dict(source='/models/notebook-products-triglyceride.sdf',regions=output))

# Open the glucose hemiacetal ring while preserving the four remaining stereocentres.
m = Chem.RemoveHs(next(iter(Chem.SDMolSupplier(str(root/'glucose.sdf'),removeHs=False))))
ring = m.GetRingInfo().AtomRings()[0]
ring_o = next(i for i in ring if m.GetAtomWithIdx(i).GetAtomicNum()==8)
anomeric = next(a for a in m.GetAtomWithIdx(ring_o).GetNeighbors() if any(n.GetAtomicNum()==8 and n.GetIdx()!=ring_o for n in a.GetNeighbors()))
aldehyde_o = next(n.GetIdx() for n in anomeric.GetNeighbors() if n.GetAtomicNum()==8 and n.GetIdx()!=ring_o)
rw = Chem.RWMol(m); rw.RemoveBond(ring_o,anomeric.GetIdx()); rw.GetBondBetweenAtoms(anomeric.GetIdx(),aldehyde_o).SetBondType(Chem.BondType.DOUBLE)
rw.GetAtomWithIdx(anomeric.GetIdx()).SetChiralTag(Chem.ChiralType.CHI_UNSPECIFIED)
for a in rw.GetAtoms(): a.SetNoImplicit(False); a.SetNumExplicitHs(0)
open_glucose = rw.GetMol(); Chem.SanitizeMol(open_glucose)
open_glucose = embed(Chem.MolToSmiles(open_glucose))
parts = [part('aldehyde','مجموعة الألدهيد','C=O عند طرف السلسلة.','#e5a54b',with_h(open_glucose,open_glucose.GetSubstructMatch(Chem.MolFromSmarts('[CX3H1]=[OX1]')))),part('hydroxyl','مجموعات OH','مجموعات الهيدروكسيل.','#ef8e86',with_h(open_glucose,[a.GetIdx() for a in open_glucose.GetAtoms() if a.GetAtomicNum()==8 and any(n.GetAtomicNum()==1 for n in a.GetNeighbors())])),part('carbon','ذرات الكربون C','ذرات الكربون في السلسلة.','#4db6ac',[a.GetIdx() for a in open_glucose.GetAtoms() if a.GetAtomicNum()==6])]
record('glucose',open_glucose,'notebook-glucose',parts,'الشكل المفتوح كما في رسم الدفتر.')
# Use the same displayed glucose on the reactant side of sucrose formation.
fructose = next(iter(Chem.SDMolSupplier(str(root/'fructose.sdf'),removeHs=False)))
left = coords(open_glucose,(-6,0,0)); right_model = coords(fructose,(6,0,0)); sucrose_inputs = Chem.CombineMols(left,right_model)
save(sucrose_inputs,'notebook-reactants-sucrose')
meta['reactions']['sucrose'] = {'reactants':dict(source='/models/notebook-reactants-sucrose.sdf',regions={'glucose':list(range(open_glucose.GetNumAtoms())),'fructose':list(range(open_glucose.GetNumAtoms(),sucrose_inputs.GetNumAtoms()))})}
Path('app/notebookFattyParts.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Notebook drawings and balanced scenes generated.')
