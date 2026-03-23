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
  try {
    // 方案1：调用后端API（推荐，避免CORS问题）
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const data = await response.json();
      if (data.address) {
        return data.address;
      }
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
        // 优先使用格式化地址
        if (data.regeocode.formattedAddress) {
          return data.regeocode.formattedAddress;
        }
        
        // 否则构建地址
        const addressComponent = data.regeocode.addressComponent;
        if (addressComponent) {
          const parts = [
            addressComponent.province,
            addressComponent.city,
            addressComponent.district,
            addressComponent.street,
            addressComponent.streetNumber,
          ].filter(Boolean);
          return parts.join("");
        }
      }
    }
  } catch (error) {
    console.error("高德地图逆地理编码失败:", error);
  }

  // 方案3：返回坐标（作为最后备选）
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
