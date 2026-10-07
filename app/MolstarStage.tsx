"use client";

import { useEffect, useRef, useState } from "react";
import { fitModelCamera } from "./modelCamera.mjs";
import { publicAsset } from "./publicAsset";

type PickedUnit = { elements: ArrayLike<number>; model: { atomicHierarchy: { atoms: { type_symbol: { value: (index: number) => string } } } } };
type PickedLoci = {
  kind?: string;
  elements?: Array<{
    indices: number | ArrayLike<number>;
    unit: PickedUnit;
  }>;
  bonds?: Array<{ aUnit: PickedUnit; aIndex: number; bUnit: PickedUnit; bIndex: number }>;
};

export type PickedAtom = { element: string; atomIndex: number };
type ModelUnit = PickedUnit & { conformation: { position: (index:number, output:number[]) => number[] } };
type ModelStructure = { units: ModelUnit[] };
type ModelComponent = { key?:string; cell: { obj?: { data:ModelStructure } } };

function firstPickedAtom(loci: PickedLoci | undefined): PickedAtom | null {
  if (loci?.kind === "bond-loci" && loci.bonds?.length) {
    const bond = loci.bonds[0];
    const atom = bond.aUnit.elements[bond.aIndex];
    return atom === undefined ? null : {
      element: bond.aUnit.model.atomicHierarchy.atoms.type_symbol.value(atom), atomIndex: atom,
    };
  }
  if (loci?.kind !== "element-loci" || !loci.elements?.length) return null;
  const { indices, unit } = loci.elements[0];
  // Mol* stores a consecutive index range as two int32 values packed in a float64.
  const index = typeof indices === "number"
    ? new Int32Array(new Float64Array([indices]).buffer)[0]
    : indices[0];
  const atom = unit.elements[index];
  return atom === undefined ? null : {
    element: unit.model.atomicHierarchy.atoms.type_symbol.value(atom),
    atomIndex: atom,
  };
}

type MolstarViewer = {
  plugin: {
    representation: { structure: { registry: { get: (name:string) => { name:string } } } };
    builders: { structure: { representation: {
      addRepresentation: (cell: unknown, props: Record<string, unknown>) => Promise<unknown>;
    } } };
    helpers?: { viewportScreenshot?: { download: (filename?:string) => Promise<void>; behaviors: { values: { value: Record<string,unknown>; next: (value:Record<string,unknown>) => void } } } };
    clear: () => Promise<void>;
    behaviors: { interaction: { click: { subscribe: (callback: (event: { current?: { loci?: PickedLoci } }) => void) => { unsubscribe: () => void } } } };
    managers: {
      interactivity: {
        lociSelects: {
          deselectAll: () => void;
          selectOnly: (current: { loci: {
            kind: "element-loci";
            structure: unknown;
            elements: Array<{ unit: unknown; indices: Int32Array }>;
          } }, applyGranularity: boolean) => void;
        };
      };
      structure: {
        hierarchy: { current: { structures: Array<{
          components: ModelComponent[];
          cell: { obj?: { data: ModelStructure } };
        }> } };
        component: {
          removeRepresentations: (components: Array<{ key?: string }>) => Promise<void>;
          addRepresentation: (components: Array<{ key?: string }>, type: string) => Promise<void>;
          updateRepresentationsTheme: (components: Array<{ key?: string }>, params: Record<string, unknown>) => Promise<void>;
        };
      };
    };
    canvas3d?: {
      camera: {
        state: { position:ArrayLike<number>; target:ArrayLike<number>; radius:number; fov:number };
        setState: (snapshot:Record<string,unknown>, durationMs?:number) => void;
      };
      commit: (isSynchronous?: boolean) => void;
      requestCameraReset: (options?: {
        durationMs?:number;
        snapshot?: (scene: { boundingSphereVisible: { center: ArrayLike<number>; radius: number } }, camera: {
          viewport: { width:number; height:number };
          state: { fov:number };
          getFocus: (center: ArrayLike<number>, radius: number) => {
            target: ArrayLike<number>; position: ArrayLike<number>; radius: number;
          };
        }) => Record<string, unknown>;
      }) => void;
      setProps: (props: Record<string, unknown>) => void;
    };
  };
  loadStructureFromUrl: (
    url: string,
    format: string,
    binary: boolean,
    options?: Record<string, unknown>,
  ) => Promise<void>;
  handleResize: () => void;
  dispose: () => void;
};

