import { Layout } from "antd";
import {
  FieldLibraryPanel,
  DesignerCanvas,
  PropertyPanel,
  FormDesignerDndProvider,
  DesignerHeader,
} from "@/modules/form-designer";
import "./styles/App.css";

const { Header, Sider, Content } = Layout;

function App() {
  return (
    <FormDesignerDndProvider>
      <Layout className="designer-layout">
        <Header className="designer-header">
          <DesignerHeader />
        </Header>
        <Layout>
          <Sider width={320} className="designer-sider scrollable">
            <FieldLibraryPanel />
          </Sider>
          <Content className="designer-canvas">
            <DesignerCanvas />
          </Content>
          <Sider width={340} className="designer-sider scrollable">
            <PropertyPanel />
          </Sider>
        </Layout>
      </Layout>
    </FormDesignerDndProvider>
  );
}

export default App;
