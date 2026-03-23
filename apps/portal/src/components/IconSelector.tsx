import { useState } from "react";
import { Modal, Grid, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import * as FaIcons from "react-icons/fa";
import * as MdIcons from "react-icons/md";
import * as HiIcons from "react-icons/hi";
import * as AiIcons from "react-icons/ai";
import * as BsIcons from "react-icons/bs";
import * as FiIcons from "react-icons/fi";

const { useBreakpoint } = Grid;

// 常用图标列表
const commonIcons = [
  // Font Awesome
  { name: "FaFile", icon: FaIcons.FaFile, library: "fa" },
  { name: "FaFolder", icon: FaIcons.FaFolder, library: "fa" },
  { name: "FaUser", icon: FaIcons.FaUser, library: "fa" },
  { name: "FaUsers", icon: FaIcons.FaUsers, library: "fa" },
  { name: "FaChartBar", icon: FaIcons.FaChartBar, library: "fa" },
  { name: "FaTable", icon: FaIcons.FaTable, library: "fa" },
  { name: "FaList", icon: FaIcons.FaList, library: "fa" },
  { name: "FaEdit", icon: FaIcons.FaEdit, library: "fa" },
  { name: "FaTrash", icon: FaIcons.FaTrash, library: "fa" },
  { name: "FaSave", icon: FaIcons.FaSave, library: "fa" },
  { name: "FaSearch", icon: FaIcons.FaSearch, library: "fa" },
  { name: "FaHome", icon: FaIcons.FaHome, library: "fa" },
  { name: "FaCog", icon: FaIcons.FaCog, library: "fa" },
  { name: "FaBell", icon: FaIcons.FaBell, library: "fa" },
  { name: "FaEnvelope", icon: FaIcons.FaEnvelope, library: "fa" },
  { name: "FaCalendar", icon: FaIcons.FaCalendar, library: "fa" },
  { name: "FaClock", icon: FaIcons.FaClock, library: "fa" },
  { name: "FaImage", icon: FaIcons.FaImage, library: "fa" },
  { name: "FaVideo", icon: FaIcons.FaVideo, library: "fa" },
  { name: "FaMusic", icon: FaIcons.FaMusic, library: "fa" },
  // Material Design
  { name: "MdDescription", icon: MdIcons.MdDescription, library: "md" },
  { name: "MdDashboard", icon: MdIcons.MdDashboard, library: "md" },
  { name: "MdSettings", icon: MdIcons.MdSettings, library: "md" },
  { name: "MdPerson", icon: MdIcons.MdPerson, library: "md" },
  { name: "MdGroup", icon: MdIcons.MdGroup, library: "md" },
  { name: "MdBusiness", icon: MdIcons.MdBusiness, library: "md" },
  { name: "MdEmail", icon: MdIcons.MdEmail, library: "md" },
  { name: "MdPhone", icon: MdIcons.MdPhone, library: "md" },
  { name: "MdLocationOn", icon: MdIcons.MdLocationOn, library: "md" },
  { name: "MdDateRange", icon: MdIcons.MdDateRange, library: "md" },
  { name: "MdAccessTime", icon: MdIcons.MdAccessTime, library: "md" },
  { name: "MdImage", icon: MdIcons.MdImage, library: "md" },
  { name: "MdVideoLibrary", icon: MdIcons.MdVideoLibrary, library: "md" },
  { name: "MdMusicNote", icon: MdIcons.MdMusicNote, library: "md" },
  // Heroicons
  { name: "HiDocument", icon: HiIcons.HiDocument, library: "hi" },
  { name: "HiFolder", icon: HiIcons.HiFolder, library: "hi" },
  { name: "HiUser", icon: HiIcons.HiUser, library: "hi" },
  { name: "HiUsers", icon: HiIcons.HiUsers, library: "hi" },
  { name: "HiChartBar", icon: HiIcons.HiChartBar, library: "hi" },
  { name: "HiTable", icon: HiIcons.HiTable, library: "hi" },
  { name: "HiPencil", icon: HiIcons.HiPencil, library: "hi" },
  { name: "HiTrash", icon: HiIcons.HiTrash, library: "hi" },
  { name: "HiSave", icon: HiIcons.HiSave, library: "hi" },
  { name: "HiSearch", icon: HiIcons.HiSearch, library: "hi" },
  { name: "HiHome", icon: HiIcons.HiHome, library: "hi" },
  { name: "HiCog", icon: HiIcons.HiCog, library: "hi" },
  { name: "HiBell", icon: HiIcons.HiBell, library: "hi" },
  { name: "HiMail", icon: HiIcons.HiMail, library: "hi" },
  { name: "HiCalendar", icon: HiIcons.HiCalendar, library: "hi" },
  { name: "HiClock", icon: HiIcons.HiClock, library: "hi" },
  { name: "HiPhotograph", icon: HiIcons.HiPhotograph, library: "hi" },
  { name: "HiVideoCamera", icon: HiIcons.HiVideoCamera, library: "hi" },
  { name: "HiMusicNote", icon: HiIcons.HiMusicNote, library: "hi" },
  // Ant Design Icons (通过 react-icons)
  { name: "AiOutlineFile", icon: AiIcons.AiOutlineFile, library: "ai" },
  { name: "AiOutlineFolder", icon: AiIcons.AiOutlineFolder, library: "ai" },
  { name: "AiOutlineUser", icon: AiIcons.AiOutlineUser, library: "ai" },
  { name: "AiOutlineTeam", icon: AiIcons.AiOutlineTeam, library: "ai" },
  { name: "AiOutlineBarChart", icon: AiIcons.AiOutlineBarChart, library: "ai" },
  { name: "AiOutlineTable", icon: AiIcons.AiOutlineTable, library: "ai" },
  { name: "AiOutlineEdit", icon: AiIcons.AiOutlineEdit, library: "ai" },
  { name: "AiOutlineDelete", icon: AiIcons.AiOutlineDelete, library: "ai" },
  { name: "AiOutlineSave", icon: AiIcons.AiOutlineSave, library: "ai" },
  { name: "AiOutlineSearch", icon: AiIcons.AiOutlineSearch, library: "ai" },
  { name: "AiOutlineHome", icon: AiIcons.AiOutlineHome, library: "ai" },
  { name: "AiOutlineSetting", icon: AiIcons.AiOutlineSetting, library: "ai" },
  { name: "AiOutlineBell", icon: AiIcons.AiOutlineBell, library: "ai" },
  { name: "AiOutlineMail", icon: AiIcons.AiOutlineMail, library: "ai" },
  { name: "AiOutlineCalendar", icon: AiIcons.AiOutlineCalendar, library: "ai" },
  { name: "AiOutlineClockCircle", icon: AiIcons.AiOutlineClockCircle, library: "ai" },
  { name: "AiOutlinePicture", icon: AiIcons.AiOutlinePicture, library: "ai" },
  { name: "AiOutlineVideoCamera", icon: AiIcons.AiOutlineVideoCamera, library: "ai" },
  { name: "AiOutlineSound", icon: AiIcons.AiOutlineSound, library: "ai" },
  // Bootstrap Icons
  { name: "BsFileEarmark", icon: BsIcons.BsFileEarmark, library: "bs" },
  { name: "BsFolder", icon: BsIcons.BsFolder, library: "bs" },
  { name: "BsPerson", icon: BsIcons.BsPerson, library: "bs" },
  { name: "BsPeople", icon: BsIcons.BsPeople, library: "bs" },
  { name: "BsBarChart", icon: BsIcons.BsBarChart, library: "bs" },
  { name: "BsTable", icon: BsIcons.BsTable, library: "bs" },
  { name: "BsPencil", icon: BsIcons.BsPencil, library: "bs" },
  { name: "BsTrash", icon: BsIcons.BsTrash, library: "bs" },
  { name: "BsSave", icon: BsIcons.BsSave, library: "bs" },
  { name: "BsSearch", icon: BsIcons.BsSearch, library: "bs" },
  { name: "BsHouse", icon: BsIcons.BsHouse, library: "bs" },
  { name: "BsGear", icon: BsIcons.BsGear, library: "bs" },
  { name: "BsBell", icon: BsIcons.BsBell, library: "bs" },
  { name: "BsEnvelope", icon: BsIcons.BsEnvelope, library: "bs" },
  { name: "BsCalendar", icon: BsIcons.BsCalendar, library: "bs" },
  { name: "BsClock", icon: BsIcons.BsClock, library: "bs" },
  { name: "BsImage", icon: BsIcons.BsImage, library: "bs" },
  { name: "BsCameraVideo", icon: BsIcons.BsCameraVideo, library: "bs" },
  { name: "BsMusicNote", icon: BsIcons.BsMusicNote, library: "bs" },
  // Feather Icons
  { name: "FiFile", icon: FiIcons.FiFile, library: "fi" },
  { name: "FiFolder", icon: FiIcons.FiFolder, library: "fi" },
  { name: "FiUser", icon: FiIcons.FiUser, library: "fi" },
  { name: "FiUsers", icon: FiIcons.FiUsers, library: "fi" },
  { name: "FiBarChart", icon: FiIcons.FiBarChart, library: "fi" },
  { name: "FiEdit", icon: FiIcons.FiEdit, library: "fi" },
  { name: "FiTrash", icon: FiIcons.FiTrash, library: "fi" },
  { name: "FiSave", icon: FiIcons.FiSave, library: "fi" },
  { name: "FiSearch", icon: FiIcons.FiSearch, library: "fi" },
  { name: "FiHome", icon: FiIcons.FiHome, library: "fi" },
  { name: "FiSettings", icon: FiIcons.FiSettings, library: "fi" },
  { name: "FiBell", icon: FiIcons.FiBell, library: "fi" },
  { name: "FiMail", icon: FiIcons.FiMail, library: "fi" },
  { name: "FiCalendar", icon: FiIcons.FiCalendar, library: "fi" },
  { name: "FiClock", icon: FiIcons.FiClock, library: "fi" },
  { name: "FiImage", icon: FiIcons.FiImage, library: "fi" },
  { name: "FiVideo", icon: FiIcons.FiVideo, library: "fi" },
  { name: "FiMusic", icon: FiIcons.FiMusic, library: "fi" },
];

interface IconSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
}