declare global {
  interface Window {
    molstar?: {
      Viewer: {
        create: (target: string | HTMLElement, options: Record<string, unknown>) => Promise<MolstarViewer>;
      };
    };
  }
}

export type RenderMode = "ball-and-stick" | "spacefill" | "molecular-surface" | "cartoon";
export type StageStatus = "boot" | "loading" | "ready" | "error";

let molstarScript: Promise<void> | null = null;

function loadMolstar() {
  if (window.molstar) return Promise.resolve();
  if (molstarScript) return molstarScript;
  molstarScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = publicAsset("/molstar/molstar.js");
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      molstarScript = null;
      script.remove();
      reject(new Error("Mol* failed to load"));
    };
    document.head.appendChild(script);
  });
  return molstarScript;
}

async function setRepresentation(viewer: MolstarViewer, mode: RenderMode, protein: boolean, showLabels: boolean, modelLabel: string) {
  const components = viewer.plugin.managers.structure.hierarchy.current.structures.flatMap((structure) => structure.components);
  if (!components.length) return;

  await viewer.plugin.managers.structure.component.removeRepresentations(components);
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  // The bundle provides custom labels through the explicitly enabled MVS behavior.
  // A missing provider otherwise silently produces an empty representation.
  if (protein && showLabels && viewer.plugin.representation.structure.registry.get("mvs-custom-label").name !== "mvs-custom-label") {
    throw new Error("The Mol* custom label provider is unavailable");
  }
  for (const component of components) {
    const polymer = String(component.key || "").includes("polymer");
    // Show the enzyme itself, without the experimental inhibitor, ions or solvent.
    if (protein && !polymer) continue;
    const type = mode === "cartoon" ? (protein && polymer ? "cartoon" : "ball-and-stick") : mode;
    await viewer.plugin.builders.structure.representation.addRepresentation(component.cell, {
      type,
      typeParams: {
        quality: mobile || protein ? "auto" : "high",
        ignoreHydrogens: false,
        ...(type === "ball-and-stick" ? { sizeFactor: 0.23, sizeAspectRatio: 0.55 } : {}),
        material: { metalness: 0.02, roughness: 0.48, bumpiness: 0 },
      },
      color: protein && polymer ? "chain-id" : "element-symbol",
      colorParams: { carbonColor: { name: "element-symbol", params: {} } },
    });
    // Protein atom IDs such as CA/CB are structural IDs, not element symbols.
    // Custom labels preserve the original IDs needed for the protein cartoon.
    if (showLabels) {
      const items: Array<{text:string; position:{name:string; params:{x:number;y:number;z:number;scale:number}}}> = [];
      if (protein) {
        const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
        for (const unit of component.cell.obj?.data.units ?? []) {
          const point = [0, 0, 0];
          for (let index = 0; index < unit.elements.length; index++) {
            const atom = unit.elements[index];
            unit.conformation.position(atom, point);
            for (let axis = 0; axis < 3; axis++) { minimum[axis] = Math.min(minimum[axis], point[axis]); maximum[axis] = Math.max(maximum[axis], point[axis]); }
          }
        }
        if (Number.isFinite(minimum[0])) {
          // One model-name label keeps large proteins readable in every mode.
          // Individual picked atoms still report their actual element in the inspector.
          items.push({ text:modelLabel, position:{name:"x_y_z", params:{x:(minimum[0]+maximum[0])/2,y:maximum[1]+2,z:(minimum[2]+maximum[2])/2,scale:1.4}} });
        }
      }
      await viewer.plugin.builders.structure.representation.addRepresentation(component.cell, {
        type: protein ? "mvs-custom-label" : "label", color: "uniform", colorParams: { value: 0x203246 },
        typeParams: {
          ...(protein ? { items } : {}),
          level: "element", elementScale: 0.38, sizeFactor: 1,
          borderWidth: 0.18, borderColor: 0xf8fafc,
          background: false, ignoreHydrogens: false,
          attachment: "middle-center", offsetZ: 0.55,
        },
      });
    }
  }
}

