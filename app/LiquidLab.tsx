"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { ArrowsInSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsInSimple";
import { AtomIcon } from "@phosphor-icons/react/dist/csr/Atom";
import { CubeIcon } from "@phosphor-icons/react/dist/csr/Cube";
import { TextTIcon } from "@phosphor-icons/react/dist/csr/TextT";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { GridFourIcon } from "@phosphor-icons/react/dist/csr/GridFour";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun";
import MolstarStage, { type PickedAtom, type RenderMode, type StageStatus } from "./MolstarStage";
import ModelPicker from "./ModelPicker";
import { categories, molecules, reactions, type Category } from "./moleculeCatalog";
import { reactionScenes, productParts } from "./reactionScenes";

const elements: Record<string, { name: string; color: string }> = {
  C: { name: "كربون", color: "#495560" }, H: { name: "هيدروجين", color: "#798692" },
  O: { name: "أكسجين", color: "#bb453b" }, N: { name: "نيتروجين", color: "#4665a3" },
  P: { name: "فوسفور", color: "#9b651d" }, S: { name: "كبريت", color: "#8a731b" },
  R: { name: "مجموعة متغيّرة", color: "#716191" },
};
const modes = [
  { id: "ball-and-stick" as RenderMode, label: "ذرات وروابط", icon: AtomIcon },
  { id: "spacefill" as RenderMode, label: "شكل ممتلئ", icon: CubeIcon },
  { id: "cartoon" as RenderMode, label: "شريطي", icon: StackIcon },
];
type ReactionView = { productId: string; phase: "reactants" | "products" };
type Transition = { type: "dehydration" | "hydrolysis"; water: string };
const subscriptDigits: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
function Formula({ value }: { value: string }) {
  return <span dir="ltr" className="formula">{value.split(/([₀-₉0-9]+)/g).map((part, index) =>
    /^[₀-₉0-9]+$/.test(part) ? <sub key={index}>{Array.from(part, digit => subscriptDigits[digit] ?? digit).join("")}</sub> : <span key={index}>{part}</span>,
  )}</span>;
}

function subscribeTheme(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "lamset-bio-theme") return;
    const next = event.newValue === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#111820" : "#f8fafc");
    notify();
  };
  window.addEventListener("lamset-bio-theme", notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("lamset-bio-theme", notify);
    window.removeEventListener("storage", onStorage);
  };
}
const getTheme = (): "light" | "dark" => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerTheme = (): "light" | "dark" => "light";

