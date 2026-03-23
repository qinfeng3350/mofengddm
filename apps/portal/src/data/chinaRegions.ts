// 中国省市区县数据
// 注意：这是简化版本，实际项目中应该使用完整的省市区数据或从API加载

export interface RegionOption {
  value: string;
  label: string;
  code?: string;
  children?: RegionOption[];
}

// 完整的数据应该包含所有省份、城市、区县
// 这里提供一个基础结构，实际应该从API或完整数据源加载
export const getChinaRegions = (): RegionOption[] => {
  // TODO: 从API或完整数据文件加载
  // 这是一个简化示例，实际应该包含完整的省市区数据
  return [
    {
      value: "110000",
      label: "北京市",
      code: "110000",
      children: [
        {
          value: "110100",
          label: "北京市",
          code: "110100",
          children: [
            { value: "110101", label: "东城区", code: "110101" },
            { value: "110102", label: "西城区", code: "110102" },
            { value: "110105", label: "朝阳区", code: "110105" },
            { value: "110106", label: "丰台区", code: "110106" },
            { value: "110107", label: "石景山区", code: "110107" },
            { value: "110108", label: "海淀区", code: "110108" },
            { value: "110109", label: "门头沟区", code: "110109" },
            { value: "110111", label: "房山区", code: "110111" },
            { value: "110112", label: "通州区", code: "110112" },
            { value: "110113", label: "顺义区", code: "110113" },
            { value: "110114", label: "昌平区", code: "110114" },
            { value: "110115", label: "大兴区", code: "110115" },
            { value: "110116", label: "怀柔区", code: "110116" },
            { value: "110117", label: "平谷区", code: "110117" },
            { value: "110118", label: "密云区", code: "110118" },
            { value: "110119", label: "延庆区", code: "110119" },
          ],
        },
      ],
    },
    {
      value: "120000",
      label: "天津市",
      code: "120000",
      children: [
        {
          value: "120100",
          label: "天津市",
          code: "120100",
          children: [
            { value: "120101", label: "和平区", code: "120101" },
            { value: "120102", label: "河东区", code: "120102" },
            { value: "120103", label: "河西区", code: "120103" },
            { value: "120104", label: "南开区", code: "120104" },
            { value: "120105", label: "河北区", code: "120105" },
            { value: "120106", label: "红桥区", code: "120106" },
            { value: "120110", label: "东丽区", code: "120110" },
            { value: "120111", label: "西青区", code: "120111" },
            { value: "120112", label: "津南区", code: "120112" },
            { value: "120113", label: "北辰区", code: "120113" },
            { value: "120114", label: "武清区", code: "120114" },
            { value: "120115", label: "宝坻区", code: "120115" },
            { value: "120116", label: "滨海新区", code: "120116" },
            { value: "120117", label: "宁河区", code: "120117" },
            { value: "120118", label: "静海区", code: "120118" },
            { value: "120119", label: "蓟州区", code: "120119" },
          ],
        },
      ],
    },
    {
      value: "310000",
      label: "上海市",
      code: "310000",
      children: [
        {
          value: "310100",
          label: "上海市",
          code: "310100",
          children: [
            { value: "310101", label: "黄浦区", code: "310101" },
            { value: "310104", label: "徐汇区", code: "310104" },
            { value: "310105", label: "长宁区", code: "310105" },
            { value: "310106", label: "静安区", code: "310106" },
            { value: "310107", label: "普陀区", code: "310107" },
            { value: "310109", label: "虹口区", code: "310109" },
            { value: "310110", label: "杨浦区", code: "310110" },
            { value: "310112", label: "闵行区", code: "310112" },
            { value: "310113", label: "宝山区", code: "310113" },
            { value: "310114", label: "嘉定区", code: "310114" },
            { value: "310115", label: "浦东新区", code: "310115" },
            { value: "310116", label: "金山区", code: "310116" },
            { value: "310117", label: "松江区", code: "310117" },
            { value: "310118", label: "青浦区", code: "310118" },
            { value: "310120", label: "奉贤区", code: "310120" },
            { value: "310151", label: "崇明区", code: "310151" },
          ],
        },
      ],
    },
    {
      value: "440000",
      label: "广东省",
      code: "440000",
      children: [
        {
          value: "440100",
          label: "广州市",
          code: "440100",
          children: [
            { value: "440103", label: "荔湾区", code: "440103" },
            { value: "440104", label: "越秀区", code: "440104" },
            { value: "440105", label: "海珠区", code: "440105" },
            { value: "440106", label: "天河区", code: "440106" },
            { value: "440111", label: "白云区", code: "440111" },
            { value: "440112", label: "黄埔区", code: "440112" },
            { value: "440113", label: "番禺区", code: "440113" },
            { value: "440114", label: "花都区", code: "440114" },
            { value: "440115", label: "南沙区", code: "440115" },
            { value: "440117", label: "从化区", code: "440117" },
            { value: "440118", label: "增城区", code: "440118" },
          ],
        },
        {
          value: "440300",
          label: "深圳市",
          code: "440300",
          children: [
            { value: "440303", label: "罗湖区", code: "440303" },
            { value: "440304", label: "福田区", code: "440304" },
            { value: "440305", label: "南山区", code: "440305" },
            { value: "440306", label: "宝安区", code: "440306" },
            { value: "440307", label: "龙岗区", code: "440307" },
            { value: "440308", label: "盐田区", code: "440308" },
            { value: "440309", label: "龙华区", code: "440309" },
            { value: "440310", label: "坪山区", code: "440310" },
            { value: "440311", label: "光明区", code: "440311" },
          ],
        },
        {
          value: "440400",
          label: "珠海市",
          code: "440400",
          children: [
            { value: "440402", label: "香洲区", code: "440402" },
            { value: "440403", label: "斗门区", code: "440403" },
            { value: "440404", label: "金湾区", code: "440404" },
          ],
        },
        {
          value: "440500",
          label: "汕头市",
          code: "440500",
          children: [
            { value: "440507", label: "龙湖区", code: "440507" },
            { value: "440511", label: "金平区", code: "440511" },
            { value: "440512", label: "濠江区", code: "440512" },
            { value: "440513", label: "潮阳区", code: "440513" },
            { value: "440514", label: "潮南区", code: "440514" },
            { value: "440515", label: "澄海区", code: "440515" },
          ],
        },
      ],
    },
    {
      value: "330000",
      label: "浙江省",
      code: "330000",
      children: [
        {
          value: "330100",
          label: "杭州市",
          code: "330100",
          children: [
            { value: "330102", label: "上城区", code: "330102" },
            { value: "330105", label: "拱墅区", code: "330105" },
            { value: "330106", label: "西湖区", code: "330106" },
            { value: "330108", label: "滨江区", code: "330108" },
            { value: "330109", label: "萧山区", code: "330109" },
            { value: "330110", label: "余杭区", code: "330110" },
            { value: "330111", label: "富阳区", code: "330111" },
            { value: "330112", label: "临安区", code: "330112" },
            { value: "330113", label: "临平区", code: "330113" },
            { value: "330114", label: "钱塘区", code: "330114" },
          ],
        },
        {
          value: "330200",
          label: "宁波市",
          code: "330200",
          children: [
            { value: "330203", label: "海曙区", code: "330203" },
            { value: "330205", label: "江北区", code: "330205" },
            { value: "330206", label: "北仑区", code: "330206" },
            { value: "330211", label: "镇海区", code: "330211" },
            { value: "330212", label: "鄞州区", code: "330212" },
            { value: "330213", label: "奉化区", code: "330213" },
          ],
        },
      ],
    },
    {
      value: "320000",
      label: "江苏省",
      code: "320000",
      children: [
        {
          value: "320100",
          label: "南京市",
          code: "320100",
          children: [
            { value: "320102", label: "玄武区", code: "320102" },
            { value: "320104", label: "秦淮区", code: "320104" },
            { value: "320105", label: "建邺区", code: "320105" },
            { value: "320106", label: "鼓楼区", code: "320106" },
            { value: "320111", label: "浦口区", code: "320111" },
            { value: "320113", label: "栖霞区", code: "320113" },
            { value: "320114", label: "雨花台区", code: "320114" },
            { value: "320115", label: "江宁区", code: "320115" },
            { value: "320116", label: "六合区", code: "320116" },
            { value: "320117", label: "溧水区", code: "320117" },
            { value: "320118", label: "高淳区", code: "320118" },
          ],
        },
        {
          value: "320500",
          label: "苏州市",
          code: "320500",
          children: [
            { value: "320505", label: "虎丘区", code: "320505" },
            { value: "320506", label: "吴中区", code: "320506" },
            { value: "320507", label: "相城区", code: "320507" },
            { value: "320508", label: "姑苏区", code: "320508" },
            { value: "320509", label: "吴江区", code: "320509" },
          ],
        },
      ],
    },
    // 可以继续添加其他省份...
    // 实际项目中应该包含完整的34个省级行政区及其所有城市和区县
  ];
};

