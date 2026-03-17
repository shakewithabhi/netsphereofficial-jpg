import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Switch, Button, Typography, message, Spin, Divider, Space, Row, Col, Alert } from 'antd';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { adminApi, type PlatformSettings } from '../../api/admin';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unwrap = (res: any) => res.data?.data ?? res.data;
    adminApi.getSettings()
      .then((res) => {
        const settings = unwrap(res);
        form.setFieldsValue({
          ...settings,
          default_storage_limit_free: Math.round((settings.default_storage_limit_free || 0) / (1024 * 1024 * 1024)),
          default_storage_limit_pro: Math.round((settings.default_storage_limit_pro || 0) / (1024 * 1024 * 1024)),
          default_storage_limit_premium: Math.round((settings.default_storage_limit_premium || 0) / (1024 * 1024 * 1024)),
        });
      })
      .catch(() => {
        message.error('Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const payload: PlatformSettings = {
        default_storage_limit_free: values.default_storage_limit_free * 1024 * 1024 * 1024,
        default_storage_limit_pro: values.default_storage_limit_pro * 1024 * 1024 * 1024,
        default_storage_limit_premium: values.default_storage_limit_premium * 1024 * 1024 * 1024,
        max_upload_size_mb: values.max_upload_size_mb,
        maintenance_mode: values.maintenance_mode ?? false,
        require_approval: values.require_approval ?? false,
        allow_registration: values.allow_registration ?? true,
      };
      await adminApi.updateSettings(payload);
      message.success('Settings saved');
    } catch {
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><SettingOutlined /> Platform Settings</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </Space>

      <Form form={form} layout="vertical">
        <Row gutter={[24, 0]}>
          <Col xs={24} lg={12}>
            <Card title="Default Storage Limits" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Default storage allocated to new users by plan.
              </Text>
              <Form.Item label="Free Plan (GB)" name="default_storage_limit_free">
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Pro Plan (GB)" name="default_storage_limit_pro">
                <InputNumber min={1} max={5000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="Premium Plan (GB)" name="default_storage_limit_premium">
                <InputNumber min={1} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Upload Settings" style={{ marginBottom: 16 }}>
              <Form.Item label="Max Upload Size (MB)" name="max_upload_size_mb">
                <InputNumber min={1} max={10240} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card title="Registration & Access" style={{ marginBottom: 16 }}>
              <Form.Item
                label="Allow Registration"
                name="allow_registration"
                valuePropName="checked"
                extra="When disabled, no new users can sign up."
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="Require Approval"
                name="require_approval"
                valuePropName="checked"
                extra="New registrations require admin approval before access."
              >
                <Switch />
              </Form.Item>
            </Card>

            <Card title="Maintenance" style={{ marginBottom: 16 }}>
              <Form.Item
                label="Maintenance Mode"
                name="maintenance_mode"
                valuePropName="checked"
                extra="When enabled, regular users cannot access the platform."
              >
                <Switch />
              </Form.Item>
              {form.getFieldValue('maintenance_mode') && (
                <Alert
                  message="Maintenance mode is active"
                  description="Regular users will see a maintenance page. Admin access is unaffected."
                  type="warning"
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
