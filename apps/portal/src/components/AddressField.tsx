import React, { useState, useEffect } from "react";
import { Cascader, Input, message } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import type { CascaderProps } from "antd/es/cascader";
import { getChinaRegions, type RegionOption } from "@/data/chinaRegions";
import { getAMapKey } from "@/config/mapConfig";

interface AddressOption {
  value: string;
  label: string;
  children?: AddressOption[];
  isLeaf?: boolean;
  loading?: boolean;
}

interface AddressFieldProps {
  value?: {
    province?: string;
    city?: string;
    district?: string;
    detail?: string;
  };
  onChange?: (value: {
    province?: string;
    city?: string;
    district?: string;
    detail?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

// 将RegionOption转换为AddressOption格式
const convertRegionsToOptions = (regions: RegionOption[]): AddressOption[] => {
  return regions.map((region) => ({
    value: region.value,
    label: region.label,
    children: region.children ? convertRegionsToOptions(region.children) : undefined,
  }));
};

const getAddressOptions = (): AddressOption[] => {
  // 从数据文件加载省市区数据
  const regions = getChinaRegions();
  return convertRegionsToOptions(regions);
};

type AMapDistrict = {
  adcode: string;
  name: string;
  level: "country" | "province" | "city" | "district" | "street";
};

const fetchDistrictChildren = async (keyword: string): Promise<AddressOption[]> => {
  const key = getAMapKey();
  if (!key) return [];

  const url =
    `https://restapi.amap.com/v3/config/district?key=${key}` +
    `&keywords=${encodeURIComponent(keyword)}` +
    `&subdistrict=1&extensions=base`;

  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  if (data?.status !== "1") return [];

  const list: AMapDistrict[] = data?.districts?.[0]?.districts || [];
  return list.map((d) => ({
    value: d.adcode,
    label: d.name,
    isLeaf: d.level === "district" || d.level === "street",
  }));
};

export const AddressField: React.FC<AddressFieldProps> = ({
  value,
  onChange,
  placeholder = "请选择省市区县",
  disabled = false,
  readOnly = false,
}) => {
  const [options, setOptions] = useState<AddressOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // 优先走高德行政区接口（全国全量）
        const provinces = await fetchDistrictChildren("中国");
        if (!cancelled && provinces.length > 0) {
          setOptions(provinces);
          return;
        }
        // 回退到本地简化数据（兜底）
        const addressOptions = getAddressOptions();
        if (!cancelled) setOptions(addressOptions);
      } catch (error) {
        if (!cancelled) {
          const addressOptions = getAddressOptions();
          setOptions(addressOptions);
          message.warning("行政区数据加载失败，已切换到本地数据");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = async (selectedOptions: AddressOption[]) => {
    const target = selectedOptions[selectedOptions.length - 1];
    if (!target || target.isLeaf) return;
    target.loading = true;
    setOptions([...options]);
    try {
      const children = await fetchDistrictChildren(target.value);
      target.children = children;
      if (!children.length) {
        target.isLeaf = true;
      }
    } finally {
      target.loading = false;
      setOptions([...options]);
    }
  };

  const handleCascaderChange: CascaderProps<AddressOption>["onChange"] = (selectedValues) => {
    if (readOnly || disabled) return;

    if (selectedValues && selectedValues.length >= 3) {
      const [provinceValue, cityValue, districtValue] = selectedValues as string[];
      
      // 查找对应的标签
      const province = options.find((opt) => opt.value === provinceValue);
      const city = province?.children?.find((opt) => opt.value === cityValue);
      const district = city?.children?.find((opt) => opt.value === districtValue);

      onChange?.({
        province: province?.label || provinceValue,
        city: city?.label || cityValue,
        district: district?.label || districtValue,
        detail: value?.detail || "",
      });
    } else if (selectedValues && selectedValues.length === 2) {
      const [provinceValue, cityValue] = selectedValues as string[];
      const province = options.find((opt) => opt.value === provinceValue);
      const city = province?.children?.find((opt) => opt.value === cityValue);

      onChange?.({
        province: province?.label || provinceValue,
        city: city?.label || cityValue,
        district: "",
        detail: value?.detail || "",
      });
    } else if (selectedValues && selectedValues.length === 1) {
      const [provinceValue] = selectedValues as string[];
      const province = options.find((opt) => opt.value === provinceValue);

      onChange?.({
        province: province?.label || provinceValue,
        city: "",
        district: "",
        detail: value?.detail || "",
      });
    }
  };

  const cascaderValue = value
    ? [
        value.province
          ? options.find((opt) => opt.label === value.province)?.value || ""
          : "",
        value.city
          ? options
              .find((opt) => opt.label === value.province)
              ?.children?.find((opt) => opt.label === value.city)
              ?.value || ""
          : "",
        value.district
          ? options
              .find((opt) => opt.label === value.province)
              ?.children?.find((opt) => opt.label === value.city)
              ?.children?.find((opt) => opt.label === value.district)
              ?.value || ""
          : "",
      ].filter(Boolean)
    : undefined;

  const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || disabled) return;
    onChange?.({
      ...value,
      detail: e.target.value,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Cascader
        options={options}
        onChange={handleCascaderChange}
        loadData={loadData}
        value={cascaderValue}
        placeholder={placeholder}
        disabled={disabled || readOnly}
        loading={loading}
        style={{ width: "100%" }}
        suffixIcon={<EnvironmentOutlined />}
        changeOnSelect
        expandTrigger="hover"
      />
      <Input
        placeholder="请输入详细地址"
        value={value?.detail || ""}
        onChange={handleDetailChange}
        disabled={disabled || readOnly}
        suffix={<EnvironmentOutlined style={{ color: "#1890ff" }} />}
      />
    </div>
  );
};

