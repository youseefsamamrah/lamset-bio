"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { categories, molecules } from "./moleculeCatalog";

type ModelPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  selectedId: string;
};

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\u064b-\u065f]/g, "")
    .replace(/[أإآ]/g, "ا")
    .trim();
}

export default function ModelPicker({ open, onClose, onSelect, selectedId }: ModelPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const term = normalize(query);
  const results = term
    ? molecules.filter(item => normalize(item.name).includes(term) || normalize(item.english).includes(term))
    : molecules;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    formRef.current?.reset();
    searchRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, [open]);

  function choose(id: string) {
    onSelect(id);
    onClose();
  }

  // The dialog backdrop receives pointer clicks; Escape and the close button
  // provide equivalent keyboard paths.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
  return <dialog
    ref={dialogRef}
    className="model-picker"
    aria-labelledby="picker-title"
    aria-modal="true"
    dir="rtl"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <div className="picker-head">
      <div><span className="picker-kicker">مكتبة النماذج</span><h2 className="picker-title" id="picker-title">اختر جزيئًا</h2></div>
      <button type="button" className="picker-close" onClick={onClose} aria-label="إغلاق اختيار الجزيء"><XIcon size={20} weight="regular" aria-hidden="true" /></button>
    </div>
    <form ref={formRef} className="picker-search" role="search" onSubmit={event => event.preventDefault()} onReset={() => setQuery("")}>
      <MagnifyingGlassIcon size={19} weight="regular" aria-hidden="true" />
      <input ref={searchRef} type="search" autoComplete="off" spellCheck={false} placeholder="ابحث بالعربية أو الإنجليزية" aria-label="ابحث عن جزيء" onInput={event => setQuery(event.currentTarget.value)} />
    </form>
    <span className="sr-only" role="status">{results.length} نتائج</span>
    <div className="picker-results">
      {results.length ? categories.map(category => {
        const group = results.filter(item => item.category === category.id);
        if (!group.length) return null;
        return <section className="picker-group" key={category.id} aria-label={category.label}>
          <h3>{category.label}<span>{group.length}</span></h3>
          <div className="picker-grid">{group.map(item =>
            <button key={item.id} type="button" className="picker-option" aria-pressed={item.id === selectedId} aria-current={item.id === selectedId ? "true" : undefined} onClick={() => choose(item.id)}>
              <span><strong>{item.name}</strong><small dir="ltr">{item.english}</small></span>
              {item.id === selectedId && <CheckIcon size={18} weight="bold" aria-hidden="true" />}
            </button>,
          )}</div>
        </section>;
      }) : <p className="picker-empty">لا توجد نماذج بهذا الاسم.</p>}
    </div>
    <div className="picker-foot"><span>{results.length} من {molecules.length} نموذج</span><span>Esc للإغلاق</span></div>
  </dialog>;
}
