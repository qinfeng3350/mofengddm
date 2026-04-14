import { QueryClient } from "@tanstack/react-query";

/** 与 main.tsx 中 Provider 共用，便于在非 React 模块（如 zustand store）里失效缓存 */
export const queryClient = new QueryClient();
