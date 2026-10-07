from pathlib import Path
from rdkit import Chem
from rdkit.Geometry import Point3D
import numpy as np,json
root=Path('public/models');meta={'models':{},'reactions':{}}
def load(n):return next(iter(Chem.SDMolSupplier(str(root/(n+'.sdf')),removeHs=False)))
def part(i,label,note,color,ids):return dict(id=i,label=label,note=note,color=color,atomIndices=sorted(set(ids)))
def save(m,name):
 m.SetProp('_Name',name);w=Chem.SDWriter(str(root/(name+'.sdf')));w.write(m);w.close()
 # Literal R is the MDL variable-group token. Mol* reads this column verbatim.
 lines=(root/(name+'.sdf')).read_text().splitlines()
 for a in m.GetAtoms():
  if a.GetAtomicNum()==0:
   i=a.GetIdx()+4;lines[i]=lines[i][:31]+'R  '+lines[i][34:]
 (root/(name+'.sdf')).write_text('\n'.join(lines)+'\n')
def hs(m,ids):return sorted(set(ids)|{a.GetIdx() for i in ids for a in m.GetAtomWithIdx(i).GetNeighbors() if a.GetAtomicNum()==1})
def record(key,m,filename,parts,elements,note):
 meta['models'][key]={'source':'/models/'+filename+'.sdf','elements':elements,'parts':parts,'regions':{p['id']:p['atomIndices'] for p in parts},'note':note}

def generic(m):
 rw=Chem.RWMol(m);positions=m.GetConformer().GetPositions();rs=[]
 for a in m.GetAtoms():
  if a.GetAtomicNum()!=6 or a.GetHybridization()!=Chem.HybridizationType.SP3:continue
  ns=a.GetNeighbors()
  if not any(n.GetAtomicNum()==7 for n in ns) or not any(n.GetAtomicNum()==6 for n in ns):continue
  h=next(n.GetIdx() for n in ns if n.GetAtomicNum()==1);dummy=Chem.Atom(0);dummy.SetNoImplicit(True);rw.ReplaceAtom(h,dummy);rs.append(h)
  vector=positions[h]-positions[a.GetIdx()];vector*=1.5/np.linalg.norm(vector);rw.GetConformer().SetAtomPosition(h,Point3D(*(positions[a.GetIdx()]+vector)))
 out=rw.GetMol();Chem.SanitizeMol(out)
 # A rigid rotation separates the variable R and H in the default camera view.
 angle=np.pi/4;rotation=np.array([[np.cos(angle),0,np.sin(angle)],[0,1,0],[-np.sin(angle),0,np.cos(angle)]])
 for i,pos in enumerate(out.GetConformer().GetPositions()@rotation.T):out.GetConformer().SetAtomPosition(i,Point3D(*pos))
 return out,rs
