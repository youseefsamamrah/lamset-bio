import carbohydrateParts from "./carbohydrateParts.json";
import notebookModels from "./notebookModelParts.json";
import notebookDrawings from "./notebookFattyParts.json";

export type Category = "carbs" | "lipids" | "proteins";
export type MoleculePart = { id:string; label:string; note:string; color:string; atomIndices:number[] };
export type Molecule = {
  id:string; category:Category; name:string; english:string; formula?:string;
  elements:string[]; source:string; format?:"sdf"|"pdb"; protein?:boolean;
  detail:string; notebook:string; example?:string; parts?:MoleculePart[];
};

// Only names and explanatory terms found in the supplied notebook are presented.
// Finite drawings are explicitly schematic; their chosen chain lengths are not lesson facts.
const genericNote = "رسم مبسّط للتركيب العام؛ طول السلسلة تمثيلي.";
export const molecules: Molecule[] = [
  { id:"glucose", category:"carbs", name:"جلوكوز", english:"Glucose", formula:"C₆H₁₂O₆", elements:["C","H","O"], source:notebookDrawings.models.glucose.source, detail:"سكر أحادي · الشكل المفتوح في الدفتر", notebook:"IMG_3353", parts:notebookDrawings.models.glucose.parts },
  { id:"fructose", category:"carbs", name:"فركتوز", english:"Fructose", elements:["C","H","O"], source:"/models/fructose.sdf", detail:"سكر أحادي", notebook:"IMG_3353", parts:carbohydrateParts.fructose },
  { id:"galactose", category:"carbs", name:"جالاكتوز", english:"Galactose", elements:["C","H","O"], source:"/models/galactose.sdf", detail:"سكر أحادي", notebook:"IMG_3353", parts:carbohydrateParts.galactose },
  { id:"sucrose", category:"carbs", name:"سكروز", english:"Sucrose", elements:["C","H","O"], source:"/models/sucrose.sdf", detail:"جلوكوز + فركتوز", notebook:"IMG_3353–3354", parts:carbohydrateParts.sucrose },
  { id:"maltose", category:"carbs", name:"مالتوز", english:"Maltose", elements:["C","H","O"], source:"/models/maltose.sdf", detail:"جلوكوز + جلوكوز", notebook:"IMG_3353", parts:carbohydrateParts.maltose },
  { id:"lactose", category:"carbs", name:"لاكتوز", english:"Lactose", elements:["C","H","O"], source:"/models/lactose.sdf", detail:"جلوكوز + جالاكتوز", notebook:"IMG_3353", parts:carbohydrateParts.lactose },
  { id:"starch", category:"carbs", name:"النشا · مقطع سلسلة", english:"Starch", elements:["C","H","O"], source:"/models/starch-fragment.sdf", detail:"عديد تسكّر", notebook:"IMG_3359", example:"مقطع مبسّط من الجزء غير المتفرّع للنشا، وليس الجزيء الكامل.", parts:carbohydrateParts.starch },
  { id:"glycogen", category:"carbs", name:"الجلايكوجين · موضع تفرع", english:"Glycogen", elements:["C","H","O"], source:"/models/glycogen-fragment.sdf", detail:"عديد تسكّر متفرّع", notebook:"IMG_3359", example:"مقطع مبسّط يوضح موضع تفرّع، وليس الجزيء الكامل.", parts:carbohydrateParts.glycogen },
  { id:"cellulose", category:"carbs", name:"السليلوز · مقطع سلسلة", english:"Cellulose", elements:["C","H","O"], source:"/models/cellulose-fragment.sdf", detail:"عديد تسكّر غير متفرّع", notebook:"IMG_3359", example:"مقطع مبسّط من سلسلة غير متفرّعة، وليس الجزيء الكامل.", parts:carbohydrateParts.cellulose },
  { id:"glycerol", category:"lipids", name:"جليسرول", english:"Glycerol", elements:["C","H","O"], source:"/models/glycerol.sdf", detail:"يرتبط بالأحماض الدهنية", notebook:"IMG_3360–3362" },
  { id:"palmitic", category:"lipids", name:"حمض دهني مشبع", english:"Saturated fatty acid", ...notebookDrawings.models.saturated, detail:"سلسلة هيدروكربونية ومجموعة كربوكسيل", notebook:"IMG_3360–3363", example:genericNote },
  { id:"oleic", category:"lipids", name:"حمض دهني غير مشبع", english:"Unsaturated fatty acid", ...notebookDrawings.models.unsaturated, detail:"سلسلة فيها رابطة مزدوجة", notebook:"IMG_3361–3363", example:genericNote },
  { id:"tripalmitin", category:"lipids", name:"دهن ثلاثي", english:"Triglyceride", ...notebookDrawings.models.triglyceride, detail:"جليسرول وثلاث سلاسل دهنية", notebook:"IMG_3362", example:notebookDrawings.models.triglyceride.note },
  { id:"phospholipid", category:"lipids", name:"فوسفوليبيد", english:"Phospholipid", ...notebookModels.models.phospholipid, detail:"رأس فوسفاتي وجليسرول وذيلان", notebook:"IMG_3363–3364", example:"رسم مبسّط للأجزاء في الدفتر؛ أطوال الذيلين تمثيلية." },
  { id:"bilayer", category:"lipids", name:"طبقة دهنية ثنائية", english:"Lipid bilayer", ...notebookModels.models.bilayer, detail:"الرؤوس للخارج والذيلان إلى الداخل", notebook:"IMG_3364", example:"رقعة مبسّطة توضح ترتيب الفوسفوليبيدات، وليست غشاءً كاملًا." },
  { id:"cholesterol", category:"lipids", name:"كوليسترول", english:"Cholesterol", elements:["C","H","O"], source:"/models/cholesterol.sdf", detail:"أربع حلقات متصلة", notebook:"IMG_3364" },
  { id:"glycine", category:"proteins", name:"حمض أميني", english:"Amino acid", ...notebookModels.models["amino-acid"], detail:"التركيب العام كما في الدفتر", notebook:"IMG_3365", example:"R مجموعة متغيّرة في الرسم، وليست عنصرًا كيميائيًا." },
  { id:"dipeptide", category:"proteins", name:"ثنائي ببتيد", english:"Dipeptide", ...notebookModels.models.dipeptide, detail:"حمضان أمينيان مرتبطان", notebook:"IMG_3366", example:"التركيب العام بمجموعتي R كما في رسم الدفتر." },
  { id:"amylase", category:"proteins", name:"إنزيم الأميليز", english:"Amylase", elements:["C","N","O","S"], source:"/models/amylase.pdb", format:"pdb", protein:true, detail:"إنزيم يحلّل النشا", notebook:"IMG_3367", example:"تمثيل ثلاثي الأبعاد للإنزيم المذكور في الدفتر." },
];

export const categories: { id: Category; label: string; english: string }[] = [
  { id:"carbs", label:"السكريات", english:"CARBOHYDRATES" },
  { id:"lipids", label:"الدهون", english:"LIPIDS" },
  { id:"proteins", label:"البروتينات", english:"PROTEINS" },
];

export const reactions: Record<string,{ label:string; to:string; left:string; right:string; outcome:string }> = {
  glucose:{ label:"جلوكوز + فركتوز", to:"sucrose", left:"H", right:"OH", outcome:"H₂O" },
  fructose:{ label:"جلوكوز + فركتوز", to:"sucrose", left:"H", right:"OH", outcome:"H₂O" },
  glycerol:{ label:"جليسرول + ٣ أحماض دهنية", to:"tripalmitin", left:"H", right:"OH", outcome:"3H₂O" },
  palmitic:{ label:"جليسرول + ٣ أحماض دهنية", to:"tripalmitin", left:"H", right:"OH", outcome:"3H₂O" },
  glycine:{ label:"حمضان أمينيان", to:"dipeptide", left:"H", right:"OH", outcome:"H₂O" },
};