export const IconSelector = ({ value, onChange }: IconSelectorProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const screens = useBreakpoint();

  // 根据搜索文本过滤图标
  const filteredIcons = commonIcons.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 获取当前选中的图标组件
  const selectedIcon = commonIcons.find(
    (item) => `${item.library}-${item.name}` === value
  );

  const handleSelect = (iconName: string, library: string) => {
    const iconValue = `${library}-${iconName}`;
    onChange?.(iconValue);
    setModalOpen(false);
    setSearchText("");
  };

  return (
    <>
      <Input
        readOnly
        placeholder="点击选择图标"
        value={selectedIcon ? selectedIcon.name : ""}
        onClick={() => setModalOpen(true)}
        prefix={
          selectedIcon ? (
            <selectedIcon.icon style={{ fontSize: 16 }} />
          ) : (
            <span style={{ fontSize: 16 }}>📄</span>
          )
        }
        suffix={<SearchOutlined />}
        style={{ cursor: "pointer" }}
      />

      <Modal
        title="选择图标"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setSearchText("");
        }}
        footer={null}
        width={screens.xs ? "90%" : 600}
      >
        <Input
          placeholder="搜索图标..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <div
          style={{
            maxHeight: 400,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
            gap: 12,
            padding: "8px 0",
          }}
        >
          {filteredIcons.map((item) => {
            const IconComponent = item.icon;
            const iconValue = `${item.library}-${item.name}`;
            const isSelected = value === iconValue;

            return (
              <div
                key={iconValue}
                onClick={() => handleSelect(item.name, item.library)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 8px",
                  border: isSelected ? "2px solid #1890ff" : "1px solid #d9d9d9",
                  borderRadius: 4,
                  cursor: "pointer",
                  backgroundColor: isSelected ? "#e6f7ff" : "#fff",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#1890ff";
                    e.currentTarget.style.backgroundColor = "#f0f8ff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#d9d9d9";
                    e.currentTarget.style.backgroundColor = "#fff";
                  }
                }}
              >
                <IconComponent style={{ fontSize: 24, marginBottom: 4 }} />
                <span
                  style={{
                    fontSize: 10,
                    color: "#666",
                    textAlign: "center",
                    wordBreak: "break-word",
                    lineHeight: 1.2,
                  }}
                >
                  {item.name.replace(/([A-Z])/g, " $1").trim()}
                </span>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
};

