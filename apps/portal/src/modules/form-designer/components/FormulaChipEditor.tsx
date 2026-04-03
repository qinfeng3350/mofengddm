import { useLayoutEffect, useRef, useImperativeHandle, forwardRef } from "react";
import styles from "./FormulaChipEditor.module.css";

export type FormulaChipEditorHandle = {
  insertText: (text: string) => void;
  insertVariable: (ref: string, label: string) => void;
  getExpression: () => string;
};

function fillSurface(
  el: HTMLDivElement,
  expression: string,
  getLabel: (ref: string) => string
) {
  el.innerHTML = "";
  const re = /\{([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expression))) {
    if (m.index > last) {
      el.appendChild(document.createTextNode(expression.slice(last, m.index)));
    }
    const span = document.createElement("span");
    span.contentEditable = "false";
    const ref = m[1].trim();
    span.dataset.ref = ref;
    span.className = styles.chip;
    span.textContent = getLabel(ref);
    el.appendChild(span);
    last = m.index + m[0].length;
  }
  if (last < expression.length) {
    el.appendChild(document.createTextNode(expression.slice(last)));
  }
}

export function readExpressionFromSurface(el: HTMLElement): string {
  let s = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      s += n.textContent || "";
      return;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as HTMLElement;
      const ref = e.dataset.ref;
      if (ref) s += `{${ref}}`;
      else s += e.textContent || "";
    }
  });
  return s;
}

function insertNodeAtSelection(el: HTMLElement, node: Node, collapseAfter: boolean) {
  const sel = window.getSelection();
  if (!sel) {
    el.appendChild(node);
    return;
  }
  let range: Range | null = null;
  if (sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (el.contains(r.commonAncestorContainer)) range = r;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);
  if (collapseAfter) {
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export const FormulaChipEditor = forwardRef<
  FormulaChipEditorHandle,
  {
    initialExpression: string;
    getLabel: (ref: string) => string;
  }
>(function FormulaChipEditor({ initialExpression, getLabel }, ref) {
  const divRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    fillSurface(el, initialExpression, getLabel);
  }, [initialExpression, getLabel]);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const el = divRef.current;
      if (!el) return;
      el.focus();
      const node = document.createTextNode(text);
      insertNodeAtSelection(el, node, true);
    },
    insertVariable(refId: string, label: string) {
      const el = divRef.current;
      if (!el) return;
      el.focus();
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.dataset.ref = refId;
      span.className = styles.chip;
      span.textContent = label;
      insertNodeAtSelection(el, span, true);
    },
    getExpression: () => {
      const el = divRef.current;
      if (!el) return "";
      return readExpressionFromSurface(el);
    },
  }));

  return (
    <div
      ref={divRef}
      className={styles.surface}
      contentEditable
      suppressContentEditableWarning
      onKeyDown={(e) => {
        if (e.key !== "Backspace" || !divRef.current) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        if (!r.collapsed) return;
        let n = r.startContainer;
        let off = r.startOffset;
        if (n.nodeType === Node.TEXT_NODE && off > 0) return;
        if (n.nodeType === Node.TEXT_NODE && off === 0) {
          const prev = n.previousSibling;
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const elp = prev as HTMLElement;
            if (elp.dataset.ref) {
              e.preventDefault();
              elp.remove();
            }
          }
        }
        if (n === divRef.current && off > 0) {
          const child = divRef.current.childNodes[off - 1];
          if (child?.nodeType === Node.ELEMENT_NODE) {
            const elp = child as HTMLElement;
            if (elp.dataset.ref) {
              e.preventDefault();
              elp.remove();
            }
          }
        }
      }}
    />
  );
});
