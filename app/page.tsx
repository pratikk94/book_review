'use client';

import React, { useState, useRef } from "react";
import { Layout, Upload, Button, Table, Spin, Alert, Card, Row, Col, Typography, Divider, Progress } from "antd";
import { UploadOutlined, DownloadOutlined, BookOutlined, FileTextOutlined, EditOutlined, CommentOutlined, FileImageOutlined, FilePdfOutlined } from "@ant-design/icons";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
    const [constructiveCriticism, setConstructiveCriticism] = useState<string>("");
    const [downloadLink, setDownloadLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [apiTest, setApiTest] = useState<string>("");
    const [analysisStage, setAnalysisStage] = useState<string>("");
    const [progress, setProgress] = useState<number>(0);
    const [capturingPdf, setCapturingPdf] = useState(false);
    const [pdfSuccess, setPdfSuccess] = useState(false);
    
    // Refs for capturing PDF content
    const editorialContentRef = useRef<HTMLDivElement>(null);
    const analysisContentRef = useRef<HTMLDivElement>(null);
    
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
        setConstructiveCriticism("");
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
                setConstructiveCriticism(data.constructiveCriticism || "");
                setDownloadLink(data.downloadLink);
            } else if (data.success) {
                // Handle simplified test response
                setAnalysis([{
                    Parameter: "File Upload",
                    Score: 5, // Use 5 for the maximum score on our scale
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
                percent={score * 20} 
                width={50} 
                format={() => score} 
                strokeColor={
                  score >= 4 ? '#52c41a' : // Green for high scores (4-5)
                  score >= 3 ? '#faad14' : // Yellow for medium scores (3)
                  '#f5222d'                // Red for low scores (1-2)
                }
              />
            </div>
          )
        },
        { title: "Justification", dataIndex: "Justification", key: "Justification" },
    ];

    // Calculate cumulative score and get improvement suggestions
    const calculateResults = (analysisData: any[]) => {
        // Skip if analysis failed or data is not in expected format
        if (!analysisData || analysisData.length === 0 || analysisData[0]?.Parameter === "Analysis Failed") {
            return {
                totalScore: 0,
                maxPossibleScore: 0,
                percentage: 0,
                strengths: [],
                improvements: []
            };
        }

        // Calculate total score
        const totalScore = analysisData.reduce((sum, item) => sum + (item.Score || 0), 0);
        const maxPossibleScore = analysisData.length * 5; // 5 is max score per item
        const percentage = Math.round((totalScore / maxPossibleScore) * 100);
        
        // Identify strengths (high scores) and areas for improvement (low scores)
        const strengths = analysisData
            .filter(item => item.Score >= 4)
            .map(item => item.Parameter);
            
        const improvements = analysisData
            .filter(item => item.Score <= 2)
            .map(item => ({
                area: item.Parameter,
                score: item.Score,
                justification: item.Justification
            }));
            
        return { totalScore, maxPossibleScore, percentage, strengths, improvements };
    };

    const results = calculateResults(analysis);

    // Function to generate PDF screenshot
    const generatePdf = async () => {
        if (!editorialContentRef.current || !analysisContentRef.current) return;
        
        setCapturingPdf(true);
        try {
            // Set up PDF document
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4'
            });
            
            const fileTitle = file?.name || "eBook Analysis";
            
            // Add title
            pdf.setFontSize(22);
            pdf.setTextColor(24, 144, 255); // Blue color
            pdf.text(`AI Analysis Report: ${fileTitle.substring(0, 30)}${fileTitle.length > 30 ? '...' : ''}`, 20, 30);
            
            // Add date
            const date = new Date().toLocaleDateString();
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100); // Gray color
            pdf.text(`Generated on: ${date}`, 20, 50);
            
            // Capture the editorial content
            if (constructiveCriticism && editorialContentRef.current) {
                const editorialCanvas = await html2canvas(editorialContentRef.current, {
                    scale: 1.5,
                    useCORS: true,
                    logging: false
                });
                
                const editorialImgData = editorialCanvas.toDataURL('image/png');
                
                // If editorial canvas is too tall, resize it
                const editorialImgProps = pdf.getImageProperties(editorialImgData);
                const editorialPdfWidth = pdf.internal.pageSize.getWidth() - 40;
                const editorialPdfHeight = (editorialImgProps.height * editorialPdfWidth) / editorialImgProps.width;
                
                // Add editorial section heading
                pdf.setFontSize(16);
                pdf.setTextColor(250, 140, 22); // Orange color
                pdf.text('Editorial Assessment', 20, 70);
                
                // Add editorial content
                pdf.addImage(editorialImgData, 'PNG', 20, 80, editorialPdfWidth, editorialPdfHeight);
                
                // Add a new page if the editorial content is too tall
                if (editorialPdfHeight > 500) {
                    pdf.addPage();
                    pdf.setFontSize(16);
                    pdf.setTextColor(24, 144, 255); // Blue color
                    pdf.text('Analysis Details', 20, 30);
                } else {
                    // If we're still on the first page
                    pdf.setFontSize(16);
                    pdf.setTextColor(24, 144, 255); // Blue color
                    pdf.text('Analysis Details', 20, 100 + editorialPdfHeight);
                }
            }
            
            // Capture the analysis content
            const analysisCanvas = await html2canvas(analysisContentRef.current, {
                scale: 1.5,
                useCORS: true,
                logging: false
            });
            
            const analysisImgData = analysisCanvas.toDataURL('image/png');
            
            const analysisImgProps = pdf.getImageProperties(analysisImgData);
            const analysisPdfWidth = pdf.internal.pageSize.getWidth() - 40;
            const analysisPdfHeight = (analysisImgProps.height * analysisPdfWidth) / analysisImgProps.width;
            
            if (constructiveCriticism) {
                // If we have editorial content, position the analysis content accordingly
                if (editorialContentRef.current) {
                    const editorialCanvas = await html2canvas(editorialContentRef.current, {
                        scale: 1.5
                    });
                    const editorialImgProps = pdf.getImageProperties(editorialCanvas.toDataURL('image/png'));
                    const editorialPdfHeight = (editorialImgProps.height * analysisPdfWidth) / editorialImgProps.width;
                    
                    if (editorialPdfHeight > 500) {
                        // If editorial pushed to new page
                        pdf.addImage(analysisImgData, 'PNG', 20, 50, analysisPdfWidth, analysisPdfHeight);
                    } else {
                        // If editorial is on first page
                        pdf.addImage(analysisImgData, 'PNG', 20, 120 + editorialPdfHeight, analysisPdfWidth, analysisPdfHeight);
                    }
                }
            } else {
                // If no editorial content, just add analysis content
                pdf.addImage(analysisImgData, 'PNG', 20, 80, analysisPdfWidth, analysisPdfHeight);
            }
            
            // Add footer
            const pageCount = pdf.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.text(`eBook AI Analyzer Report - Page ${i} of ${pageCount}`, 20, pdf.internal.pageSize.getHeight() - 10);
            }
            
            // Save the PDF
            pdf.save(`${fileTitle.replace(/\.[^/.]+$/, "")}_analysis.pdf`);
            
            setPdfSuccess(true);
        } catch (error) {
            console.error("Error generating PDF: ", error);
            alert("Failed to generate PDF report. Please try again.");
        } finally {
            setCapturingPdf(false);
        }
    };

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
                    <>
                        {/* Generate PDF Report Button */}
                        <Row justify="center" style={{ marginTop: '20px' }}>
                            <Button 
                                type="primary"
                                icon={<FilePdfOutlined />}
                                onClick={generatePdf}
                                loading={capturingPdf}
                                size="large"
                                className="pdf-button"
                                style={{
                                    height: 'auto',
                                    padding: '10px 24px',
                                    fontSize: '16px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                }}
                            >
                                {capturingPdf ? 'Generating PDF Report...' : 'Generate PDF Report with UI Screenshot'}
                            </Button>
                            
                            {pdfSuccess && (
                                <Alert
                                    message="PDF Report Generated Successfully"
                                    description="Your PDF has been saved to your downloads folder."
                                    type="success"
                                    showIcon
                                    closable
                                    onClose={() => setPdfSuccess(false)}
                                    className="pdf-success"
                                    style={{ 
                                        marginTop: '10px',
                                        width: '100%',
                                        maxWidth: '600px',
                                    }}
                                />
                            )}
                        </Row>

                        {/* Editorial Feedback Card - Separate prominent section */}
                        {constructiveCriticism && (
                            <Row justify="center" gutter={[0, 24]}>
                                <Col xs={24} sm={22} md={20} lg={18} xl={16}>
                                    <Card 
                                        title={
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <EditOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
                                                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Editorial Assessment</span>
                                            </div>
                                        }
                                        className="custom-card editorial-card fade-in"
                                        style={{ 
                                            marginTop: '20px',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                            borderRadius: '8px',
                                        }}
                                        bordered
                                        hoverable
                                    >
                                        <div ref={editorialContentRef}>
                                            <Alert
                                                message="Professional Feedback & Recommendations"
                                                description="This section provides detailed, constructive feedback about the book with actionable recommendations to enhance its quality and impact."
                                                type="warning"
                                                showIcon
                                                style={{ marginBottom: '20px' }}
                                            />
                                            
                                            {/* Key Recommendation Highlight */}
                                            <div style={{
                                                padding: '15px',
                                                background: 'rgba(250, 140, 22, 0.08)',
                                                borderRadius: '8px',
                                                marginBottom: '20px',
                                                border: '1px dashed #fa8c16'
                                            }}>
                                                <Title level={5} style={{ color: '#fa8c16', marginTop: 0 }}>EDITOR'S KEY RECOMMENDATION</Title>
                                                <Paragraph style={{ fontWeight: 500 }}>
                                                    {constructiveCriticism.split('\n')[0]}
                                                </Paragraph>
                                            </div>
                                            
                                            <div style={{ fontSize: '15px', lineHeight: '1.8' }}>
                                                {constructiveCriticism.split('\n').slice(1).map((paragraph, i) => {
                                                    // Highlight suggestions and recommendations with special formatting
                                                    const enhancedText = paragraph
                                                        .replace(/should consider|recommend|could improve|suggest|try to|focus on|needs to|must|important to|enhance|revise|develop|strengthen|add|remove|modify|prioritize/gi, match => 
                                                            `<span class="highlight-tip">${match}</span>`);
                                                    
                                                    return (
                                                        <div className="feedback-entry" key={i}>
                                                            <Paragraph
                                                                dangerouslySetInnerHTML={{ __html: enhancedText }}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </Card>
                                </Col>
                            </Row>
                        )}
                        
                        {/* Main Analysis Report Card */}
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
                                    <div ref={analysisContentRef}>
                                        {summary && (
                                            <div className="book-summary fade-in" style={{ marginBottom: '20px' }}>
                                                <Title level={4}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <BookOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                                        <span>Book Summary</span>
                                                    </div>
                                                </Title>
                                                <Paragraph style={{ fontSize: '15px', lineHeight: '1.8' }}>
                                                    {summary}
                                                </Paragraph>
                                                <Divider />
                                            </div>
                                        )}
                                        
                                        {prologue && (
                                            <div className="book-prologue slide-in" style={{ marginBottom: '20px' }}>
                                                <Title level={4}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <CommentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                                        <span>Compelling Prologue</span>
                                                    </div>
                                                </Title>
                                                <Paragraph style={{ fontSize: '15px', lineHeight: '1.8', fontStyle: 'italic' }}>
                                                    {prologue}
                                                </Paragraph>
                                                <Divider />
                                            </div>
                                        )}
                                        
                                        {/* Overall Score Section */}
                                        <div className="overall-score-section fade-in" style={{ marginBottom: '20px' }}>
                                            <Title level={4}>Overall Assessment</Title>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                                <Progress 
                                                    className="dashboard-animate"
                                                    type="dashboard" 
                                                    percent={results.percentage} 
                                                    width={120}
                                                    format={() => (
                                                        <div>
                                                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{results.totalScore}</div>
                                                            <div style={{ fontSize: '12px' }}>out of {results.maxPossibleScore}</div>
                                                        </div>
                                                    )}
                                                    strokeColor={
                                                        results.percentage >= 80 ? '#52c41a' : // Excellent
                                                        results.percentage >= 60 ? '#faad14' : // Good
                                                        '#f5222d'                             // Needs improvement
                                                    }
                                                />
                                            </div>
                                            
                                            {results.strengths.length > 0 && (
                                                <div style={{ marginBottom: '15px' }}>
                                                    <Title level={5}>Strengths</Title>
                                                    <ul>
                                                        {results.strengths.map((strength, index) => (
                                                            <li className="strength-item" key={index}>{strength}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {results.improvements.length > 0 && (
                                                <div style={{ marginBottom: '15px' }}>
                                                    <Title level={5}>Recommended Improvements</Title>
                                                    <ul>
                                                        {results.improvements.map((item, index) => (
                                                            <li className="improvement-item" key={index}>
                                                                <strong>{item.area}</strong> (Score: {item.score}/5): {item.justification}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            {/* Score interpretation */}
                                            <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '20px' }}>
                                                <Alert
                                                    message={
                                                        results.percentage >= 80 ? "Excellent" :
                                                        results.percentage >= 60 ? "Good" :
                                                        results.percentage >= 40 ? "Average" :
                                                        "Needs Improvement"
                                                    }
                                                    description={
                                                        results.percentage >= 80 ? "This eBook demonstrates exceptional quality across most parameters." :
                                                        results.percentage >= 60 ? "This eBook has good overall quality with some areas for improvement." :
                                                        results.percentage >= 40 ? "This eBook meets basic standards but has several areas that need attention." :
                                                        "This eBook requires significant improvements in multiple areas."
                                                    }
                                                    type={
                                                        results.percentage >= 80 ? "success" :
                                                        results.percentage >= 60 ? "info" :
                                                        results.percentage >= 40 ? "warning" :
                                                        "error"
                                                    }
                                                    showIcon
                                                />
                                            </div>
                                            
                                            {/* Extra guidance for low scores */}
                                            {results.percentage < 40 && (
                                                <div style={{ marginBottom: '20px' }}>
                                                    <Title level={5}>General Improvement Suggestions</Title>
                                                    <ul>
                                                        <li>Consider having the text professionally edited to improve readability and flow.</li>
                                                        <li>Check for grammatical errors and typos throughout the document.</li>
                                                        <li>Work on improving the structure with clear chapter divisions and sections.</li>
                                                        <li>Ensure formatting is consistent throughout the book.</li>
                                                        <li>Consider adding more original insights or examples to enhance content value.</li>
                                                    </ul>
                                                </div>
                                            )}
                                            
                                            <Divider />
                                        </div>
                                        
                                        <Title level={4}>Detailed Analysis</Title>
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
                                        
                                        <Button 
                                            type="primary"
                                            icon={<FilePdfOutlined />}
                                            onClick={generatePdf}
                                            loading={capturingPdf}
                                            className="pdf-button"
                                            style={{ 
                                                marginTop: '15px', 
                                                marginLeft: downloadLink ? '10px' : '0',
                                            }}
                                        >
                                            {capturingPdf ? 'Generating...' : 'Save as PDF'}
                                        </Button>
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    </>
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