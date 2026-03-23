import React, { useState, useEffect } from "react";
import { Layout, Button, Typography, Row, Col, Card, Space, Avatar, Tag, Statistic, Divider } from "antd";
import {
  RocketOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  TeamOutlined,
  AppstoreOutlined,
  CloudOutlined,
  MobileOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  StarOutlined,
  GlobalOutlined,
  PhoneOutlined,
  MailOutlined,
  WechatOutlined,
  GithubOutlined,
  LinkedinOutlined,
  TwitterOutlined,
  MenuOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import "./LandingPage.css";

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;

export const LandingPage = () => {
  usePageTitle("墨枫低代码平台 - 官网首页");
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: <RocketOutlined style={{ fontSize: 48, color: "#1890ff" }} />,
      title: "快速开发",
      description: "拖拽式表单设计，零代码构建应用，让业务人员也能快速搭建系统",
    },
    {
      icon: <ThunderboltOutlined style={{ fontSize: 48, color: "#52c41a" }} />,
      title: "高性能",
      description: "基于现代化技术栈，支持大规模并发，响应速度快，体验流畅",
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 48, color: "#faad14" }} />,
      title: "安全可靠",
      description: "企业级安全保障，数据加密存储，权限精细控制，让数据更安全",
    },
    {
      icon: <TeamOutlined style={{ fontSize: 48, color: "#722ed1" }} />,
      title: "协作高效",
      description: "支持多租户、多部门协作，流程审批、消息通知，提升团队效率",
    },
    {
      icon: <AppstoreOutlined style={{ fontSize: 48, color: "#eb2f96" }} />,
      title: "丰富组件",
      description: "内置50+表单组件，支持自定义扩展，满足各种业务场景需求",
    },
    {
      icon: <CloudOutlined style={{ fontSize: 48, color: "#13c2c2" }} />,
      title: "云端部署",
      description: "支持SaaS部署和私有化部署，灵活选择，满足不同企业需求",
    },
  ];

  const advantages = [
    { text: "零代码开发，业务人员也能快速上手" },
    { text: "可视化设计，所见即所得" },
    { text: "丰富的模板库，开箱即用" },
    { text: "强大的工作流引擎，支持复杂业务流程" },
    { text: "灵活的权限体系，精细到字段级别" },
    { text: "完善的API接口，支持第三方集成" },
    { text: "移动端适配，随时随地办公" },
    { text: "7x24小时技术支持" },
  ];

  const useCases = [
    {
      title: "OA办公系统",
      description: "人事管理、考勤打卡、审批流程、公告通知等",
      icon: <AppstoreOutlined style={{ fontSize: 32 }} />,
    },
    {
      title: "CRM客户管理",
      description: "客户信息管理、销售跟进、合同管理、数据分析",
      icon: <TeamOutlined style={{ fontSize: 32 }} />,
    },
    {
      title: "进销存管理",
      description: "商品管理、库存管理、采购管理、销售管理",
      icon: <CloudOutlined style={{ fontSize: 32 }} />,
    },
    {
      title: "项目管理",
      description: "任务分配、进度跟踪、资源管理、报表统计",
      icon: <RocketOutlined style={{ fontSize: 32 }} />,
    },
  ];

  const testimonials = [
    {
      name: "张总",
      role: "某科技公司CEO",
      content: "使用墨枫低代码平台后，我们的开发效率提升了10倍，业务人员也能自主搭建系统了。",
      avatar: "张",
    },
    {
      name: "李经理",
      role: "某制造企业IT负责人",
      content: "平台功能强大，界面友好，技术支持也很及时，是我们数字化转型的好帮手。",
      avatar: "李",
    },
    {
      name: "王主管",
      role: "某零售企业运营总监",
      content: "零代码开发让我们快速响应业务需求，不再需要等待IT部门排期，大大提升了效率。",
      avatar: "王",
    },
  ];

  return (
    <Layout className="landing-page">
      {/* 导航栏 */}
      <Header className={`landing-header ${scrolled ? "scrolled" : ""}`}>
        <div className="header-container">
          <div className="logo">
            <RocketOutlined style={{ fontSize: 32, color: "#1890ff", marginRight: 12 }} />
            <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
              墨枫低代码平台
            </Title>
          </div>
          <nav className={`nav-menu ${mobileMenuOpen ? "open" : ""}`}>
            <a href="#features">功能特性</a>
            <a href="#advantages">产品优势</a>
            <a href="#cases">应用场景</a>
            <a href="#testimonials">客户评价</a>
            <a href="#pricing">价格方案</a>
            <a href="#contact">联系我们</a>
          </nav>
          <div className="header-actions">
            <Button type="text" onClick={() => navigate("/login")}>
              登录
            </Button>
            <Button type="primary" size="large" onClick={() => navigate("/login")}>
              免费试用
            </Button>
            <Button
              type="text"
              className="mobile-menu-btn"
              icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            />
          </div>
        </div>
      </Header>

      <Content>
        {/* Hero 区域 */}
        <section className="hero-section">
          <div className="hero-container">
            <div className="hero-content">
              <Tag color="blue" style={{ marginBottom: 24, fontSize: 14, padding: "4px 12px" }}>
                <ThunderboltOutlined /> 新一代低代码平台
              </Tag>
              <Title level={1} className="hero-title">
                让应用开发更简单
                <br />
                让业务创新更快速
              </Title>
              <Paragraph className="hero-description">
                墨枫低代码平台，零代码拖拽式开发，让业务人员也能快速构建企业级应用。
                <br />
                无需编程，可视化设计，快速上线，助力企业数字化转型。
              </Paragraph>
              <Space size="large" style={{ marginTop: 32 }}>
                <Button type="primary" size="large" icon={<RocketOutlined />} onClick={() => navigate("/login")}>
                  立即开始
                </Button>
                <Button size="large" icon={<AppstoreOutlined />} onClick={() => navigate("/login")}>
                  免费试用
                </Button>
              </Space>
              <div className="hero-stats" style={{ marginTop: 48 }}>
                <Row gutter={32}>
                  <Col span={6}>
                    <Statistic title="企业用户" value={1000} suffix="+" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="应用数量" value={5000} suffix="+" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="日活用户" value={50000} suffix="+" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="满意度" value={98} suffix="%" />
                  </Col>
                </Row>
              </div>
            </div>
            <div className="hero-image">
              <div className="hero-placeholder">
                <AppstoreOutlined style={{ fontSize: 200, color: "#1890ff", opacity: 0.3 }} />
              </div>
            </div>
          </div>
        </section>

        {/* 功能特性 */}
        <section id="features" className="features-section">
          <div className="section-container">
            <div className="section-header">
              <Title level={2}>强大的功能特性</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                提供全方位的低代码开发能力，满足企业各种业务场景需求
              </Paragraph>
            </div>
            <Row gutter={[32, 32]} style={{ marginTop: 48 }}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <Card className="feature-card" hoverable>
                    <div className="feature-icon">{feature.icon}</div>
                    <Title level={4} style={{ marginTop: 24 }}>
                      {feature.title}
                    </Title>
                    <Paragraph type="secondary">{feature.description}</Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* 产品优势 */}
        <section id="advantages" className="advantages-section">
          <div className="section-container">
            <Row gutter={[48, 48]} align="middle">
              <Col xs={24} lg={12}>
                <Title level={2}>为什么选择墨枫？</Title>
                <Paragraph style={{ fontSize: 16, marginTop: 24 }}>
                  墨枫低代码平台致力于为企业提供最优质的低代码开发体验，
                  让每个企业都能快速构建自己的数字化系统。
                </Paragraph>
                <div className="advantages-list" style={{ marginTop: 32 }}>
                  {advantages.map((item, index) => (
                    <div key={index} className="advantage-item">
                      <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 20, marginRight: 12 }} />
                      <Text style={{ fontSize: 16 }}>{item.text}</Text>
                    </div>
                  ))}
                </div>
                <Button type="primary" size="large" style={{ marginTop: 32 }} onClick={() => navigate("/login")}>
                  了解更多 <ArrowRightOutlined />
                </Button>
              </Col>
              <Col xs={24} lg={12}>
                <div className="advantages-image">
                  <div className="advantages-placeholder">
                    <ThunderboltOutlined style={{ fontSize: 200, color: "#1890ff", opacity: 0.3 }} />
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </section>

        {/* 应用场景 */}
        <section id="cases" className="cases-section">
          <div className="section-container">
            <div className="section-header">
              <Title level={2}>丰富的应用场景</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                适用于各行各业，满足不同规模企业的业务需求
              </Paragraph>
            </div>
            <Row gutter={[24, 24]} style={{ marginTop: 48 }}>
              {useCases.map((useCase, index) => (
                <Col xs={24} sm={12} lg={6} key={index}>
                  <Card className="case-card" hoverable>
                    <div className="case-icon">{useCase.icon}</div>
                    <Title level={4} style={{ marginTop: 16 }}>
                      {useCase.title}
                    </Title>
                    <Paragraph type="secondary">{useCase.description}</Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* 客户评价 */}
        <section id="testimonials" className="testimonials-section">
          <div className="section-container">
            <div className="section-header">
              <Title level={2}>客户评价</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                听听客户怎么说
              </Paragraph>
            </div>
            <Row gutter={[24, 24]} style={{ marginTop: 48 }}>
              {testimonials.map((testimonial, index) => (
                <Col xs={24} lg={8} key={index}>
                  <Card className="testimonial-card">
                    <div style={{ marginBottom: 16 }}>
                      {[...Array(5)].map((_, i) => (
                        <StarOutlined key={i} style={{ color: "#faad14", fontSize: 16 }} />
                      ))}
                    </div>
                    <Paragraph style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 24 }}>
                      "{testimonial.content}"
                    </Paragraph>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <Avatar size={48} style={{ backgroundColor: "#1890ff", marginRight: 12 }}>
                        {testimonial.avatar}
                      </Avatar>
                      <div>
                        <Text strong style={{ display: "block" }}>
                          {testimonial.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {testimonial.role}
                        </Text>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* 价格方案 */}
        <section id="pricing" className="pricing-section">
          <div className="section-container">
            <div className="section-header">
              <Title level={2}>灵活的价格方案</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                选择适合您的方案，支持按需升级
              </Paragraph>
            </div>
            <Row gutter={[24, 24]} style={{ marginTop: 48 }}>
              <Col xs={24} sm={12} lg={8}>
                <Card className="pricing-card">
                  <Title level={3}>基础版</Title>
                  <div className="pricing-price">
                    <Text style={{ fontSize: 48, fontWeight: "bold" }}>免费</Text>
                  </div>
                  <Divider />
                  <div className="pricing-features">
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>最多10个应用</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>基础表单组件</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>社区支持</Text>
                    </div>
                  </div>
                  <Button block size="large" style={{ marginTop: 24 }}>
                    立即使用
                  </Button>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card className="pricing-card featured">
                  <Tag color="blue" style={{ position: "absolute", top: 16, right: 16 }}>
                    推荐
                  </Tag>
                  <Title level={3}>专业版</Title>
                  <div className="pricing-price">
                    <Text style={{ fontSize: 48, fontWeight: "bold" }}>¥999</Text>
                    <Text type="secondary" style={{ fontSize: 16 }}>/月</Text>
                  </div>
                  <Divider />
                  <div className="pricing-features">
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>无限应用数量</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>全部表单组件</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>工作流引擎</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>API接口</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>技术支持</Text>
                    </div>
                  </div>
                  <Button type="primary" block size="large" style={{ marginTop: 24 }}>
                    立即购买
                  </Button>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card className="pricing-card">
                  <Title level={3}>企业版</Title>
                  <div className="pricing-price">
                    <Text style={{ fontSize: 48, fontWeight: "bold" }}>定制</Text>
                  </div>
                  <Divider />
                  <div className="pricing-features">
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>专业版全部功能</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>私有化部署</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>专属技术支持</Text>
                    </div>
                    <div className="pricing-feature">
                      <CheckCircleOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                      <Text>定制开发</Text>
                    </div>
                  </div>
                  <Button block size="large" style={{ marginTop: 24 }}>
                    联系销售
                  </Button>
                </Card>
              </Col>
            </Row>
          </div>
        </section>

        {/* CTA 区域 */}
        <section className="cta-section">
          <div className="section-container">
            <Card className="cta-card">
              <Title level={2} style={{ color: "#fff", textAlign: "center" }}>
                准备好开始了吗？
              </Title>
              <Paragraph style={{ color: "#fff", textAlign: "center", fontSize: 18, marginTop: 16 }}>
                立即注册，免费试用30天，无需信用卡
              </Paragraph>
              <div style={{ textAlign: "center", marginTop: 32 }}>
                <Space size="large">
                  <Button type="primary" size="large" ghost onClick={() => navigate("/login")}>
                    免费试用
                  </Button>
                  <Button size="large" ghost style={{ color: "#fff", borderColor: "#fff" }} onClick={() => navigate("/login")}>
                    联系销售
                  </Button>
                </Space>
              </div>
            </Card>
          </div>
        </section>
      </Content>

      {/* 页脚 */}
      <Footer id="contact" className="landing-footer">
        <div className="footer-container">
          <Row gutter={[48, 48]}>
            <Col xs={24} sm={12} lg={6}>
              <div className="footer-section">
                <Title level={4} style={{ color: "#fff", marginBottom: 16 }}>
                  <RocketOutlined style={{ marginRight: 8 }} />
                  墨枫低代码平台
                </Title>
                <Paragraph style={{ color: "rgba(255,255,255,0.7)" }}>
                  让应用开发更简单，让业务创新更快速
                </Paragraph>
                <Space size="large" style={{ marginTop: 16 }}>
                  <a href="#" className="social-link">
                    <GithubOutlined />
                  </a>
                  <a href="#" className="social-link">
                    <WechatOutlined />
                  </a>
                  <a href="#" className="social-link">
                    <LinkedinOutlined />
                  </a>
                  <a href="#" className="social-link">
                    <TwitterOutlined />
                  </a>
                </Space>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="footer-section">
                <Title level={5} style={{ color: "#fff", marginBottom: 16 }}>
                  产品
                </Title>
                <ul className="footer-links">
                  <li>
                    <a href="#features">功能特性</a>
                  </li>
                  <li>
                    <a href="#advantages">产品优势</a>
                  </li>
                  <li>
                    <a href="#cases">应用场景</a>
                  </li>
                  <li>
                    <a href="#pricing">价格方案</a>
                  </li>
                </ul>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="footer-section">
                <Title level={5} style={{ color: "#fff", marginBottom: 16 }}>
                  支持
                </Title>
                <ul className="footer-links">
                  <li>
                    <a href="#">帮助文档</a>
                  </li>
                  <li>
                    <a href="#">API文档</a>
                  </li>
                  <li>
                    <a href="#">视频教程</a>
                  </li>
                  <li>
                    <a href="#">社区论坛</a>
                  </li>
                </ul>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <div className="footer-section">
                <Title level={5} style={{ color: "#fff", marginBottom: 16 }}>
                  联系我们
                </Title>
                <ul className="footer-links">
                  <li>
                    <PhoneOutlined style={{ marginRight: 8 }} />
                    <a href="tel:400-123-4567">400-123-4567</a>
                  </li>
                  <li>
                    <MailOutlined style={{ marginRight: 8 }} />
                    <a href="mailto:contact@mofeng.com">contact@mofeng.com</a>
                  </li>
                  <li>
                    <WechatOutlined style={{ marginRight: 8 }} />
                    <span>微信客服</span>
                  </li>
                  <li>
                    <GlobalOutlined style={{ marginRight: 8 }} />
                    <span>工作日 9:00-18:00</span>
                  </li>
                </ul>
              </div>
            </Col>
          </Row>
          <Divider style={{ borderColor: "rgba(255,255,255,0.2)" }} />
          <div className="footer-bottom">
            <Text style={{ color: "rgba(255,255,255,0.7)" }}>
              © 2024 墨枫低代码平台. All rights reserved.
            </Text>
            <Space>
              <a href="#" style={{ color: "rgba(255,255,255,0.7)" }}>
                隐私政策
              </a>
              <a href="#" style={{ color: "rgba(255,255,255,0.7)" }}>
                服务条款
              </a>
            </Space>
          </div>
        </div>
      </Footer>
    </Layout>
  );
};

