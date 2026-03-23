import * as FaIcons from "react-icons/fa";
import * as MdIcons from "react-icons/md";
import * as HiIcons from "react-icons/hi";
import * as AiIcons from "react-icons/ai";
import * as BsIcons from "react-icons/bs";
import * as FiIcons from "react-icons/fi";
import { FileTextOutlined } from "@ant-design/icons";

// 图标映射表
const iconMap: Record<string, any> = {
  // Font Awesome
  "fa-FaFile": FaIcons.FaFile,
  "fa-FaFolder": FaIcons.FaFolder,
  "fa-FaUser": FaIcons.FaUser,
  "fa-FaUsers": FaIcons.FaUsers,
  "fa-FaChartBar": FaIcons.FaChartBar,
  "fa-FaTable": FaIcons.FaTable,
  "fa-FaList": FaIcons.FaList,
  "fa-FaEdit": FaIcons.FaEdit,
  "fa-FaTrash": FaIcons.FaTrash,
  "fa-FaSave": FaIcons.FaSave,
  "fa-FaSearch": FaIcons.FaSearch,
  "fa-FaHome": FaIcons.FaHome,
  "fa-FaCog": FaIcons.FaCog,
  "fa-FaBell": FaIcons.FaBell,
  "fa-FaEnvelope": FaIcons.FaEnvelope,
  "fa-FaCalendar": FaIcons.FaCalendar,
  "fa-FaClock": FaIcons.FaClock,
  "fa-FaImage": FaIcons.FaImage,
  "fa-FaVideo": FaIcons.FaVideo,
  "fa-FaMusic": FaIcons.FaMusic,
  // Material Design
  "md-MdDescription": MdIcons.MdDescription,
  "md-MdDashboard": MdIcons.MdDashboard,
  "md-MdSettings": MdIcons.MdSettings,
  "md-MdPerson": MdIcons.MdPerson,
  "md-MdGroup": MdIcons.MdGroup,
  "md-MdBusiness": MdIcons.MdBusiness,
  "md-MdEmail": MdIcons.MdEmail,
  "md-MdPhone": MdIcons.MdPhone,
  "md-MdLocationOn": MdIcons.MdLocationOn,
  "md-MdDateRange": MdIcons.MdDateRange,
  "md-MdAccessTime": MdIcons.MdAccessTime,
  "md-MdImage": MdIcons.MdImage,
  "md-MdVideoLibrary": MdIcons.MdVideoLibrary,
  "md-MdMusicNote": MdIcons.MdMusicNote,
  // Heroicons
  "hi-HiDocument": HiIcons.HiDocument,
  "hi-HiFolder": HiIcons.HiFolder,
  "hi-HiUser": HiIcons.HiUser,
  "hi-HiUsers": HiIcons.HiUsers,
  "hi-HiChartBar": HiIcons.HiChartBar,
  "hi-HiTable": HiIcons.HiTable,
  "hi-HiPencil": HiIcons.HiPencil,
  "hi-HiTrash": HiIcons.HiTrash,
  "hi-HiSave": HiIcons.HiSave,
  "hi-HiSearch": HiIcons.HiSearch,
  "hi-HiHome": HiIcons.HiHome,
  "hi-HiCog": HiIcons.HiCog,
  "hi-HiBell": HiIcons.HiBell,
  "hi-HiMail": HiIcons.HiMail,
  "hi-HiCalendar": HiIcons.HiCalendar,
  "hi-HiClock": HiIcons.HiClock,
  "hi-HiPhotograph": HiIcons.HiPhotograph,
  "hi-HiVideoCamera": HiIcons.HiVideoCamera,
  "hi-HiMusicNote": HiIcons.HiMusicNote,
  // Ant Design Icons
  "ai-AiOutlineFile": AiIcons.AiOutlineFile,
  "ai-AiOutlineFolder": AiIcons.AiOutlineFolder,
  "ai-AiOutlineUser": AiIcons.AiOutlineUser,
  "ai-AiOutlineTeam": AiIcons.AiOutlineTeam,
  "ai-AiOutlineBarChart": AiIcons.AiOutlineBarChart,
  "ai-AiOutlineTable": AiIcons.AiOutlineTable,
  "ai-AiOutlineEdit": AiIcons.AiOutlineEdit,
  "ai-AiOutlineDelete": AiIcons.AiOutlineDelete,
  "ai-AiOutlineSave": AiIcons.AiOutlineSave,
  "ai-AiOutlineSearch": AiIcons.AiOutlineSearch,
  "ai-AiOutlineHome": AiIcons.AiOutlineHome,
  "ai-AiOutlineSetting": AiIcons.AiOutlineSetting,
  "ai-AiOutlineBell": AiIcons.AiOutlineBell,
  "ai-AiOutlineMail": AiIcons.AiOutlineMail,
  "ai-AiOutlineCalendar": AiIcons.AiOutlineCalendar,
  "ai-AiOutlineClockCircle": AiIcons.AiOutlineClockCircle,
  "ai-AiOutlinePicture": AiIcons.AiOutlinePicture,
  "ai-AiOutlineVideoCamera": AiIcons.AiOutlineVideoCamera,
  "ai-AiOutlineSound": AiIcons.AiOutlineSound,
  // Bootstrap Icons
  "bs-BsFileEarmark": BsIcons.BsFileEarmark,
  "bs-BsFolder": BsIcons.BsFolder,
  "bs-BsPerson": BsIcons.BsPerson,
  "bs-BsPeople": BsIcons.BsPeople,
  "bs-BsBarChart": BsIcons.BsBarChart,
  "bs-BsTable": BsIcons.BsTable,
  "bs-BsPencil": BsIcons.BsPencil,
  "bs-BsTrash": BsIcons.BsTrash,
  "bs-BsSave": BsIcons.BsSave,
  "bs-BsSearch": BsIcons.BsSearch,
  "bs-BsHouse": BsIcons.BsHouse,
  "bs-BsGear": BsIcons.BsGear,
  "bs-BsBell": BsIcons.BsBell,
  "bs-BsEnvelope": BsIcons.BsEnvelope,
  "bs-BsCalendar": BsIcons.BsCalendar,
  "bs-BsClock": BsIcons.BsClock,
  "bs-BsImage": BsIcons.BsImage,
  "bs-BsCameraVideo": BsIcons.BsCameraVideo,
  "bs-BsMusicNote": BsIcons.BsMusicNote,
  // Feather Icons
  "fi-FiFile": FiIcons.FiFile,
  "fi-FiFolder": FiIcons.FiFolder,
  "fi-FiUser": FiIcons.FiUser,
  "fi-FiUsers": FiIcons.FiUsers,
  "fi-FiBarChart": FiIcons.FiBarChart,
  "fi-FiEdit": FiIcons.FiEdit,
  "fi-FiTrash": FiIcons.FiTrash,
  "fi-FiSave": FiIcons.FiSave,
  "fi-FiSearch": FiIcons.FiSearch,
  "fi-FiHome": FiIcons.FiHome,
  "fi-FiSettings": FiIcons.FiSettings,
  "fi-FiBell": FiIcons.FiBell,
  "fi-FiMail": FiIcons.FiMail,
  "fi-FiCalendar": FiIcons.FiCalendar,
  "fi-FiClock": FiIcons.FiClock,
  "fi-FiImage": FiIcons.FiImage,
  "fi-FiVideo": FiIcons.FiVideo,
  "fi-FiMusic": FiIcons.FiMusic,
};

/**
 * 根据图标值字符串渲染图标组件
 * @param iconValue 图标值，格式：library-iconName，例如 "fa-FaFile"
 * @param defaultIcon 默认图标，如果找不到则使用此图标
 * @param style 图标样式
 */
export const renderIcon = (
  iconValue?: string | null,
  defaultIcon: React.ComponentType<any> = FileTextOutlined,
  style?: React.CSSProperties
) => {
  if (!iconValue) {
    const DefaultIcon = defaultIcon;
    return <DefaultIcon style={style} />;
  }

  const IconComponent = iconMap[iconValue];
  if (IconComponent) {
    return <IconComponent style={style} />;
  }

  // 如果找不到，返回默认图标
  const DefaultIcon = defaultIcon;
  return <DefaultIcon style={style} />;
};

