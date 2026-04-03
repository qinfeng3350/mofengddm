import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "antd";
import { DeleteOutlined, RollbackOutlined } from "@ant-design/icons";
import styles from "./SignaturePad.module.css";

export type SignaturePadProps = {
  value?: string; // dataURL
  onChange: (next?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  height?: number;
};

function isProbablyDataUrl(v: unknown): v is string {
  return typeof v === "string" && /^data:image\/.+;base64,/.test(v);
}

export const SignaturePad = ({
  value,
  onChange,
  disabled = false,
  placeholder = "手写签名添加签名",
  height = 150,
}: SignaturePadProps) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dpr = useMemo(() => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1), []);

  const [cssSize, setCssSize] = useState({ w: 600, h: height });
  const [hasInk, setHasInk] = useState<boolean>(() => !!value);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef(false);

  const getCtx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  };

  const resizeCanvas = () => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const w = Math.max(100, wrap.clientWidth);
    const h = height;
    setCssSize({ w, h });

    const ctx = getCtx();
    if (!ctx) return;

    const nextW = Math.floor(w * dpr);
    const nextH = Math.floor(h * dpr);
    canvas.width = nextW;
    canvas.height = nextH;

    // 让绘制坐标使用 CSS 像素单位
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2.6;
  };

  const redrawValue = async () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, cssSize.w, cssSize.h);
    historyRef.current = [];

    if (!isProbablyDataUrl(value)) {
      setHasInk(false);
      return;
    }

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssSize.w, cssSize.h);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = value;
    });
    setHasInk(true);
  };

  useEffect(() => {
    resizeCanvas();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useMemo dpr
  }, [height]);

  useEffect(() => {
    // 外部 value 变更时，重绘到画布上
    redrawValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cssSize.w, cssSize.h]);

  const clearCanvas = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, cssSize.w, cssSize.h);
    historyRef.current = [];
    setHasInk(false);
    onChange(undefined);
  };

  const snapshot = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    // putImageData/getImageData 使用的是 canvas 像素坐标体系；在存在 transform 时先切回 identity
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.restore();
    historyRef.current.push(img);
  };

  const restoreSnapshot = (img: ImageData) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
    ctx.restore();
  };

  const undo = () => {
    if (disabled) return;
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h.pop();
    if (!prev) return;
    restoreSnapshot(prev);
    // 是否仍有内容：简单以是否存在 value 判断；绘制后如需更精确可再做像素检查
    setHasInk(true);
    const next = canvasRef.current?.toDataURL("image/png");
    onChange(next);
  };

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    drawingRef.current = true;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    snapshot();

    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };

  const endDraw = () => {
    if (disabled) return;
    drawingRef.current = false;
    const next = canvasRef.current?.toDataURL("image/png");
    if (next) onChange(next);
  };

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <div className={styles.toolbar}>
        <Button
          type="text"
          size="small"
          icon={<RollbackOutlined />}
          disabled={disabled}
          onClick={undo}
        />
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          disabled={disabled}
          onClick={clearCanvas}
        />
      </div>

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ height }}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        onPointerLeave={endDraw}
      />

      {!hasInk && (
        <div className={styles.placeholder}>
          {placeholder}
        </div>
      )}

      {disabled && <div className={styles.disabledOverlay} />}
    </div>
  );
};

