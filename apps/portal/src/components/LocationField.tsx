import React, { useState, useEffect } from "react";
import { Input, Button, message, Space } from "antd";
import { AimOutlined } from "@ant-design/icons";
import { MapLocationPicker } from "./MapLocationPicker";
import { getAMapKey } from "@/config/mapConfig";

interface LocationFieldProps {
  value?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  onChange?: (value: { latitude?: number; longitude?: number; address?: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

// 高德地图逆地理编码API（通过后端代理，避免CORS问题）
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const ensureAMapScriptLoaded = async (apiKey: string): Promise<boolean> => {
    try {
      const w = window as any;
      if (w.AMap) return true;
      if (!apiKey) return false;

      // 如果脚本正在加载，等待其加载完成
      if (document.querySelector(`script[src*="webapi.amap.com/maps"]`)) {
        // 轮询等待 AMap 挂载
        for (let i = 0; i < 40; i++) {
          if ((window as any).AMap) return true;
          await new Promise((r) => setTimeout(r, 100));
        }
        return (window as any).AMap ? true : false;
      }

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("AMap script load failed"));
        document.head.appendChild(script);
      });

      return !!(window as any).AMap;
    } catch (e) {
      console.error("加载高德 JS API 脚本失败:", e);
      return false;
    }
  };

  const reverseGeocodeByJS = async (lat2: number, lng2: number): Promise<string> => {
    const apiKey = getAMapKey();
    if (!apiKey) return "";
    const ok = await ensureAMapScriptLoaded(apiKey);
    if (!ok) return "";

    try {
      const AMap = (window as any).AMap;
      const geocoder = new AMap.Geocoder();
      const res: any = await new Promise((resolve) => {
        geocoder.getAddress([lng2, lat2], (status: string, result: any) => {
          resolve({ status, result });
        });
      });

      if (res?.status === "complete" && res?.result?.info === "OK") {
        const regeocode = res.result.regeocode || {};
        if (regeocode.formattedAddress) return regeocode.formattedAddress;
        if (regeocode.formatted_address) return regeocode.formatted_address;

        const ac = regeocode.addressComponent || {};
        const parts = [
          ac.province,
          ac.city,
          ac.district,
          ac.township,
          ac.neighborhood,
          ac.street,
          ac.streetNumber?.street,
          ac.streetNumber?.number,
        ].filter(Boolean);
        if (parts.length > 0) return parts.join("");
      }
    } catch (e) {
      console.error("高德 JS Geocoder 逆地理编码失败:", e);
    }

    return "";
  };

  const reverseGeocodeByOSM = async (lat2: number, lng2: number): Promise<string> => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat2}&lon=${lng2}&accept-language=zh-CN`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );
      if (!resp.ok) return "";
      const data = await resp.json();
      const display = data?.display_name;
      if (typeof display === "string" && display.trim()) return display;

      const addr = data?.address || {};
      const parts = [
        addr.state || addr.province,
        addr.city || addr.town || addr.county,
        addr.suburb || addr.city_district || addr.district,
        addr.road || addr.pedestrian,
        addr.house_number,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join("");
    } catch (e) {
      console.error("OSM 逆地理编码失败:", e);
    }
    return "";
  };

  try {
    // 方案1：调用后端API（推荐，避免CORS问题）
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const data = await response.json();
      const address =
        data?.address ||
        data?.data?.address ||
        data?.formattedAddress ||
        data?.formatted_address ||
        "";
      if (typeof address === "string" && address.trim()) return address;
    }
  } catch (error) {
    console.error("后端逆地理编码失败:", error);
  }

  try {
    // 方案2：直接调用高德地图API（需要配置API Key，可能有CORS限制）
    const apiKey = getAMapKey();
    if (apiKey) {
      const response = await fetch(
        `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${lng},${lat}&radius=1000&extensions=all`
      );
      const data = await response.json();
      
      if (data.status === "1" && data.regeocode) {
        // 优先使用格式化地址（REST 接口字段名通常是 formatted_address）
        const formatted =
          data.regeocode.formatted_address ||
          data.regeocode.formattedAddress ||
          "";
        if (formatted) return formatted;

        // 否则构建地址（尽量兼容不同字段命名）
        const addressComponent = data.regeocode.addressComponent || {};
        const streetNumber =
          addressComponent.streetNumber ||
          addressComponent.street_number ||
          {};

        const parts = [
          addressComponent.province,
          addressComponent.city,
          addressComponent.district,
          addressComponent.township || addressComponent.town || undefined,
          addressComponent.neighborhood || addressComponent.community || undefined,
          // 高德有时会把街道/门牌拆在 streetNumber 内
          streetNumber.street || addressComponent.street,
          streetNumber.number || addressComponent.streetNumber,
        ].filter(Boolean);

        if (parts.length > 0) return parts.join("");
      }
    }
  } catch (error) {
    console.error("高德地图逆地理编码失败:", error);
  }

  // 方案3：使用高德 JS API（不依赖 REST 字段名，成功率更高）
  try {
    const addr = await reverseGeocodeByJS(lat, lng);
    if (addr && addr.trim()) return addr;
  } catch (e) {
    // ignore
  }

  // 方案4：OSM 逆地理编码（无需 Key，作为公网兜底）
  try {
    const addr = await reverseGeocodeByOSM(lat, lng);
    if (addr && addr.trim()) return addr;
  } catch (e) {
    // ignore
  }

  // 方案5：返回坐标（作为最后备选）
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

export const LocationField: React.FC<LocationFieldProps> = ({
  value,
  onChange,
  placeholder = "获取地理位置",
  disabled = false,
  readOnly = false,
}) => {
  const [mapVisible, setMapVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<string>(value?.address || "");

  // 当value变化时更新显示的地址
  useEffect(() => {
    if (value?.address) {
      setAddress(value.address);
    } else if (value?.latitude && value?.longitude && !value.address) {
      // 如果有坐标但没有地址，尝试获取地址名称
      setLoading(true);
      const lat = value.latitude;
      const lng = value.longitude;
      if (lat !== undefined && lng !== undefined) {
        reverseGeocode(lat, lng).then((addr) => {
          setAddress(addr);
          setLoading(false);
          // 同时更新value，保存地址名称
          if (addr !== `${lat.toFixed(6)}, ${lng.toFixed(6)}`) {
            onChange?.({
              ...value,
              address: addr,
            });
          }
        });
      }
    } else {
      setAddress("");
    }
  }, [value, onChange]);

  // 获取当前位置（使用浏览器API）
  const handleGetLocation = async () => {
    if (disabled || readOnly) {
      setMapVisible(true);
      return;
    }

    if (!navigator.geolocation) {
      message.warning("您的浏览器不支持地理定位功能，请在地图上选择位置");
      setMapVisible(true);
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // 获取地址名称（通过逆地理编码）
        const addressName = await reverseGeocode(latitude, longitude);
        
        const locationData = {
          latitude,
          longitude,
          address: addressName,
        };

        onChange?.(locationData);
        setAddress(addressName);
        message.success("定位成功");
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        let errorMessage = "获取位置失败";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "用户拒绝了地理位置请求，请在地图上选择位置";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "位置信息不可用，请在地图上选择位置";
            break;
          case error.TIMEOUT:
            errorMessage = "获取位置超时，请在地图上选择位置";
            break;
        }
        
        message.warning(errorMessage);
        // 如果定位失败，打开地图选择器
        setMapVisible(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 从地图选择器返回的值
  const handleMapSelect = (locationData: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    onChange?.(locationData);
    setAddress(locationData.address);
    setMapVisible(false);
  };

  // 显示的值：只显示位置名称，不显示坐标
  // 如果只有坐标没有地址名称，显示占位符提示用户选择位置
  const displayValue = address || value?.address || placeholder;
  const isCoordinate = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(displayValue);
  const finalDisplayValue = isCoordinate && !value?.address ? placeholder : displayValue;

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={finalDisplayValue}
          placeholder={placeholder}
          disabled={disabled || readOnly}
          readOnly
          suffix={
            <AimOutlined
              style={{
                color: "#1890ff",
                cursor: disabled || readOnly ? "not-allowed" : "pointer",
              }}
              onClick={() => !readOnly && !disabled && setMapVisible(true)}
            />
          }
        />
        {!readOnly && (
          <Button
            type="primary"
            icon={<AimOutlined />}
            loading={loading}
            disabled={disabled}
            onClick={handleGetLocation}
          >
            获取定位
          </Button>
        )}
      </Space.Compact>

      {/* 地图选择器模态框 */}
      <MapLocationPicker
        visible={mapVisible}
        onCancel={() => setMapVisible(false)}
        onConfirm={handleMapSelect}
        initialLocation={value}
      />
    </>
  );
};
