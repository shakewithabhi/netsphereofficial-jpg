import { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Typography, message, Spin, Space, Row, Col } from 'antd';
import { SaveOutlined, MoneyCollectOutlined } from '@ant-design/icons';
import { adminApi, type AdSettings } from '../../api/admin';

const { Title, Text } = Typography;

export default function AdSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unwrap = (res: any) => res.data?.data ?? res.data;
    adminApi.getAdSettings()
      .then((res) => {
        const settings = unwrap(res);
        form.setFieldsValue(settings);
      })
      .catch(() => {
        message.error('Failed to load ad settings');
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const payload: AdSettings = {
        ads_enabled: values.ads_enabled ?? false,
        android_banner_ad_unit_id: values.android_banner_ad_unit_id ?? '',
        android_interstitial_ad_unit_id: values.android_interstitial_ad_unit_id ?? '',
        android_rewarded_ad_unit_id: values.android_rewarded_ad_unit_id ?? '',
        web_adsense_client_id: values.web_adsense_client_id ?? '',
        web_banner_slot_id: values.web_banner_slot_id ?? '',
        web_sidebar_slot_id: values.web_sidebar_slot_id ?? '',
        ad_frequency: values.ad_frequency ?? 5,
      };
      await adminApi.updateAdSettings(payload);
      message.success('Ad settings saved');
    } catch {
      message.error('Failed to save ad settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><MoneyCollectOutlined /> Ad Settings</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </Space>

      <Form form={form} layout="vertical">
        <Row gutter={[24, 0]}>
          <Col xs={24} lg={12}>
            <Card title="General" style={{ marginBottom: 16 }}>
              <Form.Item
                label="Ads Enabled"
                name="ads_enabled"
                valuePropName="checked"
                extra="When enabled, ads will be shown to users across the platform."
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label="Ad Frequency"
                name="ad_frequency"
                extra="Show interstitial ad every N downloads."
              >
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card title="Android Ad Units (AdMob)" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Configure AdMob ad unit IDs for the Android app.
              </Text>
              <Form.Item label="Banner (Home/Files)" name="android_banner_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Interstitial (Download)" name="android_interstitial_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Interstitial (App Launch)" name="android_launch_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Interstitial (Pre-Preview)" name="android_preview_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Rewarded (Extra Storage)" name="android_rewarded_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Rewarded (Speed Boost)" name="android_speed_boost_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Native (File List)" name="android_native_file_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Native (Explore Feed)" name="android_native_explore_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
            </Card>

            <Card title="iOS Ad Units (AdMob)" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Configure AdMob ad unit IDs for the iOS app.
              </Text>
              <Form.Item label="Banner (Home/Files)" name="ios_banner_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Interstitial (App Launch)" name="ios_launch_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Interstitial (Pre-Preview)" name="ios_preview_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Rewarded (Speed Boost)" name="ios_speed_boost_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
              <Form.Item label="Native (Explore Feed)" name="ios_native_explore_ad_unit_id">
                <Input placeholder="ca-app-pub-xxxxx/yyyyy" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Web Ad Settings (AdSense)" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Configure Google AdSense settings for the web app.
              </Text>
              <Form.Item label="AdSense Client ID" name="web_adsense_client_id">
                <Input placeholder="ca-pub-xxxxx" />
              </Form.Item>
              <Form.Item label="Header Banner Slot" name="web_banner_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Sidebar Slot" name="web_sidebar_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="In-Feed Slot (File List)" name="web_infeed_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Share Page Banner Slot" name="web_share_banner_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Share Page Sidebar Slot" name="web_share_sidebar_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Explore Feed Slot" name="web_explore_feed_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Video Player Banner Slot" name="web_video_player_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
              <Form.Item label="Landing Page Slot" name="web_landing_slot_id">
                <Input placeholder="1234567890" />
              </Form.Item>
            </Card>

            <Card title="Ad Behavior" style={{ marginBottom: 16 }}>
              <Form.Item
                label="Preview Ad Frequency"
                name="preview_ad_frequency"
                extra="Show interstitial before every Nth file preview."
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Native Ad Interval (File List)"
                name="native_ad_interval"
                extra="Insert native ad every N items in file lists."
              >
                <InputNumber min={3} max={20} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Native Ad Interval (Explore)"
                name="explore_ad_interval"
                extra="Insert native ad every N posts in explore feed."
              >
                <InputNumber min={3} max={20} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Speed Boost Duration (minutes)"
                name="speed_boost_duration"
                extra="How long the speed boost lasts after watching a rewarded ad."
              >
                <InputNumber min={5} max={120} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Video Ad Countdown (seconds)"
                name="video_ad_countdown"
                extra="Countdown before shared video plays for non-logged-in users."
              >
                <InputNumber min={3} max={15} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Download Ad Countdown (seconds)"
                name="download_ad_countdown"
                extra="Countdown before download starts (every Nth download for free users)."
              >
                <InputNumber min={3} max={10} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Download Ad Frequency"
                name="download_ad_frequency"
                extra="Show download ad every Nth download."
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