export default function LiquidLab() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#111820" : "#f8fafc");
    window.dispatchEvent(new Event("lamset-bio-theme"));
    try { localStorage.setItem("lamset-bio-theme", next); } catch { /* Theme works even when storage is unavailable. */ }
  }
  const themeButton = <button type="button" className="theme-toggle quiet-button" onClick={toggleTheme} aria-label={theme === "light" ? "تفعيل الثيم الداكن" : "تفعيل الثيم الأبيض"} title={theme === "light" ? "الثيم الداكن" : "الثيم الأبيض"} aria-pressed={theme === "dark"}>
    {theme === "light" ? <MoonIcon size={19} aria-hidden="true" /> : <SunIcon size={19} aria-hidden="true" />}
  </button>;
  const [category, setCategory] = useState<Category>("carbs");
  const [selectedId, setSelectedId] = useState("glucose");
  const [mode, setMode] = useState<RenderMode>("ball-and-stick");
  const [resetSignal, setResetSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const [captureSignal, setCaptureSignal] = useState(0);
  const [captureStatus, setCaptureStatus] = useState<"idle" | "saving" | "error">("idle");
  const [pickedAtom, setPickedAtom] = useState<PickedAtom | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusInspector, setFocusInspector] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [reactionView, setReactionView] = useState<ReactionView | null>(null);
  const [stageStatus, setStageStatus] = useState<StageStatus>("boot");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastSelectedInCategory = useRef<Partial<Record<Category, string>>>({ carbs: "glucose" });
  const molecule = molecules.find(item => item.id === selectedId) ?? molecules[0];
  const modelIndex = molecules.findIndex(item => item.id === selectedId);
  const categoryMolecules = molecules.filter(item => item.category === category);
  const sceneRecipe = reactionView ? reactionScenes[reactionView.productId] : null;
  const activeScene = sceneRecipe && reactionView ? sceneRecipe[reactionView.phase] : null;
  const parts = sceneRecipe && reactionView ? reactionView.phase === "reactants" ? sceneRecipe.reactantParts : productParts(sceneRecipe) : molecule.parts;
  const selectedPart = parts?.find(part => part.id === selectedPartId);
  const sceneName = sceneRecipe && reactionView ? reactionView.phase === "reactants" ? sceneRecipe.reactantsName : `${molecule.name} + ${sceneRecipe.water}` : molecule.name;
  const symbol = selectedElement ?? pickedAtom?.element;
  const atomInfo = symbol ? elements[symbol] : null;
  const hasSelection = !!(selectedPart || atomInfo);
  const ready = stageStatus === "ready" && !transition;
  const availableRecipe = sceneRecipe ?? reactionScenes[reactions[selectedId]?.to] ?? reactionScenes[selectedId];
  const visibleElements = molecule.elements.filter(item => elements[item]);

  const clearSelection = useCallback(() => { setPickedAtom(null); setSelectedPartId(null); setSelectedElement(null); }, []);
  const cancelTransition = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setTransition(null);
  }, []);
  const selectMolecule = useCallback((id: string, keepScene = false) => {
    const next = molecules.find(item => item.id === id);
    if (!next) return;
    cancelTransition(); clearSelection();
    lastSelectedInCategory.current[next.category] = id;
    setSelectedId(id); setCategory(next.category);
    setAutoRotate(false); setShowLabels(true); setCaptureStatus("idle");
    if (!keepScene) setReactionView(null);
    setMode(current => next.protein ? "cartoon" : current === "cartoon" ? "ball-and-stick" : current);
  }, [cancelTransition, clearSelection]);
  const navigate = useCallback((delta: number) => {
    const items = focusMode ? molecules : molecules.filter(item => item.category === category);
    const index = items.findIndex(item => item.id === selectedId);
    selectMolecule(items[(index + delta + items.length) % items.length].id);
  }, [focusMode, category, selectedId, selectMolecule]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, category]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest("input, textarea, select, dialog")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setPickerOpen(true); return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || pickerOpen) return;
      if (event.key === "Escape") {
        cancelTransition();
        if (hasSelection) clearSelection(); else setFocusMode(false);
        return;
      }
      // Canvas and focused controls retain their own arrow-key behavior.
      if (target && target !== document.body && !target.classList.contains("viewer-app")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); navigate(event.key === "ArrowLeft" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, pickerOpen, hasSelection, clearSelection, cancelTransition]);

  function switchCategory(next: Category) {
    if (next === category) return;
    const id = lastSelectedInCategory.current[next] ?? molecules.find(item => item.category === next)?.id;
    if (id) selectMolecule(id);
  }
  function handleAtomSelect(atom: PickedAtom) {
    setAutoRotate(false); setSelectedElement(null); setPickedAtom(atom);
    const part = parts?.filter(item => item.atomIndices.includes(atom.atomIndex)).sort((a, b) => a.atomIndices.length - b.atomIndices.length)[0];
    setSelectedPartId(part?.id ?? null);
  }
  function selectPart(id: string) {
    setSelectedPartId(current => current === id ? null : id);
    setPickedAtom(null); setSelectedElement(null); setAutoRotate(false);
  }
  function changeReaction(type: "dehydration" | "hydrolysis") {
    if (!availableRecipe || !ready) return;
    const recipe = availableRecipe;
    const from = type === "dehydration" ? "reactants" : "products";
    const to = type === "dehydration" ? "products" : "reactants";
    clearSelection(); setAutoRotate(false);
    if (!reactionView || reactionView.phase !== from) {
      selectMolecule(from === "reactants" ? recipe.sourceId : recipe.productId, true);
      setReactionView({ productId: recipe.productId, phase: from });
      return;
    }
    setTransition({ type, water: recipe.water });
    timer.current = setTimeout(() => {
      selectMolecule(to === "products" ? recipe.productId : recipe.sourceId, true);
      setReactionView({ productId: recipe.productId, phase: to });
      timer.current = null;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
  }
  const selectionContent = <>
    {selectedPart && <><h2 style={{ color: selectedPart.color }}>{selectedPart.label}</h2><p>{selectedPart.note}</p></>}
    {atomInfo && <div className="atom-line"><span className="atom-token" style={{ color: atomInfo.color }}>{symbol}</span><span><small>{selectedElement ? "كل ذرات هذا العنصر" : symbol === "R" ? "المجموعة المختارة" : "الذرة المختارة"}</small><strong>{atomInfo.name}</strong></span></div>}
  </>;
  const reactionControls = availableRecipe && <div className="reaction-panel">
    <div className="reaction-heading"><span>نزع الماء / التحلّل بالماء</span><span className="water-tag" dir="ltr">{availableRecipe.water}</span></div>
    <div className="reaction-actions">
      <button type="button" disabled={!ready} onClick={() => changeReaction("dehydration")}><ArrowLeftIcon aria-hidden="true" size={17} />{reactionView?.phase === "reactants" ? "نزع الماء والربط" : "مكوّنات الارتباط"}</button>
      <button type="button" disabled={!ready} onClick={() => changeReaction("hydrolysis")}><ArrowRightIcon aria-hidden="true" size={17} />{reactionView?.phase === "products" ? "إضافة الماء والفصل" : "الجزيء مع الماء"}</button>
    </div>
    <small>عرض البنية قبل الارتباط وبعده</small>
  </div>;

  return <main className={["viewer-app", "tone-" + category, focusMode ? "is-focused" : "", focusInspector ? "show-focus-inspector" : ""].join(" ")}>
    <header className="app-header">
      <div className="identity" aria-label="لمسة بيو"><span className="identity-mark" aria-hidden="true">b.</span><strong>لمسة بيو<small>الجزيء من كل زاوية</small></strong></div>
      <nav className="category-tabs glass-panel" aria-label="مجموعات الجزيئات">{categories.map(item =>
        <button key={item.id} type="button" className={category === item.id ? "active" : ""} aria-current={category === item.id ? "page" : undefined} onClick={() => switchCategory(item.id)}>{item.label}</button>,
      )}</nav>
      <div className="header-actions">{themeButton}<button type="button" className="quiet-button" aria-label="كل النماذج" onClick={() => setPickerOpen(true)}><GridFourIcon size={18} aria-hidden="true" />كل النماذج</button><button type="button" className="presentation-button" onClick={() => { setFocusInspector(false); setFocusMode(true); }}><ArrowsOutSimpleIcon size={18} aria-hidden="true" />وضع العرض</button></div>
    </header>
    <nav className="molecule-nav" aria-label="اختر جزيئًا">
      <span className="nav-label">{categories.find(item => item.id === category)?.label}<small>{categoryMolecules.length} نماذج</small></span>
      <div className="molecule-scroll" ref={stripRef}>{categoryMolecules.map(item => <button key={item.id} type="button" aria-current={selectedId === item.id ? "true" : undefined} onClick={() => selectMolecule(item.id)}>{item.name}</button>)}</div>
    </nav>

    <div className="hero-layout">
      <section className="model-column" aria-label={"نموذج " + sceneName}>
        <div className="main-scene">
          <MolstarStage theme={theme} source={activeScene?.source ?? molecule.source} format={molecule.format ?? "sdf"} protein={!!molecule.protein} mode={mode} resetSignal={resetSignal} zoomSignal={zoomSignal} focusSignal={focusSignal} captureSignal={captureSignal} onCaptureStatus={setCaptureStatus} label={sceneName} onAtomSelect={handleAtomSelect} selectedElement={selectedElement} selectedAtomIndices={selectedPart?.atomIndices ?? (pickedAtom ? [pickedAtom.atomIndex] : [])} selectionColor={selectedPart?.color ?? atomInfo?.color} showLabels={showLabels} autoRotate={autoRotate} onStatusChange={setStageStatus} />
          <div className="scene-heading">
            <span className="eyebrow">{reactionView ? reactionView.phase === "reactants" ? "مكوّنات منفصلة" : "الجزيء المرتبط والماء" : "عارض الجزيئات ثلاثي الأبعاد"}</span>
            <h1>{sceneName}</h1><p>{reactionView ? "كل المكوّنات ظاهرة في المشهد" : molecule.detail}</p>
            <div className="molecule-meta"><span dir="ltr">{!reactionView && molecule.english}</span>{molecule.formula && !reactionView && <Formula value={molecule.formula} />}</div>
            {reactionView && <button className="scene-exit" type="button" onClick={() => { cancelTransition(); setReactionView(null); clearSelection(); }}>الجزيء وحده<XIcon size={14} aria-hidden="true" /></button>}
          </div>
          <div className="scene-zoom glass-panel" role="group" aria-label="تقريب النموذج">
            <button type="button" aria-label="تقريب" title="تقريب" disabled={!ready} onClick={() => setZoomSignal(value => value + 1)}><PlusIcon size={19} aria-hidden="true" /></button>
            <button type="button" aria-label="إبعاد" title="إبعاد" disabled={!ready} onClick={() => setZoomSignal(value => value - 1)}><MinusIcon size={19} aria-hidden="true" /></button>
            <button type="button" aria-label="إعادة التمركز" title="إعادة التمركز" disabled={!ready} onClick={() => setResetSignal(value => value + 1)}><TargetIcon size={19} aria-hidden="true" /></button>
          </div>
          {focusMode && <div className="focus-chrome">
            {themeButton}
            <div className="focus-navigation glass-panel"><button type="button" aria-label="النموذج السابق" onClick={() => navigate(-1)}><ArrowRightIcon size={19} aria-hidden="true" /></button><button type="button" className="focus-model-picker" onClick={() => setPickerOpen(true)}><GridFourIcon size={17} aria-hidden="true" /><span>{modelIndex + 1} / {molecules.length}</span></button><button type="button" aria-label="النموذج التالي" onClick={() => navigate(1)}><ArrowLeftIcon size={19} aria-hidden="true" /></button></div>
            <button type="button" className="quiet-button glass-panel" aria-label="الأجزاء" aria-pressed={focusInspector} onClick={() => setFocusInspector(value => !value)}><AtomIcon size={18} aria-hidden="true" />الأجزاء</button>
            <button type="button" className="quiet-button glass-panel" aria-label="إنهاء العرض" onClick={() => setFocusMode(false)}><ArrowsInSimpleIcon size={18} aria-hidden="true" />إنهاء العرض</button>
          </div>}
          {focusMode && !focusInspector && hasSelection && <div className="focus-caption glass-panel" aria-live="polite"><button className="caption-close" type="button" aria-label="مسح التحديد" onClick={clearSelection}><XIcon size={17} aria-hidden="true" /></button>{selectionContent}</div>}
          {focusMode && !focusInspector && reactionControls && <div className="focus-reaction glass-panel">{reactionControls}</div>}
          {transition && <div className="reaction-toast glass-panel" role="status"><ArrowClockwiseIcon size={18} aria-hidden="true" /><span>{transition.type === "dehydration" ? "نزع الماء" : "إضافة الماء"}</span><span dir="ltr">{transition.water}</span></div>}
          <div className="canvas-tools glass-panel" aria-label="أدوات العرض">
            <div className="mode-switch" role="group" aria-label="شكل النموذج">{modes.filter(item => item.id !== "cartoon" || molecule.protein).map(item => <button key={item.id} type="button" disabled={!ready} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><item.icon size={18} aria-hidden="true" /><span>{item.label}</span></button>)}</div>
            <div className="tool-actions">
              <button type="button" disabled={!ready} aria-label={molecule.protein ? "اسم النموذج" : "أسماء الذرات"} aria-pressed={showLabels} onClick={() => setShowLabels(value => !value)}><TextTIcon size={18} aria-hidden="true" /><span>{molecule.protein ? "اسم النموذج" : "أسماء الذرات"}</span></button>
              <button type="button" disabled={!ready} aria-label="دوران تلقائي" aria-pressed={autoRotate} onClick={() => setAutoRotate(value => !value)}>{autoRotate ? <PauseIcon size={18} aria-hidden="true" /> : <PlayIcon size={18} aria-hidden="true" />}<span>دوران</span></button>
              <button type="button" disabled={!ready || captureStatus === "saving"} aria-label="حفظ صورة للمجسم" title="حفظ صورة PNG" onClick={() => setCaptureSignal(value => value + 1)}><CameraIcon size={19} aria-hidden="true" /><span className="capture-text">{captureStatus === "saving" ? "حفظ…" : "صورة"}</span></button>
            </div>
          </div>
          <div className="scene-hint">اسحب للتدوير · مرّر للتقريب · اضغط للتحديد</div>
          {captureStatus === "error" && <span className="capture-error" role="alert">تعذّر حفظ الصورة، جرّب مرة أخرى.</span>}
        </div>
      </section>

      <aside className="info-panel glass-panel" aria-label="تفاصيل النموذج">
        <div className="panel-head"><div><span className="eyebrow">من داخل المجسم</span><h2>{reactionView?.phase === "reactants" ? "المكوّنات" : "استكشف الأجزاء"}</h2></div><span className="parts-count">{parts?.length ?? 0}</span></div>
        <div className={"selection-card " + (hasSelection ? "has-selection" : "")} aria-live="polite">
          {hasSelection ? <><div className="selection-head"><span>التحديد الحالي</span><button type="button" onClick={clearSelection} aria-label="مسح التحديد"><XIcon size={17} aria-hidden="true" /></button></div>{selectionContent}<button type="button" className="focus-selection" disabled={!ready} onClick={() => { setAutoRotate(false); setFocusSignal(value => value + 1); }}><TargetIcon size={17} aria-hidden="true" />قرّب التحديد</button></> : <div className="selection-empty"><AtomIcon size={25} aria-hidden="true" /><p>اختَر جزءًا من القائمة<br /><span>أو اضغط عليه في المجسم</span></p></div>}
        </div>
        {parts?.length ? <div className="parts-list">{parts.map((part, index) => <button type="button" key={part.id} className="part-button" aria-pressed={selectedPartId === part.id} disabled={!ready} onClick={() => selectPart(part.id)}><span className="part-number" dir="ltr">{String(index + 1).padStart(2, "0")}</span><span className="part-swatch" style={{ background: part.color }} /><strong>{part.label}</strong><ArrowLeftIcon className="part-arrow" size={16} aria-hidden="true" /></button>)}</div> : <p className="empty-parts">اختَر عنصرًا لتحديد ذراته في المجسم.</p>}
        <div className="element-legend"><span>حدّد عنصرًا</span><div>{visibleElements.map(item => <button type="button" key={item} disabled={!ready} aria-pressed={selectedElement === item} onClick={() => { clearSelection(); setSelectedElement(selectedElement === item ? null : item); setAutoRotate(false); }}><i style={{ background: elements[item].color }} /><b dir="ltr">{item}</b><span>{elements[item].name}</span></button>)}</div></div>
        {molecule.example && !reactionView && <p className="example-note">{molecule.example}</p>}
        {reactionControls}
      </aside>
    </div>
    <footer className="viewer-footer"><span className="footer-navigation"><button type="button" aria-label="النموذج السابق" onClick={() => navigate(-1)}><ArrowRightIcon size={17} aria-hidden="true" /></button><span>{reactionView ? "مشهد تفاعل" : "النموذج " + (modelIndex + 1) + " من " + molecules.length}</span><button type="button" aria-label="النموذج التالي" onClick={() => navigate(1)}><ArrowLeftIcon size={17} aria-hidden="true" /></button></span><span>كل النماذج <kbd>Ctrl K</kbd> · مسح التحديد <kbd>Esc</kbd></span></footer>
    <ModelPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={selectMolecule} selectedId={selectedId} />
  </main>;
}
