'use client';

import React, { useState } from "react";
import { Layout, Upload, Button, Table, Spin, Alert, Card, Row, Col, Typography, Divider, Progress } from "antd";
import { UploadOutlined, DownloadOutlined, BookOutlined, FileTextOutlined } from "@ant-design/icons";
// For App Router, we use Next.js's built-in CSS import support
// Remove the CSS import and add style through tailwind or inline styles
// import 'antd/dist/reset.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

export default function Home() {
    const [file, setFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<any[]>([]);
    const [summary, setSummary] = useState<string>("");
    const [prologue, setPrologue] = useState<string>("");
    const [downloadLink, setDownloadLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [apiTest, setApiTest] = useState<string>("");
    const [analysisStage, setAnalysisStage] = useState<string>("");
    const [progress, setProgress] = useState<number>(0);

    const handleFileChange = (info: any) => {
        if (info.file.status === "done") {
            setFile(info.file.originFileObj);
        }
    };

    const handleUpload = async () => {
        if (!file) return alert("Please select a file first!");
        setLoading(true);
        
        // Reset states
        setAnalysis([]);
        setSummary("");
        setPrologue("");
        setDownloadLink(null);
        
        // Start progress animation
        setProgress(0);
        setAnalysisStage("Uploading file...");
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) {
                    clearInterval(progressInterval);
                    return 90;
                }
                return prev + 10;
            });
            
            // Update the stage text based on progress
            if (progress < 20) setAnalysisStage("Uploading file...");
            else if (progress < 40) setAnalysisStage("Extracting text...");
            else if (progress < 60) setAnalysisStage("Analyzing content...");
            else if (progress < 80) setAnalysisStage("Generating insights...");
            else setAnalysisStage("Finalizing report...");
            
        }, 1500);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log("API Response:", data);
            
            // Set progress to 100% when complete
            clearInterval(progressInterval);
            setProgress(100);
            setAnalysisStage("Analysis complete!");
            
            if (data.analysis) {
                // Handle full analysis response
                setAnalysis(data.analysis);
                setSummary(data.summary || "");
                setPrologue(data.prologue || "");
                setDownloadLink(data.downloadLink);
            } else if (data.success) {
                // Handle simplified test response
                setAnalysis([{
                    Parameter: "File Upload",
                    Score: 10,
                    Justification: `File successfully uploaded: ${data.fileName || file.name} (${data.fileSize || file.size} bytes)`
                }]);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (error) {
            console.error("Error:", error);
            clearInterval(progressInterval);
            setProgress(100);
            setAnalysisStage("Analysis failed!");
            alert(`Analysis failed! ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const testApi = async () => {
        try {
            setApiTest("Testing API...");
            const response = await fetch("/api/test");
            const data = await response.json();
            setApiTest(`API response: ${JSON.stringify(data)}`);
        } catch (error) {
            setApiTest(`API test failed: ${error}`);
        }
    };

    const columns = [
        { title: "Parameter", dataIndex: "Parameter", key: "Parameter" },
        { title: "Score", dataIndex: "Score", key: "Score", align: "center" as const,
          render: (score: number) => (
            <div>
              <Progress 
                type="circle" 
                percent={score * 10} 
                width={50} 
                format={() => score} 
                strokeColor={
                  score >= 8 ? '#52c41a' : // Green for high scores
                  score >= 6 ? '#faad14' : // Yellow for medium scores
                  '#f5222d'                // Red for low scores
                }
              />
            </div>
          )
        },
        { title: "Justification", dataIndex: "Justification", key: "Justification" },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ 
                backgroundColor: '#1890ff', 
                color: '#fff', 
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 20px'
            }}>
                <BookOutlined style={{ fontSize: 24, marginRight: 10 }} />
                <h1 style={{ margin: 0 }}>📖 eBook AI Analyzer</h1>
            </Header>
            
            <Content style={{ padding: '20px' }}>
                <Row justify="center" gutter={[0, 24]}>
                    <Col xs={24} sm={20} md={16} lg={12} xl={10}>
                        <Card 
                            title={
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <FileTextOutlined style={{ marginRight: 8 }} />
                                    <span>Upload Your eBook</span>
                                </div>
                            } 
                            bordered
                            hoverable
                            className="custom-card"
                            style={{ 
                                marginBottom: '20px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px'
                            }}
                        >
                            <Upload 
                                beforeUpload={(file) => {
                                    setFile(file); // Set the file state
                                    return false; // Prevent automatic upload
                                }} 
                                onChange={handleFileChange} 
                                accept="application/pdf"
                                maxCount={1}
                                showUploadList={true}
                            >
                                <Button 
                                    icon={<UploadOutlined />} 
                                    type="primary"
                                    ghost
                                    className={!file ? "pulse" : ""}
                                    style={{ width: '100%', height: '50px' }}
                                >
                                    Click to Upload PDF
                                </Button>
                            </Upload>
                            
                            <Button
                                onClick={handleUpload}
                                loading={loading}
                                type="primary"
                                className="mt-4"
                                style={{ 
                                    width: '100%', 
                                    marginTop: '15px',
                                    height: '50px',
                                    fontSize: '16px'
                                }}
                                disabled={!file}
                            >
                                {loading ? `${analysisStage}` : "Analyze eBook"}
                            </Button>
                            
                            {loading && (
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <Progress percent={progress} status="active" />
                                    <p style={{ marginTop: '10px', color: '#1890ff' }}>{analysisStage}</p>
                                </div>
                            )}
                            
                            <Button 
                                onClick={testApi}
                                type="link"
                                style={{ width: '100%', marginTop: '10px' }}
                            >
                                Test API Connection
                            </Button>
                            
                            {apiTest && (
                                <Alert message={apiTest} type="info" showIcon style={{ marginTop: '10px' }} />
                            )}
                        </Card>
                    </Col>
                </Row>

                {analysis?.length > 0 && (
                    <Row justify="center" gutter={[0, 24]}>
                        <Col xs={24} sm={22} md={20} lg={18} xl={16}>
                            <Card 
                                title={
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <BookOutlined style={{ marginRight: 8 }} />
                                        <span>Analysis Report</span>
                                    </div>
                                }
                                className="custom-card fade-in"
                                style={{ 
                                    marginTop: '20px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    borderRadius: '8px',
                                }}
                                bordered
                                hoverable
                            >
                                {summary && (
                                    <div className="book-summary fade-in" style={{ marginBottom: '20px' }}>
                                        <Title level={4}>Book Summary</Title>
                                        <Paragraph>{summary}</Paragraph>
                                        <Divider />
                                    </div>
                                )}
                                
                                {prologue && (
                                    <div className="book-prologue slide-in" style={{ marginBottom: '20px' }}>
                                        <Title level={4}>Compelling Prologue</Title>
                                        <Paragraph>{prologue}</Paragraph>
                                        <Divider />
                                    </div>
                                )}
                                
                                <Title level={4}>Analysis Scores</Title>
                                <Table 
                                    columns={columns} 
                                    dataSource={analysis} 
                                    pagination={false} 
                                    rowKey="Parameter"
                                    style={{ marginBottom: '20px' }}
                                />

                                {downloadLink && (
                                    <Button 
                                        href={downloadLink} 
                                        download 
                                        type="primary" 
                                        icon={<DownloadOutlined />}
                                        style={{ marginTop: '15px' }}
                                    >
                                        Download CSV Report
                                    </Button>
                                )}
                            </Card>
                        </Col>
                    </Row>
                )}

                {analysis.length === 0 && !loading && (
                    <Row justify="center">
                        <Col xs={24} sm={18} md={16} lg={14} xl={12}>
                            <Alert 
                                message="Get started by uploading a PDF to analyze." 
                                description="Our AI will analyze your eBook and provide detailed insights on readability, content quality, structure, and more." 
                                type="info" 
                                showIcon 
                                style={{ marginTop: '30px' }}
                            />
                        </Col>
                    </Row>
                )}
            </Content>
            
            <Footer style={{ textAlign: 'center', background: '#f0f2f5' }}>
                eBook AI Analyzer ©{new Date().getFullYear()} - Powered by Next.js and OpenAI
            </Footer>
        </Layout>
    );
}