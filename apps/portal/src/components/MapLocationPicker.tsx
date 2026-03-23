import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, message, Space, Spin, Alert } from "antd";
import { AimOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { AMAP_CONFIG, getAMapKey } from "@/config/mapConfig";

interface MapLocationPickerProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (location: { latitude: number; longitude: number; address: string }) => void;
  initialLocation?: { latitude?: number; longitude?: number; address?: string };
}

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  visible,
  onCancel,
  onConfirm,
  initialLocation,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [currentAddress, setCurrentAddress] = useState<string>(initialLocation?.address || "");
  const [currentPosition, setCurrentPosition] = useState<{ lng: number; lat: number } | null>(
    initialLocation?.longitude && initialLocation?.latitude
      ? { lng: initialLocation.longitude, lat: initialLocation.latitude }
      : null
  );

  // 获取 API Key
  useEffect(() => {
    if (visible) {
      const key = getAMapKey();
      setApiKey(key);
      if (!key) {
        setScriptError("未配置高德地图 API Key，请前往系统设置 > API Key管理 进行配置");
      }
    }
  }, [visible]);

  // 加载高德地图脚本
  useEffect(() => {
    if (!visible || !apiKey) {
      if (!apiKey && visible) {
        setScriptError("未配置高德地图 API Key，请前往系统设置 > API Key管理 进行配置");
      }
      return;
    }

    setScriptError("");

    // 检查是否已加载
    if ((window as any).AMap) {
      setScriptLoaded(true);
      return;
    }

    // 检查是否正在加载
    if (document.querySelector(`script[src*="amap.com"]`)) {
      const checkInterval = setInterval(() => {
        if ((window as any).AMap) {
          setScriptLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    setLoading(true);
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&callback=initAMap`;
    script.async = true;

    // 创建全局回调函数
    (window as any).initAMap = () => {
      setScriptLoaded(true);
      setLoading(false);
      setScriptError("");
    };

    script.onerror = () => {
      setLoading(false);
      setScriptError("地图加载失败，请检查：1. API Key 是否正确；2. 网络连接是否正常；3. API Key 是否已绑定 Web 端服务");
      message.error("地图加载失败，请检查 API Key 配置和网络连接");
    };

    // 设置超时检测
    const timeout = setTimeout(() => {
      if (!(window as any).AMap) {
        setLoading(false);
        setScriptError("地图加载超时，请检查网络连接或刷新页面重试");
        message.error("地图加载超时");
      }
    }, 15000);

    document.head.appendChild(script);

    return () => {
      clearTimeout(timeout);
      if ((window as any).initAMap) {
        delete (window as any).initAMap;
      }
    };
  }, [visible, apiKey]);

  // 初始化地图
  useEffect(() => {
    if (!visible || !scriptLoaded || !mapRef.current || !(window as any).AMap) return;

    try {
      const AMap = (window as any).AMap;
      
      // 确定初始中心点
      const center: [number, number] = currentPosition
        ? [currentPosition.lng, currentPosition.lat]
        : AMAP_CONFIG.defaultCenter;

      // 初始化地图
      mapInstanceRef.current = new AMap.Map(mapRef.current, {
        zoom: currentPosition ? 15 : 13,
        center: center,
        viewMode: "3D",
      });

      // 初始化地理编码器
      geocoderRef.current = new AMap.Geocoder();

      // 添加已有标记
      if (currentPosition) {
        markerRef.current = new AMap.Marker({
          position: center,
          draggable: true,
        });
        mapInstanceRef.current.add(markerRef.current);
        
        // 标记拖拽事件
        markerRef.current.on("dragend", (e: any) => {
          const { lng, lat } = e.lnglat.getPosition();
          setCurrentPosition({ lng, lat });
          reverseGeocode(lng, lat);
        });
      }

      // 地图点击事件
      mapInstanceRef.current.on("click", (e: any) => {
        const { lng, lat } = e.lnglat;
        setMarker(lng, lat);
        reverseGeocode(lng, lat);
      });

      // 添加定位控件
      mapInstanceRef.current.plugin("AMap.Geolocation", () => {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
          buttonOffset: new AMap.Pixel(10, 20),
          buttonPosition: "RB",
          showMarker: false,
          showCircle: false,
        });

        mapInstanceRef.current.addControl(geolocation);

        // 定位成功回调
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === "complete") {
            const { lng, lat } = result.position;
            setMarker(lng, lat);
            reverseGeocode(lng, lat);
            message.success("定位成功");
          } else {
            message.error("定位失败：" + result.message);
          }
        });
      });

      // 添加工具栏
      mapInstanceRef.current.plugin("AMap.ToolBar", () => {
        mapInstanceRef.current.addControl(new AMap.ToolBar());
      });
    } catch (error) {
      console.error("地图初始化失败:", error);
      message.error("地图初始化失败");
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
    };
  }, [visible, scriptLoaded, currentPosition]);

  // 设置标记位置
  const setMarker = (lng: number, lat: number) => {
    if (!mapInstanceRef.current || !(window as any).AMap) return;

    const AMap = (window as any).AMap;

    if (markerRef.current) {
      markerRef.current.setPosition([lng, lat]);
    } else {
      markerRef.current = new AMap.Marker({
        position: [lng, lat],
        draggable: true,
      });
      mapInstanceRef.current.add(markerRef.current);
      markerRef.current.on("dragend", (e: any) => {
        const { lng: newLng, lat: newLat } = e.lnglat.getPosition();
        setCurrentPosition({ lng: newLng, lat: newLat });
        reverseGeocode(newLng, newLat);
      });
    }

    mapInstanceRef.current.setCenter([lng, lat]);
    setCurrentPosition({ lng, lat });
  };

  // 逆地理编码
  const reverseGeocode = (lng: number, lat: number) => {
    if (!geocoderRef.current) return;

    setLoading(true);
    geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
      setLoading(false);
      if (status === "complete" && result.info === "OK") {
        const regeocode = result.regeocode;
        // 构建地址字符串
        const addressComponent = regeocode.addressComponent;
        let address = "";
        
        if (addressComponent) {
          // 构建地址：省/市/区/街道
          const parts = [
            addressComponent.province,
            addressComponent.city,
            addressComponent.district,
            addressComponent.township, // 街道/乡镇
            addressComponent.neighborhood, // 社区
          ].filter(Boolean);
          
          // 如果有格式化地址，优先使用
          if (regeocode.formattedAddress) {
            address = regeocode.formattedAddress;
          } else if (parts.length > 0) {
            address = parts.join("");
          }
        }
        
        setCurrentAddress(address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } else {
        setCurrentAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });
  };

  // 获取当前位置
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error("您的浏览器不支持地理定位功能");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMarker(longitude, latitude);
        reverseGeocode(longitude, latitude);
      },
      (error) => {
        setLoading(false);
        let errorMessage = "获取位置失败";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "用户拒绝了地理位置请求";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "位置信息不可用";
            break;
          case error.TIMEOUT:
            errorMessage = "获取位置超时";
            break;
        }
        message.error(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 确认选择
  const handleConfirm = () => {
    if (!currentPosition) {
      message.warning("请先选择一个位置");
      return;
    }

    onConfirm({
      latitude: currentPosition.lat,
      longitude: currentPosition.lng,
      address: currentAddress || `${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}`,
    });

    onCancel();
  };

  return (
    <Modal
      title="选择位置"
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      width={900}
      okText="确定"
      cancelText="取消"
      confirmLoading={loading}
    >
      {scriptError ? (
        <Alert
          message="地图加载失败"
          description={
            <div>
              <p>{scriptError}</p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    window.open("/settings?tab=apikey", "_blank");
                  }}
                  style={{ padding: 0 }}
                >
                  前往配置 API Key
                </Button>
              </p>
            </div>
          }
          type="error"
          icon={<ExclamationCircleOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Spin spinning={loading && !scriptLoaded}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              icon={<AimOutlined />}
              onClick={handleGetCurrentLocation}
              loading={loading}
              disabled={!scriptLoaded || !!scriptError}
            >
              获取当前位置
            </Button>
            <span style={{ color: "#666", fontSize: 12 }}>
              提示：在地图上点击可选择位置，拖动标记可调整位置
            </span>
          </Space>
        </div>
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: "500px",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            backgroundColor: scriptError ? "#f5f5f5" : "#fff",
            display: scriptError ? "none" : "block",
          }}
        />
        {currentAddress && !scriptError && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f5f5f5",
              borderRadius: 4,
              fontSize: 14,
            }}
          >
            <strong>位置：</strong>
            <span>{currentAddress}</span>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

