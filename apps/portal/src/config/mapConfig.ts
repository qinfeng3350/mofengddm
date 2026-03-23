// 地图配置
// 高德地图API Key配置
// 获取方式：https://console.amap.com/dev/key/app
export const AMAP_CONFIG = {
  // 从环境变量获取API Key
  // 在 .env 文件中配置：VITE_AMAP_KEY=your_api_key_here
  apiKey: import.meta.env.VITE_AMAP_KEY || "",
  
  // 高德地图JS API URL
  jsApiUrl: "https://webapi.amap.com/maps",
  
  // 逆地理编码API URL
  geocodeApiUrl: "https://restapi.amap.com/v3/geocode/regeo",
  
  // 地图默认中心点（北京）
  defaultCenter: [116.397428, 39.90923] as [number, number],
  
  // 默认缩放级别
  defaultZoom: 13,
};

// 检查API Key是否配置
export const isAMAPConfigured = () => {
  return AMAP_CONFIG.apiKey && AMAP_CONFIG.apiKey !== "";
};

// 从 localStorage 获取高德地图 API Key（优先级：localStorage > 环境变量）
export const getAMapKey = (): string => {
  try {
    const savedKeys = localStorage.getItem("amap_keys");
    if (savedKeys) {
      const keys = JSON.parse(savedKeys);
      if (keys && keys.length > 0 && keys[0].key) {
        return keys[0].key;
      }
    }
  } catch (error) {
    console.error("读取 API Key 失败:", error);
  }
  
  // 回退到环境变量
  const envKey = import.meta.env.VITE_AMAP_KEY;
  if (envKey && envKey !== "YOUR_AMAP_API_KEY" && envKey.trim() !== "") {
    return envKey;
  }
  
  return "";
};