amino,r=generic(load('glycine'));amino_name='notebook-amino-acid';save(amino,amino_name)
amine=hs(amino,[a.GetIdx() for a in amino.GetAtoms() if a.GetAtomicNum()==7]);cooh=hs(amino,list(amino.GetSubstructMatch(Chem.MolFromSmarts('[CX3](=[OX1])[OX2H1]'))));center=sorted(set(range(amino.GetNumAtoms()))-set(amine+cooh+r))
ap=[part('amine','مجموعة الأمين','NH₂','#72a4db',amine),part('carboxyl','مجموعة الكربوكسيل','COOH','#e5a54b',cooh),part('r-group','المجموعة R','مجموعة متغيرة كما في رسم الدفتر.','#a48bd9',r),part('central','الكربون المركزي','يرتبط بالمجموعات الثلاث وبذرة هيدروجين.','#4db6ac',center)]
record('amino-acid',amino,amino_name,ap,['C','H','O','N','R'],'رسم عام للحمض الأميني؛ R مجموعة متغيرة وليست عنصرًا.')
peptide,r=generic(load('glycylglycine'));pname='notebook-dipeptide';save(peptide,pname);link=hs(peptide,list(peptide.GetSubstructMatch(Chem.MolFromSmarts('[CX3](=[OX1])[NX3]'))));amine=hs(peptide,[a.GetIdx() for a in peptide.GetAtoms() if a.GetAtomicNum()==7 and a.GetIdx() not in link]);cooh=hs(peptide,list(peptide.GetSubstructMatch(Chem.MolFromSmarts('[CX3](=[OX1])[OX2H1]'))));center=sorted(set(range(peptide.GetNumAtoms()))-set(link+amine+cooh+r))
pp=[part('peptide','الرابطة الببتيدية','تربط الحمضين الأمينيين.','#a48bd9',link),part('amine','مجموعة الأمين','NH₂','#72a4db',amine),part('carboxyl','مجموعة الكربوكسيل','COOH','#e5a54b',cooh),part('r-groups','مجموعتا R','مجموعتان متغيرتان، واحدة لكل وحدة.','#ef8e86',r),part('central','الكربونان المركزيان','واحد في كل وحدة حمض أميني.','#4db6ac',center)]
record('dipeptide',peptide,pname,pp,['C','H','O','N','R'],'رسم عام لثنائي ببتيد؛ مجموعتا R غير محددتين.')
# Retain phosphate O atoms; remove only the choline carbon/nitrogen substituent and its H atoms.
m=load('popc');oldregions=json.loads((root/'popc-regions.json').read_text())['regions'];nitrogen=next(a.GetIdx() for a in m.GetAtoms() if a.GetAtomicNum()==7);seen={48};todo=[nitrogen];remove=[]
while todo:
 i=todo.pop()
 if i in seen:continue
 seen.add(i);remove.append(i);todo.extend(a.GetIdx() for a in m.GetAtomWithIdx(i).GetNeighbors())
assert all(m.GetAtomWithIdx(i).GetAtomicNum() in [1,6,7] for i in remove)
for a in m.GetAtoms():a.SetIntProp('old',a.GetIdx())
rw=Chem.RWMol(m)
for i in sorted(remove,reverse=True):rw.RemoveAtom(i)
scaffold=rw.GetMol()
for a in scaffold.GetAtoms():
 if a.GetAtomicNum()==8 and a.GetFormalCharge()==-1:a.SetFormalCharge(0);a.SetNoImplicit(False);a.SetNumExplicitHs(0)
 if a.GetIntProp('old')==48:a.SetNoImplicit(False);a.SetNumExplicitHs(0)
Chem.SanitizeMol(scaffold);scaffold=Chem.AddHs(scaffold,addCoords=True)
regions={}
for name in ['head','glycerol','saturated','unsaturated']:
 ids=[a.GetIdx() for a in scaffold.GetAtoms() if a.HasProp('old') and a.GetIntProp('old') in oldregions[name]]
 regions[name]=hs(scaffold,ids)
assert not any(a.GetAtomicNum()==7 for a in scaffold.GetAtoms())
assert len(set(sum(regions.values(),[])))==scaffold.GetNumAtoms()
phname='notebook-phospholipid';save(scaffold,phname)
ph_parts=[part('head','الرأس الفوسفاتي','رأس محب للماء.','#e5a54b',regions['head']),part('glycerol','الجليسرول','يربط الرأس بالذيلين.','#a48bd9',regions['glycerol']),part('saturated','الذيل المشبع','سلسلة دون رابطة كربون مزدوجة.','#4db6ac',regions['saturated']),part('unsaturated','الذيل غير المشبع','تظهر انحناءة عند الرابطة المزدوجة.','#72a4db',regions['unsaturated'])]
record('phospholipid',scaffold,phname,ph_parts,['C','H','O','P'],'رسم بنائي مبسط للرأس والجليسرول والذيلين؛ أطوال السلاسل تمثيلية وليست تعريفًا لنوع محدد.')
# Four copies of the same generic scaffold, in the notebook head-out/tail-in arrangement.
bilayer=None;br={'upper-heads':[],'lower-heads':[],'tails':[],'glycerol':[]};coords=[];n=scaffold.GetNumAtoms();xyz=scaffold.GetConformer().GetPositions()
for k,(x,y) in enumerate([(-16,16.75),(16,16.75),(-16,-16.75),(16,-16.75)]):
 c=Chem.Mol(scaffold);rot=np.diag([1,1,1] if k<2 else [1,-1,-1]);p=xyz@rot+np.array([x,y,0]);coords.append(p)
 for i,pos in enumerate(p):c.GetConformer().SetAtomPosition(i,Point3D(*pos))
 bilayer=c if bilayer is None else Chem.CombineMols(bilayer,c)
 br['upper-heads' if k<2 else 'lower-heads'] += [i+k*n for i in regions['head']];br['tails'] += [i+k*n for i in regions['saturated']+regions['unsaturated']];br['glycerol'] += [i+k*n for i in regions['glycerol']]
