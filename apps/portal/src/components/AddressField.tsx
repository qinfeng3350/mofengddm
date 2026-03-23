import React, { useState, useEffect } from "react";
import { Cascader, Input, message } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import type { CascaderProps } from "antd/es/cascader";
import { getChinaRegions, type RegionOption } from "@/data/chinaRegions";

interface AddressOption {
  value: string;
  label: string;
  children?: AddressOption[];
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
    // 加载地址选项数据
    // 实际项目中应该从API获取或使用完整的省市区数据
    setLoading(true);
    try {
      const addressOptions = getAddressOptions();
      setOptions(addressOptions);
    } catch (error) {
      message.error("加载地址数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

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
        value={cascaderValue}
        placeholder={placeholder}
        disabled={disabled || readOnly}
        loading={loading}
        style={{ width: "100%" }}
        suffixIcon={<EnvironmentOutlined />}
        changeOnSelect={false}
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

