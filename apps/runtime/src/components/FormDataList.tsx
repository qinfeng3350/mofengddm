import { useQuery } from "@tanstack/react-query";
import { Table, Card, Spin, Button, Space, Tag, message, Popconfirm } from "antd";
import { EyeOutlined, DeleteOutlined } from "@ant-design/icons";
import { formDataApi } from "@/api/formData";
import type { FormDataResponse } from "@/api/formData";
import dayjs from "dayjs";
import { useState } from "react";

interface FormDataListProps {
  formId: string;
  onView?: (recordId: string) => void;
}

export const FormDataList = ({ formId, onView }: FormDataListProps) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["formData", formId],
    queryFn: () => formDataApi.getListByForm(formId),
  });

  const handleDelete = async (recordId: string) => {
    try {
      setSelectedRecordId(recordId);
      await formDataApi.delete(recordId);
      message.success("删除成功");
      refetch();
    } catch (error) {
      console.error("删除失败:", error);
      message.error("删除失败，请重试");
    } finally {
      setSelectedRecordId(null);
    }
  };

  const columns = [
    {
      title: "记录ID",
      dataIndex: "recordId",
      key: "recordId",
      width: 200,
      ellipsis: true,
    },
    {
      title: "提交人",
      dataIndex: "submitterName",
      key: "submitterName",
      width: 120,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          submitted: "green",
          draft: "orange",
          rejected: "red",
        };
        return <Tag color={colorMap[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "提交时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      fixed: "right" as const,
      render: (_: unknown, record: FormDataResponse) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onView?.(record.recordId)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.recordId)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              loading={selectedRecordId === record.recordId}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card title="表单数据列表" style={{ margin: "0 auto", maxWidth: 1200, padding: 24 }}>
      <Table
        columns={columns}
        dataSource={data || []}
        rowKey="recordId"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        scroll={{ x: 800 }}
      />
    </Card>
  );
};