bname='notebook-bilayer';save(bilayer,bname);bp=[part('upper-heads','الرؤوس العليا','تتجه نحو الماء.','#e5a54b',br['upper-heads']),part('lower-heads','الرؤوس السفلى','تتجه نحو الماء في الجانب الآخر.','#e5a54b',br['lower-heads']),part('tails','الذيول إلى الداخل','تتقابل في داخل الطبقة الثنائية.','#4db6ac',br['tails']),part('glycerol','الجليسرول','وصلات بين الرؤوس والذيلين.','#a48bd9',br['glycerol'])];record('bilayer',bilayer,bname,bp,['C','H','O','P'],'رقعة مبسطة لشرح اتجاه الرؤوس والذيلين، وليست غشاءً كاملًا.')
# Generic peptide comparison, with balanced explicit H/O and unchanged first-product atom indices.
reactants=Chem.Mol(amino);second=Chem.Mol(amino);p=amino.GetConformer().GetPositions();shift=p[:,0].max()-p[:,0].min()+5
for i,pos in enumerate(p+np.array([shift,0,0])):second.GetConformer().SetAtomPosition(i,Point3D(*pos))
reactants=Chem.CombineMols(reactants,second);rn='notebook-reactants-peptide';save(reactants,rn)
water=Chem.AddHs(Chem.MolFromSmiles('O'));wc=Chem.Conformer(3);p=peptide.GetConformer().GetPositions();origin=np.array([p[:,0].max()+5,p[:,1].mean(),p[:,2].mean()])
for i,pos in enumerate(np.array([[0,0,0],[.9572,0,0],[-.239987,.926627,0]])+origin):wc.SetAtomPosition(i,Point3D(*pos))
water.AddConformer(wc);products=Chem.CombineMols(peptide,water);pn='notebook-products-peptide';save(products,pn)
from collections import Counter
assert Counter(a.GetAtomicNum() for a in reactants.GetAtoms())==Counter(a.GetAtomicNum() for a in products.GetAtoms())
meta['reactions']['peptide']={'reactants':{'source':'/models/'+rn+'.sdf','regions':{'amino-acid-1':list(range(amino.GetNumAtoms())),'amino-acid-2':list(range(amino.GetNumAtoms(),amino.GetNumAtoms()*2))}},'products':{'source':'/models/'+pn+'.sdf','regions':{'product':list(range(peptide.GetNumAtoms())),'water-1':list(range(peptide.GetNumAtoms(),products.GetNumAtoms()))}}}
for key,d in meta['models'].items():
 mol={'amino-acid':amino,'dipeptide':peptide,'phospholipid':scaffold,'bilayer':bilayer}[key];ids=sum([p['atomIndices'] for p in d['parts']],[]);assert len(ids)==len(set(ids))==mol.GetNumAtoms();print(key,mol.GetNumAtoms(),'atoms; complete groups')
Path('app/notebookModelParts.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8');(root/'notebook-regions.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Generic peptide counts balanced',dict(Counter(a.GetSymbol() for a in products.GetAtoms())))
