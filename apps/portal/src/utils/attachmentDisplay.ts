/**
 * 将附件/图片字段（antd Upload fileList、单对象、URL 字符串、JSON 字符串）统一解析为可预览的 URL 列表。
 */
export function extractAttachmentPreviewUrls(value: unknown): string[] {
  if (value == null || value === "") return [];

  const fromObject = (o: Record<string, unknown>): string | null => {
    const direct = o.url ?? o.thumbUrl ?? o.path;
    if (typeof direct === "string" && direct.trim()) return direct.trim();

    const resp = o.response;
    if (resp != null && typeof resp === "object") {
      const r = resp as Record<string, unknown>;
      const ru = r.url ?? r.path ?? r.data;
      if (typeof ru === "string" && ru.trim()) return ru.trim();
      if (ru != null && typeof ru === "object") {
        const inner = (ru as Record<string, unknown>).url;
        if (typeof inner === "string" && inner.trim()) return inner.trim();
      }
    }
    return null;
  };

  let v: unknown = value;

  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "[object Object]") return [];
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        v = JSON.parse(t);
      } catch {
        if (/^https?:\/\//i.test(t) || t.startsWith("/") || t.startsWith("data:")) {
          return [t];
        }
        return [];
      }
    } else if (/^https?:\/\//i.test(t) || t.startsWith("/") || t.startsWith("data:")) {
      return [t];
    } else {
      return [];
    }
  }

  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      if (item == null) continue;
      if (typeof item === "string") {
        const s = item.trim();
        if (s && s !== "[object Object]") out.push(s);
      } else if (typeof item === "object") {
        const u = fromObject(item as Record<string, unknown>);
        if (u) out.push(u);
      }
    }
    return out;
  }

  if (typeof v === "object") {
    const u = fromObject(v as Record<string, unknown>);
    return u ? [u] : [];
  }

  return [];
}
