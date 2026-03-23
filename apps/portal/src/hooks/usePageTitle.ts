import { useEffect } from 'react';

/**
 * 设置页面标题的 Hook
 * @param title 页面标题
 */
export const usePageTitle = (title: string) => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title;
    
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
};

