'use client';

import React, { useState, useRef, useEffect } from "react";
import { Layout, Upload, Button, Table, Spin, Alert, Card, Row, Col, Typography, Divider, Progress, message, Modal } from "antd";
import { UploadOutlined, DownloadOutlined, BookOutlined, FileTextOutlined, EditOutlined, CommentOutlined, FileImageOutlined, FilePdfOutlined } from "@ant-design/icons";
import domtoimage from 'dom-to-image';
import jsPDF from 'jspdf';
import './styles.css';
import { Document, Page, View, Text as PDFText, StyleSheet, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { Document as DocxDocument, Packer, Paragraph as DocxParagraph, TextRun, Table as DocxTable, TableCell, TableRow } from 'docx';
// For App Router, we use Next.js's built-in CSS import support
// Remove the CSS import and add style through tailwind or inline styles
// import 'antd/dist/reset.css';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

// Create styles for PDF elements
const pdfStyles = StyleSheet.create({
  page: {
    padding: 20,
    backgroundColor: '#ffffff',
  },
  section: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1890ff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 5,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreLabel: {
    fontSize: 12,
    marginRight: 10,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderBottomStyle: 'solid',
    padding: '8px 0',
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    fontSize: 10,
    color: '#999999',
  },
});

// Create a PDF Document component
const AnalysisReport = ({ data, fileName }) => (
  <Document title={`${fileName || "eBook"} Analysis Report`}>
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.section}>
        <PDFText style={pdfStyles.title}>eBook AI Analysis Report</PDFText>
        <PDFText style={pdfStyles.text}>File: {fileName || "eBook Analysis"}</PDFText>
        <PDFText style={pdfStyles.text}>Generated: {new Date().toLocaleDateString()}</PDFText>
      </View>
      
      {data.summary && (
        <View style={pdfStyles.section}>
          <PDFText style={pdfStyles.title}>Book Summary</PDFText>
          <PDFText style={pdfStyles.text}>{data.summary}</PDFText>
        </View>
      )}
    </Page>
    
    {data.prologue && (
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.section}>
          <PDFText style={pdfStyles.title}>Compelling Prologue</PDFText>
          <PDFText style={pdfStyles.text}>{data.prologue}</PDFText>
        </View>
      </Page>
    )}
    
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.section}>
        <PDFText style={pdfStyles.title}>Overall Assessment</PDFText>
        <View style={pdfStyles.scoreContainer}>
          <PDFText style={pdfStyles.scoreLabel}>Overall Score:</PDFText>
          <PDFText style={pdfStyles.scoreValue}>{data.overallScore}/5</PDFText>
        </View>
        
        <PDFText style={pdfStyles.subtitle}>Strengths:</PDFText>
        {data.strengths?.map((strength, index) => (
          <PDFText key={`strength-${index}`} style={pdfStyles.text}>• {strength}</PDFText>
        ))}
        
        <PDFText style={pdfStyles.subtitle}>Areas for Improvement:</PDFText>
        {data.areasForImprovement?.map((area, index) => (
          <PDFText key={`area-${index}`} style={pdfStyles.text}>• {area}</PDFText>
        ))}
      </View>
    </Page>
    
    <Page size="A4" style={pdfStyles.page}>
      <View style={pdfStyles.section}>
        <PDFText style={pdfStyles.title}>Detailed Analysis</PDFText>
        <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
          <PDFText style={pdfStyles.tableCell}>Parameter</PDFText>
          <PDFText style={pdfStyles.tableCell}>Score</PDFText>
          <PDFText style={pdfStyles.tableCell}>Analysis</PDFText>
        </View>
        
        {data.analysisData?.map((item, index) => (
          <View key={`item-${index}`} style={pdfStyles.tableRow}>
            <PDFText style={pdfStyles.tableCell}>{item.parameter}</PDFText>
            <PDFText style={pdfStyles.tableCell}>{item.score}/5</PDFText>
            <PDFText style={pdfStyles.tableCell}>{item.analysis}</PDFText>
          </View>
        ))}
      </View>
      
      <PDFText style={pdfStyles.footer}>eBook AI Analyzer Report</PDFText>
      <PDFText style={pdfStyles.pageNumber} render={({ pageNumber, totalPages }) => (
        `Page ${pageNumber} of ${totalPages}`
      )} />
    </Page>
  </Document>
);

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
    const [processingLogs, setProcessingLogs] = useState<string[]>([]);
    const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    
    // Refs for capturing PDF content
    const editorialContentRef = useRef<HTMLDivElement>(null);
    const analysisContentRef = useRef<HTMLDivElement>(null);
    
    // Enhanced polling logic for job status that's more resilient to errors
    useEffect(() => {
        let interval: NodeJS.Timeout;
        let errorCount = 0;
        const MAX_ERRORS = 3;
        
        if (jobId && loading) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/analyze?jobId=${jobId}`);
                    
                    // Handle 400 Bad Request (likely means job data is gone in serverless environment)
                    if (response.status === 400) {
                        errorCount++;
                        console.log(`Job status check error (${errorCount}/${MAX_ERRORS}): Job ID not found`);
                        
                        // After multiple failed attempts, assume job is processing in background
                        // and show a more graceful error message
                        if (errorCount >= MAX_ERRORS) {
                            clearInterval(interval);
                            setLoading(false);
                            setProgress(100);
                            setAnalysisStage("Processing in background");
                            setProcessingLogs(prev => [
                                ...prev, 
                                "Your file is being processed in the background. This may take a few minutes.",
                                "The results will appear here when ready. You can refresh the page later to check."
                            ]);
                            setShowAnalysisOverlay(false);
                            
                            // Show fallback message to user
                            message.info(
                                "Your document is being processed in the background. This typically takes 1-3 minutes. " +
                                "The page will update automatically when completed.", 
                                10
                            );
                            
                            // Implement simpler status check that doesn't rely on in-memory job state
                            startSimpleProgressCheck();
                        }
                        return;
                    }
                    
                    if (!response.ok) {
                        throw new Error(`Status check failed: ${response.status}`);
                    }
                    
                    // Reset error count on successful response
                    errorCount = 0;
                    
                    const data = await response.json();
                    console.log("Job status:", data);
                    
                    // Update UI based on status
                    if (data.progress !== undefined) {
                        setProgress(data.progress);
                    }
                    
                    if (data.message) {
                        setAnalysisStage(data.message);
                        setProcessingLogs(prev => [...prev, data.message]);
                    }
                    
                    // Check if processing is complete
                    if (data.status === 'completed' && data.completed) {
                        clearInterval(interval);
                        setLoading(false);
                        setProgress(100);
                        setAnalysisStage("Analysis complete!");
                        setShowAnalysisOverlay(false);
                        
                        // Update UI with results
                        if (data.analysis) {
                            setAnalysis(data.analysis);
                            setSummary(data.summary || "");
                            setPrologue(data.prologue || "");
                            setConstructiveCriticism(data.constructiveCriticism || "");
                            
                            // Create a downloadable CSV link if csvContent exists
                            if (data.csvContent) {
                                const csvBlob = new Blob([data.csvContent], { type: 'text/csv' });
                                const csvUrl = URL.createObjectURL(csvBlob);
                                setDownloadLink(csvUrl);
                            }
                        }
                    }
                    
                    // Handle error state
                    if (data.status === 'error') {
                        clearInterval(interval);
                        setLoading(false);
                        setProgress(100);
                        setAnalysisStage("Analysis failed!");
                        setProcessingLogs(prev => [...prev, `Error: ${data.error || "Unknown error"}`]);
                        alert(`Analysis failed! ${data.error || "Unknown error"}`);
                        setShowAnalysisOverlay(false);
                    }
                    
                } catch (error) {
                    console.error("Error checking job status:", error);
                    errorCount++;
                    
                    // Log the error but don't spam the user
                    if (errorCount <= 2) {
                        setProcessingLogs(prev => [...prev, `Error checking status: ${error}`]);
                    }
                    
                    // After multiple failures, switch to simpler approach
                    if (errorCount >= MAX_ERRORS) {
                        clearInterval(interval);
                        startSimpleProgressCheck();
                    }
                }
            }, 2000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [jobId, loading]);
    
    // Simple progress checker for Vercel deployments where we can't use in-memory job status
    const startSimpleProgressCheck = () => {
        // Use artificial progress as fallback
        let artificialProgress = 20;
        const progressInterval = setInterval(() => {
            if (artificialProgress >= 90) {
                clearInterval(progressInterval);
                // After approximately 60 seconds, try once more to get the result directly
                setTimeout(() => {
                    checkFinalResult();
                }, 10000);
                return;
            }
            
            artificialProgress += 5;
            setProgress(artificialProgress);
            
            // Update stages based on progress for better UX
            if (artificialProgress < 30) setAnalysisStage("Extracting text from document...");
            else if (artificialProgress < 50) setAnalysisStage("Analyzing content...");
            else if (artificialProgress < 70) setAnalysisStage("Generating insights...");
            else setAnalysisStage("Finalizing report...");
            
        }, 2000);
    };
    
    // Check for final result directly instead of relying on status updates
    const checkFinalResult = async () => {
        try {
            // Try to get the final result directly using a special endpoint/param
            const response = await fetch(`/api/analyze?finalResult=true&jobId=${jobId}`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.analysis) {
                    setLoading(false);
                    setProgress(100);
                    setAnalysisStage("Analysis complete!");
                    setShowAnalysisOverlay(false);
                    
                    // Update UI with results
                    setAnalysis(data.analysis);
                    setSummary(data.summary || "");
                    setPrologue(data.prologue || "");
                    setConstructiveCriticism(data.constructiveCriticism || "");
                    
                    // Create a downloadable CSV link if csvContent exists
                    if (data.csvContent) {
                        const csvBlob = new Blob([data.csvContent], { type: 'text/csv' });
                        const csvUrl = URL.createObjectURL(csvBlob);
                        setDownloadLink(csvUrl);
                    }
                } else {
                    // Still processing, show appropriate message
                    setProgress(95);
                    setAnalysisStage("Almost done...");
                    
                    // Try one more time after 15 more seconds
                    setTimeout(() => {
                        setLoading(false);
                        setShowAnalysisOverlay(false);
                        message.info("Your document analysis is still processing. Please refresh the page in a minute to see the results.");
                    }, 15000);
                }
            } else {
                // Handle failure
                setLoading(false);
                setShowAnalysisOverlay(false);
                message.error("We couldn't complete the analysis. Please try again with a smaller document.");
            }
        } catch (error) {
            console.error("Error checking final result:", error);
            setLoading(false);
            setShowAnalysisOverlay(false);
            message.error("Analysis couldn't be completed. Please try again.");
        }
    };

    const handleFileChange = (info: any) => {
        const file = info?.fileList?.[0]?.originFileObj;
        if (!file) {
            return;
        }

        const fileType = file.name.toLowerCase().split('.').pop();
        if (fileType !== 'pdf' && fileType !== 'docx') {
            message.error('Please upload a PDF or DOCX file');
            return;
        }
        setFile(file);
    };

    const handleUpload = async () => {
        if (!file) return alert("Please select a file first!");
        setLoading(true);
        setJobId(null);
        
        // Reset states
        setAnalysis([]);
        setSummary("");
        setPrologue("");
        setConstructiveCriticism("");
        setDownloadLink(null);
        setProcessingLogs([]);
        
        // Start progress animation
        setProgress(0);
        setAnalysisStage("Uploading file...");
        setProcessingLogs(prev => [...prev, "Starting analysis..."]);
        setShowAnalysisOverlay(true);

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
            
            if (data.jobId) {
                // We received a job ID - set it and continue polling for status
                setJobId(data.jobId);
                setAnalysisStage(data.message || "Processing file...");
                setProcessingLogs(prev => [...prev, data.message || "Job started"]);
            } else {
                // Handle immediate response (unlikely with the new API)
                setLoading(false);
                setProgress(100);
                setAnalysisStage("Analysis complete!");
                
                if (data.analysis) {
                    setAnalysis(data.analysis);
                    setSummary(data.summary || "");
                    setPrologue(data.prologue || "");
                    setConstructiveCriticism(data.constructiveCriticism || "");
                    setDownloadLink(data.downloadLink);
                } else if (data.success) {
                    setAnalysis([{
                        Parameter: "File Upload",
                        Score: 5,
                        Justification: `File successfully uploaded: ${data.fileName || file.name} (${data.fileSize || file.size} bytes)`
                    }]);
                }
                
                setShowAnalysisOverlay(false);
            }
        } catch (error) {
            console.error("Error:", error);
            setLoading(false);
            setProgress(100);
            setAnalysisStage("Analysis failed!");
            setProcessingLogs(prev => [...prev, `Error: ${error}`]);
            alert(`Analysis failed! ${error}`);
            setShowAnalysisOverlay(false);
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
          render: (score: number) => {
            // Scale down score if it's out of 10
            const scaledScore = score > 5 ? score / 2 : score;
            return (
              <div>
                <Progress 
                  type="circle" 
                  percent={scaledScore * 20} 
                  width={50} 
                  format={() => scaledScore.toFixed(1)} 
                  strokeColor={
                    scaledScore >= 4 ? '#52c41a' : // Green for high scores (4-5)
                    scaledScore >= 3 ? '#faad14' : // Yellow for medium scores (3)
                    '#f5222d'                // Red for low scores (1-2)
                  }
                />
              </div>
            );
          }
        },
        { title: "Justification", dataIndex: "Justification", key: "Justification" },
    ];

    // Calculate cumulative score and get improvement suggestions
    const calculateResults = (analysisData: any[]) => {
        // Skip if analysis failed or data is not in expected format
        if (!analysisData || analysisData.length === 0 || analysisData[0]?.Parameter === "Analysis Failed") {
            return {
                totalScore: 0,
                maxPossibleScore: 5,
                percentage: 0,
                strengths: [],
                improvements: [],
                analysis: [], // Added for PDF/DOCX generation
                summary: ""   // Added for PDF generation
            };
        }

        // Calculate total score, scaling down scores that are out of 10
        const totalScore = analysisData.reduce((sum, item) => {
            const scaledScore = item.Score > 5 ? item.Score / 2 : item.Score;
            return sum + (scaledScore || 0);
        }, 0);
        
        const maxPossibleScore = analysisData.length * 5; // 5 is max score per item
        
        // Normalize the score to be out of 5, ensuring it doesn't exceed 5
        const normalizedScore = Math.min(5, (totalScore / maxPossibleScore) * 5);
        const percentage = Math.round((normalizedScore / 5) * 100);
        
        // Identify strengths (high scores) and areas for improvement (low scores)
        const strengths = analysisData
            .filter(item => {
                const scaledScore = item.Score > 5 ? item.Score / 2 : item.Score;
                return scaledScore >= 4;
            })
            .map(item => item.Parameter);
            
        const improvements = analysisData
            .filter(item => {
                const scaledScore = item.Score > 5 ? item.Score / 2 : item.Score;
                return scaledScore <= 2;
            })
            .map(item => ({
                area: item.Parameter,
                score: item.Score > 5 ? item.Score / 2 : item.Score,
                justification: item.Justification
            }));
            
        return { 
            totalScore: Number(normalizedScore.toFixed(1)), // Round to 1 decimal place
            maxPossibleScore: 5, // Always out of 5
            percentage, 
            strengths, 
            improvements,
            analysis: analysisData, // Added for PDF/DOCX generation
            summary: summary        // Added for PDF generation
        };
    };

    const results = calculateResults(analysis);

    // Function to generate PDF from UI screenshots
    const generatePdf = async () => {
        try {
            setCapturingPdf(true);
            
            // Wait for rendering
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Create PDF in A4 portrait mode
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // A4 dimensions
            const a4Width = 210;
            const a4Height = 297;
            const margin = 10;
            
            // Capture the analysis content
            const analysisContent = analysisContentRef.current;
            if (!analysisContent) {
                throw new Error("Analysis content not found");
            }
            
            // Capture the entire analysis as an image
            const canvas = await html2canvas(analysisContent, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            
            // Get image data
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            
            // Calculate dimensions
            const imgWidth = a4Width - (margin * 2);
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Add sections to PDF
            const sections = [
                { title: "eBook AI Analysis Report", content: `File: ${file?.name || "eBook Analysis"}\nGenerated: ${new Date().toLocaleDateString()}` },
                { title: "Book Summary", content: summary },
                { title: "Compelling Prologue", content: prologue },
                { title: "Overall Assessment", content: `Overall Score: ${results.totalScore}/5\nStrengths: ${results.strengths.join(", ")}\nAreas for Improvement: ${results.improvements.map(item => item.area).join(", ")}` },
                { title: "Detailed Analysis", content: imgData } // This will be handled separately
            ];

            // Add each section to the PDF
            for (const section of sections) {
                pdf.addPage();
                pdf.setFontSize(16);
                pdf.text(section.title, margin, margin);
                pdf.setFontSize(12);
                pdf.text(section.content, margin, margin + 10);
            }

            // Handle the detailed analysis table separately
            const analysisData = results.analysis || [];
            const rowsPerPage = Math.floor((a4Height - (margin * 2)) / 10); // Adjust based on your row height
            const totalPages = Math.ceil(analysisData.length / rowsPerPage);

            for (let i = 0; i < totalPages; i++) {
                if (i > 0) {
                    pdf.addPage(); // Add a new page for each slice
                }

                const startRow = i * rowsPerPage;
                const endRow = Math.min(startRow + rowsPerPage, analysisData.length);
                const pageData = analysisData.slice(startRow, endRow);

                // Add table header
                pdf.setFontSize(12);
                pdf.text("Parameter", margin, margin + 10);
                pdf.text("Score", margin + 60, margin + 10);
                pdf.text("Analysis", margin + 100, margin + 10);

                // Add table rows
                pageData.forEach((item, index) => {
                    const rowY = margin + 20 + (index * 10);
                    pdf.text(item.parameter, margin, rowY);
                    pdf.text(`${item.score}/5`, margin + 60, rowY);
                    pdf.text(item.analysis, margin + 100, rowY);
                });
            }

            // Save the PDF
            const pdfFilename = `${file?.name?.replace(/\.pdf$/i, '') || "eBook Analysis"}_analysis_report.pdf`;
            pdf.save(pdfFilename);
            
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 5000);
        } catch (error) {
            console.error("PDF generation error:", error);
            alert(`PDF generation failed: ${error.message}. Please try again.`);
        } finally {
            setCapturingPdf(false);
        }
    };

    // Simple fallback function if needed
    const generateSimplePdf = () => {
        try {
            const pdf = new jsPDF();
            pdf.setFontSize(16);
            pdf.text("Analysis Report", 20, 20);
            
            if (results?.summary) {
                pdf.setFontSize(12);
                pdf.text("Summary:", 20, 30);
                const splitText = pdf.splitTextToSize(results.summary, 170);
                pdf.text(splitText, 20, 40);
            }
            
            const pdfFilename = `${file?.name?.replace(/\.pdf$/i, '') || "eBook Analysis"}_simple_report.pdf`;
            pdf.save(pdfFilename);
        } catch (error) {
            console.error("Simple PDF generation failed:", error);
            alert("Unable to generate PDF. Please try again later.");
        }
    };

    // Function to generate DOCX from analysis data
    const generateDocx = async () => {
        try {
            setCapturingPdf(true);
            
            // Simple solution for reliable Word document generation:
            // Use the Table UI component to generate a properly formatted table and convert to a document
            
            // Prepare a document structure that mirrors our UI
            let docContent = '';
            
            // Title and document info
            docContent += `<h1 style="color:#1890ff; margin-bottom:20px">eBook AI Analysis Report</h1>\n`;
            docContent += `<p><b>File:</b> ${file?.name || "eBook Analysis"}</p>\n`;
            docContent += `<p><b>Generated:</b> ${new Date().toLocaleDateString()}</p>\n\n`;
            
            // Book Summary section
            if (summary) {
                docContent += `<h2 style="margin-top:30px; color:#333">Book Summary</h2>\n`;
                docContent += `<p>${summary}</p>\n\n`;
            }
            
            // Prologue section
            if (prologue) {
                docContent += `<h2 style="margin-top:30px; color:#333">Compelling Prologue</h2>\n`;
                docContent += `<p style="font-style:italic">${prologue}</p>\n\n`;
            }
            
            // Overall Assessment section
            docContent += `<h2 style="margin-top:30px; color:#333">Overall Assessment</h2>\n`;
            
            // Overall score with appropriate color
            let scoreColor = "#f5222d"; // Default red for low scores
            if (results.percentage >= 80) scoreColor = "#52c41a"; // Green
            else if (results.percentage >= 60) scoreColor = "#faad14"; // Yellow
            
            docContent += `<p><b>Overall Score:</b> <span style="color:${scoreColor}; font-weight:bold">${results.totalScore}/5</span></p>\n\n`;
            
            // Strengths section
            docContent += `<h3 style="margin-top:20px">Strengths</h3>\n`;
            docContent += `<ul>\n`;
            results.strengths.forEach(strength => {
                docContent += `  <li>${strength}</li>\n`;
            });
            docContent += `</ul>\n\n`;
            
            // Areas for improvement section
            docContent += `<h3 style="margin-top:20px">Areas for Improvement</h3>\n`;
            docContent += `<ul>\n`;
            results.improvements.forEach(item => {
                docContent += `  <li><b>${item.area}</b> (Score: ${item.score}/5): ${item.justification}</li>\n`;
            });
            docContent += `</ul>\n\n`;
            
            // Score interpretation
            let scoreCategory = "Needs Improvement";
            let scoreDescription = "This eBook requires significant improvements in multiple areas.";
            
            if (results.percentage >= 80) {
                scoreCategory = "Excellent";
                scoreDescription = "This eBook demonstrates exceptional quality across most parameters.";
            } else if (results.percentage >= 60) {
                scoreCategory = "Good";
                scoreDescription = "This eBook has good overall quality with some areas for improvement.";
            } else if (results.percentage >= 40) {
                scoreCategory = "Average";
                scoreDescription = "This eBook meets basic standards but has several areas that need attention.";
            }
            
            docContent += `<div style="margin:20px 0; padding:15px; border:1px solid ${scoreColor}; background-color:${scoreColor}10">\n`;
            docContent += `  <h4 style="color:${scoreColor}">${scoreCategory}</h4>\n`;
            docContent += `  <p>${scoreDescription}</p>\n`;
            docContent += `</div>\n\n`;
            
            // Extra guidance for low scores
            if (results.percentage < 40) {
                docContent += `<h3 style="margin-top:20px">General Improvement Suggestions</h3>\n`;
                docContent += `<ul>\n`;
                docContent += `  <li>Consider having the text professionally edited to improve readability and flow.</li>\n`;
                docContent += `  <li>Check for grammatical errors and typos throughout the document.</li>\n`;
                docContent += `  <li>Work on improving the structure with clear chapter divisions and sections.</li>\n`;
                docContent += `  <li>Ensure formatting is consistent throughout the book.</li>\n`;
                docContent += `  <li>Consider adding more original insights or examples to enhance content value.</li>\n`;
                docContent += `</ul>\n\n`;
            }
            
            // Detailed Analysis section - create a proper HTML table
            docContent += `<h2 style="margin-top:30px; color:#333">Detailed Analysis</h2>\n`;
            docContent += `<table style="width:100%; border-collapse:collapse; margin-top:20px">\n`;
            docContent += `  <tr style="background-color:#f5f5f5">\n`;
            docContent += `    <th style="padding:8px; border:1px solid #ddd; text-align:left; font-weight:bold">Parameter</th>\n`;
            docContent += `    <th style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold">Score</th>\n`;
            docContent += `    <th style="padding:8px; border:1px solid #ddd; text-align:left; font-weight:bold">Analysis</th>\n`;
            docContent += `  </tr>\n`;
            
            // Add all analysis rows
            analysis.forEach(item => {
                const score = item.Score > 5 ? item.Score / 2 : item.Score;
                let rowScoreColor = "#f5222d"; // Red for low scores
                
                if (score >= 4) rowScoreColor = "#52c41a"; // Green for high scores
                else if (score >= 3) rowScoreColor = "#faad14"; // Yellow for medium scores
                
                docContent += `  <tr>\n`;
                docContent += `    <td style="padding:8px; border:1px solid #ddd">${item.Parameter}</td>\n`;
                docContent += `    <td style="padding:8px; border:1px solid #ddd; text-align:center"><span style="color:${rowScoreColor}; font-weight:bold">${item.Score}/5</span></td>\n`;
                docContent += `    <td style="padding:8px; border:1px solid #ddd">${item.Justification}</td>\n`;
                docContent += `  </tr>\n`;
            });
            
            docContent += `</table>\n`;
            
            // Add footer
            docContent += `<p style="margin-top:30px; text-align:center; color:#999; font-size:12px">eBook AI Analyzer ©${new Date().getFullYear()} - Powered by Next.js and OpenAI</p>\n`;
            
            // Convert to an MS Word document using HTML formatting
            const docType = 'data:application/vnd.ms-word;charset=utf-8';
            const htmlDocument = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
                <head>
                    <meta charset="utf-8">
                    <title>eBook AI Analysis Report</title>
                    <!--[if gte mso 9]>
                    <xml>
                        <w:WordDocument>
                            <w:View>Print</w:View>
                            <w:Zoom>100</w:Zoom>
                            <w:DoNotOptimizeForBrowser/>
                        </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                        /* Base document styles */
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            margin: 40px;
                            line-height: 1.5;
                            color: #333;
                        }
                        h1 { font-size: 24pt; margin-bottom: 24pt; color: #1890ff; }
                        h2 { font-size: 18pt; margin-top: 18pt; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5pt; }
                        h3 { font-size: 14pt; margin-top: 14pt; color: #333; }
                        h4 { font-size: 12pt; margin-top: 12pt; margin-bottom: 6pt; }
                        p { margin: 10pt 0; }
                        table { width: 100%; border-collapse: collapse; margin: 15pt 0; }
                        th { background-color: #f5f5f5; font-weight: bold; text-align: left; padding: 8pt; border: 1px solid #ddd; }
                        td { padding: 8pt; border: 1px solid #ddd; vertical-align: top; }
                        ul, ol { margin: 10pt 0; padding-left: 20pt; }
                        li { margin-bottom: 5pt; }
                        
                        /* Custom styling to match UI */
                        .score-high { color: #52c41a; font-weight: bold; }
                        .score-medium { color: #faad14; font-weight: bold; }
                        .score-low { color: #f5222d; font-weight: bold; }
                        .summary { margin-bottom: 15pt; }
                        .prologue { font-style: italic; margin-bottom: 15pt; }
                        .alert { border: 1px solid #ddd; padding: 10pt; margin: 15pt 0; }
                        .alert-success { border-color: #b7eb8f; background-color: #f6ffed; }
                        .alert-info { border-color: #91d5ff; background-color: #e6f7ff; }
                        .alert-warning { border-color: #ffe58f; background-color: #fffbe6; }
                        .alert-error { border-color: #ffa39e; background-color: #fff1f0; }
                        .center { text-align: center; }
                    </style>
                </head>
                <body>
                    ${docContent}
                </body>
                </html>
            `;
            
            // Create a Blob from the HTML content
            const blob = new Blob([htmlDocument], { type: docType });
            
            // Save the file with a .doc extension
            saveAs(blob, `${file?.name?.replace(/\.pdf$/i, '') || "eBook Analysis"}_analysis_report.doc`);
            
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 5000);
        } catch (error) {
            console.error("DOCX generation error:", error);
            alert(`DOCX generation failed: ${error.message}. Please try again.`);
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
                padding: '0 20px',
                height: 'auto',
                minHeight: '64px'
            }}>
                <BookOutlined style={{ fontSize: 24, marginRight: 10 }} />
                <h1 style={{ 
                    margin: 0, 
                    fontSize: '1.5rem',
                    padding: '12px 0'
                }}>
                    📖 eBook AI Analyzer
                </h1>
            </Header>
            
            <Content style={{ padding: '20px' }}>
                <Row justify="center" gutter={[16, 24]}>
                    <Col xs={24} sm={22} md={18} lg={14} xl={12}>
                        <Card 
                            title={
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <FileTextOutlined style={{ marginRight: 8 }} />
                                    <span>Upload Your eBook</span>
                                </div>
                            } 
                            hoverable
                            className="custom-card"
                            style={{ 
                                marginBottom: '20px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                borderRadius: '8px'
                            }}
                        >
                            <Upload
                                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                showUploadList={true}
                                maxCount={1}
                                beforeUpload={(file) => {
                                    const fileType = file.name.toLowerCase().split('.').pop();
                                    const isValidType = fileType === 'pdf' || fileType === 'docx';
                                    if (!isValidType) {
                                        message.error('Please upload a PDF or DOCX file');
                                    }
                                    return false;
                                }}
                                onChange={handleFileChange}
                            >
                                <Button 
                                    icon={<UploadOutlined />} 
                                    type="primary"
                                    ghost
                                    className={!file ? "pulse" : ""}
                                    style={{ width: '100%', height: '50px' }}
                                >
                                    Click to Upload PDF or DOCX
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
                                    
                                    {/* Processing Logs Section */}
                                    <div style={{ 
                                        marginTop: '15px',
                                        padding: '10px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '4px',
                                        maxHeight: '200px',
                                        overflowY: 'auto',
                                        textAlign: 'left'
                                    }}>
                                        <h4 style={{ marginBottom: '8px', color: '#1890ff' }}>Processing Logs:</h4>
                                        {processingLogs.map((log, index) => (
                                            <div 
                                                key={index}
                                                style={{ 
                                                    padding: '4px 0',
                                                    fontSize: '14px',
                                                    color: '#666',
                                                    borderBottom: index < processingLogs.length - 1 ? '1px solid #eee' : 'none'
                                                }}
                                            >
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                {analysis?.length > 0 && (
                    <>
                        {/* Generate Report Buttons - Made more responsive with proper className approach */}
                        <Row justify="center" style={{ marginTop: '20px' }}>
                            <Col xs={24} sm={22} md={20} lg={18} xl={16} style={{ textAlign: 'center' }}>
                                <Button 
                                    type="primary"
                                    icon={<FilePdfOutlined />}
                                    onClick={generateDocx}
                                    loading={capturingPdf}
                                    size="large"
                                    className="pdf-button mobile-responsive-button"
                                    style={{
                                        height: 'auto',
                                        padding: '10px 24px',
                                        fontSize: '16px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                                    }}
                                >
                                    Generate Analysis Report (DOCX)
                                </Button>
                                
                                <Button 
                                    type="default"
                                    icon={<FilePdfOutlined />}
                                    onClick={generateSimplePdf}
                                    size="middle"
                                    className="secondary-button mobile-responsive-button"
                                    style={{
                                        marginLeft: '10px',
                                        height: 'auto',
                                        padding: '8px 15px'
                                    }}
                                >
                                    Text-Only Report
                                </Button>
                                
                                {pdfSuccess && (
                                    <Alert
                                        message="DOCX Report Generated Successfully"
                                        description="Your DOCX has been saved to your downloads folder."
                                        type="success"
                                        showIcon
                                        closable
                                        onClose={() => setPdfSuccess(false)}
                                        className="pdf-success"
                                        style={{ 
                                            marginTop: '10px',
                                            width: '100%',
                                            maxWidth: '600px',
                                            margin: '10px auto'
                                        }}
                                    />
                                )}
                            </Col>
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
                                        variant="outlined"
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
                                                    // Split the paragraph into words and wrap suggestions in spans
                                                    const words = paragraph.split(/(\s+)/);
                                                    const suggestionWords = [
                                                        'should consider', 'recommend', 'could improve', 'suggest',
                                                        'try to', 'focus on', 'needs to', 'must', 'important to',
                                                        'enhance', 'revise', 'develop', 'strengthen', 'add',
                                                        'remove', 'modify', 'prioritize'
                                                    ];
                                                    
                                                    return (
                                                        <div className="feedback-entry" key={i}>
                                                            <Paragraph>
                                                                {words.map((word, j) => {
                                                                    const isSuggestion = suggestionWords.some(suggestion => 
                                                                        word.toLowerCase().includes(suggestion)
                                                                    );
                                                                    return (
                                                                        <span 
                                                                            key={j}
                                                                            className={isSuggestion ? "highlight-tip" : ""}
                                                                        >
                                                                            {word}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </Paragraph>
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
                                    variant="outlined"
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
                                            <a 
                                                href={downloadLink} 
                                                download="report.csv"
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <Button 
                                                    type="primary" 
                                                    icon={<DownloadOutlined />}
                                                    style={{ marginTop: '15px' }}
                                                >
                                                    Download CSV Report
                                                </Button>
                                            </a>
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
            
            <Footer style={{ 
                textAlign: 'center', 
                background: '#f0f2f5',
                padding: '10px'
            }}>
                eBook AI Analyzer ©{new Date().getFullYear()} - Powered by Next.js and OpenAI
            </Footer>

            {/* Add the Analysis Overlay */}
            {showAnalysisOverlay && (
                <div className="analysis-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div className="analysis-content" style={{
                        textAlign: 'center',
                        padding: '30px',
                        borderRadius: '15px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        maxWidth: '500px',
                        width: '90%'
                    }}>
                        <div className="book-analysis-animation" style={{
                            position: 'relative',
                            width: '200px',
                            height: '200px',
                            margin: '0 auto'
                        }}>
                            <div className="book" style={{
                                position: 'absolute',
                                width: '100px',
                                height: '150px',
                                background: '#2c3e50',
                                borderRadius: '5px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                animation: 'bookFloat 3s ease-in-out infinite'
                            }}>
                                <div className="book-pages" style={{
                                    position: 'absolute',
                                    top: '5px',
                                    left: '5px',
                                    right: '5px',
                                    bottom: '5px',
                                    background: '#fff',
                                    border: '1px solid #ddd',
                                    animation: 'pageTurn 2s ease-in-out infinite'
                                }}></div>
                            </div>
                            <div className="analyst" style={{
                                position: 'absolute',
                                width: '60px',
                                height: '80px',
                                bottom: '0',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                animation: 'analystThink 2s ease-in-out infinite'
                            }}>
                                <div className="head" style={{
                                    width: '40px',
                                    height: '40px',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '0',
                                    left: '50%',
                                    transform: 'translateX(-50%)'
                                }}>
                                    <div className="face" style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%'
                                    }}>
                                        <div className="eyes" style={{
                                            position: 'absolute',
                                            top: '30%',
                                            width: '100%',
                                            height: '4px',
                                            background: '#333',
                                            animation: 'blink 3s ease-in-out infinite'
                                        }}></div>
                                        <div className="mouth" style={{
                                            position: 'absolute',
                                            bottom: '20%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            width: '20px',
                                            height: '10px',
                                            borderBottom: '2px solid #333',
                                            borderLeft: '2px solid #333',
                                            borderRight: '2px solid #333',
                                            borderBottomLeftRadius: '10px',
                                            borderBottomRightRadius: '10px',
                                            animation: 'think 2s ease-in-out infinite'
                                        }}></div>
                                    </div>
                                </div>
                                <div className="body" style={{
                                    position: 'absolute',
                                    top: '40px',
                                    width: '100%',
                                    height: '40px',
                                    background: '#1890ff',
                                    borderRadius: '5px'
                                }}>
                                    <div className="arm left" style={{
                                        position: 'absolute',
                                        top: '0',
                                        left: '-20px',
                                        width: '20px',
                                        height: '40px',
                                        background: '#1890ff',
                                        animation: 'armMove 2s ease-in-out infinite'
                                    }}>
                                        <div className="hand" style={{
                                            position: 'absolute',
                                            bottom: '0',
                                            width: '15px',
                                            height: '15px',
                                            background: '#fff',
                                            borderRadius: '50%'
                                        }}></div>
                                    </div>
                                    <div className="arm right" style={{
                                        position: 'absolute',
                                        top: '0',
                                        right: '-20px',
                                        width: '20px',
                                        height: '40px',
                                        background: '#1890ff',
                                        animation: 'armMove 2s ease-in-out infinite reverse'
                                    }}>
                                        <div className="hand" style={{
                                            position: 'absolute',
                                            bottom: '0',
                                            width: '15px',
                                            height: '15px',
                                            background: '#fff',
                                            borderRadius: '50%'
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Typography.Title level={4} style={{ color: '#fff', marginTop: '20px' }}>
                            Analyzing Your Book
                        </Typography.Title>
                        <Typography.Paragraph style={{ color: '#fff' }}>
                            Our AI is carefully reviewing your content to provide detailed insights...
                        </Typography.Paragraph>
                    </div>
                </div>
            )}
        </Layout>
    );
}