function selectedIndices(viewer: MolstarViewer, atomIndices: readonly number[] | undefined, element: string | null | undefined, protein: boolean) {
  const atoms = new Set<number>();
  const requested = new Set(atomIndices ?? []);
  for (const component of viewer.plugin.managers.structure.hierarchy.current.structures.flatMap(item => item.components)) {
    if (protein && !String(component.key || "").includes("polymer")) continue;
    for (const unit of component.cell.obj?.data.units ?? []) {
      for (let i = 0; i < unit.elements.length; i++) {
        const atom = unit.elements[i];
        if (element ? unit.model.atomicHierarchy.atoms.type_symbol.value(atom) === element : requested.has(atom)) atoms.add(atom);
      }
    }
  }
  return atoms;
}

function markSelectedAtoms(viewer: MolstarViewer, atomIndices: readonly number[] | undefined, element?: string | null, protein = false) {
  if (atomIndices === undefined && element === undefined) return;
  const atoms = selectedIndices(viewer, atomIndices, element, protein);
  const selection = viewer.plugin.managers.interactivity.lociSelects;
  if (!atoms.size) {
    selection.deselectAll();
    return;
  }
  const structure = viewer.plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
  if (!structure) return;
  const elements = structure.units.flatMap((unit) => {
    const positions: number[] = [];
    for (let i = 0; i < unit.elements.length; i++) {
      if (atoms.has(unit.elements[i])) positions.push(i);
    }
    return positions.length ? [{ unit, indices: Int32Array.from(positions) }] : [];
  });
  if (elements.length) {
    selection.selectOnly({ loci: { kind: "element-loci", structure, elements } }, false);
  } else {
    selection.deselectAll();
  }
}

function frameModel(viewer: MolstarViewer, protein: boolean, mode:RenderMode, focusAtoms?:Set<number>) {
  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  const components = viewer.plugin.managers.structure.hierarchy.current.structures.flatMap(structure => structure.components);
  for (const component of components) {
    if (protein && !String(component.key || "").includes("polymer")) continue;
    for (const unit of component.cell.obj?.data.units ?? []) {
      const point = [0, 0, 0];
      for (let index = 0; index < unit.elements.length; index++) {
        if (focusAtoms && !focusAtoms.has(unit.elements[index])) continue;
        unit.conformation.position(unit.elements[index], point);
        for (let axis = 0; axis < 3; axis++) {
          minimum[axis] = Math.min(minimum[axis], point[axis]);
          maximum[axis] = Math.max(maximum[axis], point[axis]);
        }
      }
    }
  }
  if (focusAtoms && !Number.isFinite(minimum[0])) return;
  // Representation state commits before the GPU scene; flush its bounds before
  // asking the camera to frame it so a fresh load cannot focus an empty scene.
  viewer.plugin.canvas3d?.commit(true);
  viewer.plugin.canvas3d?.requestCameraReset({
    durationMs: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
    snapshot: (scene, camera) => {
      const { center, radius } = scene.boundingSphereVisible;
      const focus = camera.getFocus(center, radius);
      const fitted = fitModelCamera(minimum, maximum, camera.viewport, camera.state.fov, mode === "spacefill" ? 1.9 : 0.9);
      const snapshot = { ...focus, ...(fitted ?? { up:[0,1,0] }) };
      const offset = [0,1,2].map(axis => snapshot.position[axis] - snapshot.target[axis]);
      const distance = Math.hypot(...offset);
      if (distance > 0 && distance < 8) snapshot.position = offset.map((value, axis) => snapshot.target[axis] + value * 8 / distance);
      // Retain the complete scene depth while the selected region becomes the target.
      if (focusAtoms) snapshot.radius = radius + Math.hypot(...[0,1,2].map(axis => center[axis] - snapshot.target[axis]));
      return snapshot;
    },
  });
}

type StageProps = {
  source: string;
  format: "sdf" | "pdb";
  protein: boolean;
  mode: RenderMode;
  resetSignal: number;
  zoomSignal: number;
  label: string;
  onAtomSelect?: (atom: PickedAtom) => void;
  selectedAtomIndices?: number[];
  selectedElement?: string | null;
  focusSignal?: number;
  captureSignal?: number;
  onCaptureStatus?: (status: "idle" | "saving" | "error") => void;
  selectionColor?: string;
  showLabels?: boolean;
  autoRotate?: boolean;
  onStatusChange?: (status: StageStatus) => void;
};

export default function MolstarStage({ source, format, protein, mode, resetSignal, zoomSignal, label, onAtomSelect, selectedAtomIndices, selectedElement, focusSignal = 0, captureSignal = 0, onCaptureStatus, showLabels = true, autoRotate = false, onStatusChange }: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<MolstarViewer | null>(null);
  const [status, setStatus] = useState<StageStatus>("boot");
  const [retrySignal, setRetrySignal] = useState(0);
  const [viewerGeneration, setViewerGeneration] = useState(0);
  const latestLoad = useRef(0);
  const loadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const clickSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const onAtomSelectRef = useRef(onAtomSelect);
  const selectedAtomIndicesRef = useRef(selectedAtomIndices);
  const selectedElementRef = useRef(selectedElement);
  const previousFocusSignalRef = useRef(focusSignal);
  const previousCaptureSignalRef = useRef(captureSignal);
  const captureBusyRef = useRef(false);
  const appliedModeRef = useRef<RenderMode | null>(null);
  const desiredModeRef = useRef(mode);
  const desiredLabelsRef = useRef(showLabels);
  const appliedLabelsRef = useRef<boolean | null>(null);
  const previousResetSignalRef = useRef(resetSignal);
  const previousZoomSignalRef = useRef(zoomSignal);
  const desiredSourceRef = useRef(source);
  const loadedSourceRef = useRef<string | null>(null);

  useEffect(() => { desiredSourceRef.current = source; }, [source]);

  useEffect(() => {
    onAtomSelectRef.current = onAtomSelect;
  }, [onAtomSelect]);

  useEffect(() => {
    desiredModeRef.current = mode;
    desiredLabelsRef.current = showLabels;
  }, [mode, showLabels]);

  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => viewerRef.current?.plugin.canvas3d?.setProps({
      trackball: { animate: autoRotate && !preference.matches && status === "ready"
        ? { name: "spin", params: { speed: 0.035, axis: [0, 1, 0] } }
        : { name: "off", params: {} } },
    });
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [autoRotate, status]);

  useEffect(() => {
    selectedAtomIndicesRef.current = selectedAtomIndices;
    selectedElementRef.current = selectedElement;
    if (status === "ready" && viewerRef.current) {
      const color = 0x55748a;
      viewerRef.current.plugin.canvas3d?.setProps({
        renderer: { selectColor: color },
        marking: { selectEdgeColor: color },
      });
      markSelectedAtoms(viewerRef.current, selectedAtomIndices, selectedElement, protein);
    }
  }, [selectedAtomIndices, selectedElement, status, protein]);

  useEffect(() => {
    let disposed = false;
    async function start() {
      try {
        await loadMolstar();
        if (disposed || !hostRef.current || !window.molstar) return;
        const viewer = await window.molstar.Viewer.create(hostRef.current, {
          extensions: ["mvs"],
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          collapseLeftPanel: true,
          collapseRightPanel: true,
          viewportShowControls: false,
          viewportShowExpand: false,
          viewportShowToggleFullscreen: false,
          viewportShowSettings: false,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          viewportBackgroundColor: "#f8fafc",
          illumination: false,
          resolutionMode: "auto",
          transparency: "blended",
          powerPreference: "high-performance",
        });
        if (disposed) { viewer.dispose(); return; }
        viewerRef.current = viewer;
        const clickSubscription = viewer.plugin.behaviors.interaction.click.subscribe((event) => {
          if (loadedSourceRef.current !== desiredSourceRef.current) return;
          const atom = firstPickedAtom(event.current?.loci);
          if (atom) onAtomSelectRef.current?.(atom);
        });
        clickSubscriptionRef.current = clickSubscription;
        viewer.plugin.canvas3d?.setProps({
          renderer: { backgroundColor: 0xf8fafc, selectColor: 0x55748a, highlightColor: 0x8598aa, selectStrength: 0.32, ambientIntensity: 0.48,
            light: [{ inclination:150, azimuth:320, color:0xffffff, intensity:0.7 }, { inclination:65, azimuth:110, color:0xe8eef5, intensity:0.25 }] },
          postprocessing: {
            occlusion: window.matchMedia("(max-width: 700px)").matches ? { name:"off", params:{} } : { name:"on", params:{ samples:16, radius:2.6, bias:0.95, color:0x445468, blurKernelSize:9, resolutionScale:0.5, multiScale:{name:"off",params:{}} } },
            shadow: { name:"off", params:{} }, dof: { name:"off", params:{} },
          },
          marking: { selectEdgeColor: 0x55748a, highlightEdgeColor: 0x8598aa },
          camera: { mode: "perspective", manualReset:true, helper: { axes: { name: "off", params: {} } } },
          // Mol* normally checks just 3 px around a tap. The wider target makes
          // small atoms and thin bonds usable without changing their appearance.
          pickPadding: 10,
          trackball: { minDistance:8, autoAdjustMinMaxDistance:{name:"on",params:{minDistanceFactor:0,minDistancePadding:8,maxDistanceFactor:20,maxDistanceMin:30}} },
        });
        setStatus("loading");
        loadedSourceRef.current = null;
        setViewerGeneration(value => value + 1);
      } catch (error) {
        console.error("Mol* initialization failed", error);
        if (!disposed) setStatus("error");
      }
    }
    start();
    return () => {
      disposed = true;
      clickSubscriptionRef.current?.unsubscribe();
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [retrySignal]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status === "boot") return;
    const currentViewer = viewer;
    const loadId = ++latestLoad.current;
    async function load() {
      try {
        if (loadId !== latestLoad.current || viewerRef.current !== currentViewer) return;
        setStatus("loading");
        appliedModeRef.current = null;
        appliedLabelsRef.current = null;
        await currentViewer.plugin.clear();
        if (loadId !== latestLoad.current || viewerRef.current !== currentViewer) return;
        await currentViewer.loadStructureFromUrl(publicAsset(source), format, false, {
          label,
          representationParams: {
            quality: "auto",
            ignoreHydrogens: false,
            theme: { globalName: protein ? "chain-id" : "element-symbol" },
          },
        });
        if (loadId !== latestLoad.current || viewerRef.current !== currentViewer) return;
        const currentMode = desiredModeRef.current;
        const currentLabels = desiredLabelsRef.current;
        await setRepresentation(currentViewer, currentMode, protein, currentLabels, label);
        if (loadId !== latestLoad.current || viewerRef.current !== currentViewer) return;
        appliedModeRef.current = currentMode;
        appliedLabelsRef.current = currentLabels;
        frameModel(currentViewer, protein, currentMode);
        markSelectedAtoms(currentViewer, selectedAtomIndicesRef.current, selectedElementRef.current, protein);
        loadedSourceRef.current = source;
        setStatus("ready");
      } catch (error) {
        console.error("Mol* model load failed", error);
        if (loadId === latestLoad.current) setStatus("error");
      }
    }
    // Mol* uses one mutable plugin scene. Run clear/load/representation in order
    // so an older request cannot overwrite a newer molecule after rapid taps.
    loadQueueRef.current = loadQueueRef.current.then(load, load);
  // Loading is deliberately keyed to the molecule, not the display mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, format, protein, label, viewerGeneration]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status !== "ready" || (appliedModeRef.current === mode && appliedLabelsRef.current === showLabels)) return;
    const loadId = latestLoad.current;
    async function changeMode() {
      try {
        // A toggle can return to its original value while an earlier update is
        // still running. Reconcile against the latest requested state afterwards.
        while (viewerRef.current === viewer && loadId === latestLoad.current) {
          const targetMode = desiredModeRef.current;
          const targetLabels = desiredLabelsRef.current;
          if (appliedModeRef.current === targetMode && appliedLabelsRef.current === targetLabels) return;
          await setRepresentation(viewer!, targetMode, protein, targetLabels, label);
          if (viewerRef.current !== viewer || loadId !== latestLoad.current) return;
          appliedModeRef.current = targetMode;
          appliedLabelsRef.current = targetLabels;
          markSelectedAtoms(viewer!, selectedAtomIndicesRef.current, selectedElementRef.current, protein);
        }
      } catch (error) {
        console.error("Mol* display mode failed", error);
        if (loadId === latestLoad.current) setStatus("error");
      }
    }
    loadQueueRef.current = loadQueueRef.current.then(changeMode, changeMode);
  }, [mode, showLabels, protein, status, label]);

  useEffect(() => {
    // A new model becoming ready already centers itself in load(). A selected
    // atom only changes the information panel and must not move the camera.
    if (resetSignal !== previousResetSignalRef.current) {
      previousResetSignalRef.current = resetSignal;
      if (status === "ready" && viewerRef.current) frameModel(viewerRef.current, protein, mode);
    }
  }, [resetSignal, status, protein, mode]);

  useEffect(() => {
    const delta = zoomSignal - previousZoomSignalRef.current;
    previousZoomSignalRef.current = zoomSignal;
    const camera = viewerRef.current?.plugin.canvas3d?.camera;
    if (!delta || status !== "ready" || !camera) return;
    const { position, target, radius } = camera.state;
    const offset = [0,1,2].map(axis => position[axis] - target[axis]);
    const distance = Math.hypot(...offset);
    if (!distance) return;
    const nextDistance = Math.min(Math.max(distance * Math.pow(0.82, delta), 8), Math.max(radius * 20, 30));
    camera.setState({ position:offset.map((value, axis) => target[axis] + value * nextDistance / distance) }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 140);
  }, [zoomSignal, status]);

  useEffect(() => {
    if (focusSignal === previousFocusSignalRef.current) return;
    previousFocusSignalRef.current = focusSignal;
    const viewer = viewerRef.current;
    if (!viewer || status !== "ready" || loadedSourceRef.current !== source) return;
    const atoms = selectedIndices(viewer, selectedAtomIndicesRef.current, selectedElementRef.current, protein);
    if (atoms.size) frameModel(viewer, protein, mode, atoms);
  }, [focusSignal, status, source, protein, mode]);

  useEffect(() => {
    if (captureSignal === previousCaptureSignalRef.current) return;
    previousCaptureSignalRef.current = captureSignal;
    const viewer = viewerRef.current;
    const capture = viewer?.plugin.helpers?.viewportScreenshot;
    if (!viewer || !capture || status !== "ready" || captureBusyRef.current || loadedSourceRef.current !== source) {
      onCaptureStatus?.("error");
      return;
    }
    captureBusyRef.current = true;
    onCaptureStatus?.("saving");
    const loadId = latestLoad.current;
    const save = async () => {
      try {
        if (viewerRef.current !== viewer || loadId !== latestLoad.current) throw new Error("Model changed before capture");
        capture.behaviors.values.next({ ...capture.behaviors.values.value, format:{name:"png",params:{}}, transparent:false });
        const filename = (label.normalize("NFKC").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0,80) || "molecule") + ".png";
        await capture.download(filename);
        onCaptureStatus?.("idle");
      } catch (error) {
        console.error("Mol* screenshot failed", error);
        onCaptureStatus?.("error");
      } finally { captureBusyRef.current = false; }
    };
    loadQueueRef.current = loadQueueRef.current.then(save, save);
  }, [captureSignal, status, source, label, onCaptureStatus]);

  useEffect(() => {
    const resize = () => viewerRef.current?.handleResize();
    const observer = new ResizeObserver(resize);
    if (hostRef.current) observer.observe(hostRef.current);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div className="stage-root" aria-label={`نموذج ثلاثي الأبعاد: ${label}`}>
      <div className="molstar-host" ref={hostRef} />
      {(status === "boot" || status === "loading") && <div className="stage-loading" role="status"><span /> تجهيز {label}…</div>}
      {status === "error" && <div className="stage-error" role="alert"><span>تعذّر عرض النموذج.</span><button onClick={() => { setStatus("boot"); setRetrySignal(value => value + 1); }}>إعادة المحاولة</button></div>}
    </div>
  );
}
