'use client';

import React, { useState, useRef, useEffect } from "react";
import { Layout, Upload, Button, Table, Spin, Alert, Card, Row, Col, Typography, Divider, Progress, message, Modal, ConfigProvider, theme, Space, Select } from "antd";
import { UploadOutlined, DownloadOutlined, BookOutlined, FileTextOutlined, EditOutlined, CommentOutlined, FileImageOutlined, FilePdfOutlined, UserOutlined, FieldTimeOutlined, GlobalOutlined, DeleteOutlined, SwapOutlined } from "@ant-design/icons";
import domtoimage from 'dom-to-image';
import jsPDF from 'jspdf';
import './styles.css';
import { Document, Page, View, Text as PDFText, StyleSheet, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { Document as DocxDocument, Packer, Paragraph as DocxParagraph, TextRun, Table as DocxTable, TableCell, TableRow } from 'docx';
import { Avatar, Tag, Timeline } from 'antd';
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

// Add these interfaces after the pdfStyles definition
interface FileUploadStatus {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    jobId?: string;
    error?: string;
    analysis?: any;
}

interface AnalysisResults {
    percentage: number;
    totalScore: number;
    maxPossibleScore: number;
    strengths: string[];
    improvements: Array<{
        area: string;
        score: number;
        justification: string;
    }>;
    analysis?: any[];
    summary?: string;
    narrativeContext?: {
        plotArcs: Array<{
            type: string;
            effectiveness: number;
            analysis: string;
        }>;
        themes: Array<{
            name: string;
            strength: number;
            development: string;
        }>;
    };
}

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
    // File handling states
    const [files, setFiles] = useState<FileUploadStatus[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [showAnalysisOverlay, setShowAnalysisOverlay] = useState(false);
    const [showLoader, setShowLoader] = useState(false);
    const [apiTest, setApiTest] = useState('');

    // Analysis states
    const [analysis, setAnalysis] = useState<any[]>([]);
    const [summary, setSummary] = useState('');
    const [prologue, setPrologue] = useState('');
    const [constructiveCriticism, setConstructiveCriticism] = useState('');
    const [downloadLink, setDownloadLink] = useState<string | null>(null);
    const [processingLogs, setProcessingLogs] = useState<string[]>([]);
    
    // Progress states
    const [analysisStage, setAnalysisStage] = useState('');
    const [progress, setProgress] = useState(0);
    const [capturingPdf, setCapturingPdf] = useState(false);
    const [pdfSuccess, setPdfSuccess] = useState(false);

    // Analysis result states
    const [results, setResults] = useState<AnalysisResults>({
        percentage: 0,
        totalScore: 0,
        maxPossibleScore: 0,
        strengths: [],
        improvements: []
    });

    // Character and plot tracking states
    const [characterMap, setCharacterMap] = useState<{
        [key: string]: {
            appearances: number;
            traits: string[];
            relationships: Record<string, string[]>;
            development: string;
            firstAppearance: string;
            lastAppearance: string;
            chapters: string[];
        };
    }>({});
    
    const [mainCharacters, setMainCharacters] = useState<string[]>([]);
    const [plotTimeline, setPlotTimeline] = useState<Array<{
        chapter: string;
        events: string[];
        characters: string[];
        location: string;
        significance: string;
    }>>([]);

    // World building states
    const [worldBuildingElements, setWorldBuildingElements] = useState<{
        locations: Record<string, string[]>;
        customs: string[];
        history: string[];
        rules: string[];
        technology: string[];
        socialStructure: string[];
    }>({
        locations: {},
        customs: [],
        history: [],
        rules: [],
        technology: [],
        socialStructure: []
    });

    // Animation styles for loader
    const animationStyles = `
        @keyframes blink {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.1); }
        }
        @keyframes think {
            0%, 100% { transform: translateX(-50%) scaleX(1); }
            50% { transform: translateX(-50%) scaleX(0.8); }
        }
        @keyframes armMove {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(30deg); }
        }
        @keyframes happy {
            0%, 100% { transform: scaleY(1) rotate(0deg); }
            50% { transform: scaleY(0.5) rotate(5deg); }
        }
        @keyframes smile {
            0%, 100% { transform: translateX(-50%) scaleX(1.2) scaleY(1.2); border-radius: 50%; }
            50% { transform: translateX(-50%) scaleX(1) scaleY(0.8); border-radius: 30%; }
        }
    `;
    
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
                    
                    // Add more detailed progress information if available
                    if (data.currentChunk && data.chunksToProcess) {
                        const chunkInfo = `Processing chunk ${data.currentChunk} of ${data.chunksToProcess}`;
                        if (!processingLogs.includes(chunkInfo)) {
                            setProcessingLogs(prev => [...prev, chunkInfo]);
                        }
                    }
                    
                    // Check if processing is complete
                    if (data.status === 'completed' && data.completed) {
                        clearInterval(interval);
                        setLoading(false);
                        setProgress(100);
                        setAnalysisStage("Analysis complete!");
                        setProcessingLogs(prev => [...prev, "Analysis successfully completed!"]);
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

    // Replace handleFileChange with this new version
    const handleFileChange = (info: any) => {
        const newFiles = info?.fileList?.map((fileInfo: any) => {
            const file = fileInfo.originFileObj;
            const fileType = file.name.toLowerCase().split('.').pop();
            
            if (fileType !== 'pdf' && fileType !== 'docx') {
                message.error(`${file.name} is not a PDF or DOCX file`);
                return null;
            }
            
            return {
                file,
                progress: 0,
                status: 'pending' as const
            };
        }).filter(Boolean);

        if (newFiles) {
            setFiles(prev => {
                const combined = [...prev, ...newFiles];
                // Keep only the last 10 files if more are added
                return combined.slice(-10);
            });
        }
    };

    // Replace handleUpload with this new version
    const handleUpload = async () => {
        if (files.length === 0) return;
        
        setUploading(true);
        setShowLoader(true);
        
        try {
            // Reset states
            setAnalysis([]);
            setSummary('');
            setPrologue('');
            setConstructiveCriticism('');
            setDownloadLink(null);
            
            // Process all files concurrently
            const uploadPromises = files.map(async (fileStatus, index) => {
                try {
                    const formData = new FormData();
                    formData.append('file', fileStatus.file);
                    formData.append("processType", "complete");
                    formData.append("analysisParams", JSON.stringify({
                        characterAnalysis: {
                            trackMainCharacters: true,
                            characterDevelopment: true,
                            characterRelationships: true,
                            dialogueAnalysis: true,
                            behavioralPatterns: true,
                            characterMotivations: true,
                            characterArcs: true,
                            consistencyCheck: true,
                            emotionalDepth: true,
                            characterVoice: true
                        },
                        narrativeAnalysis: {
                            plotProgression: true,
                            thematicDevelopment: true,
                            settingConsistency: true,
                            timelineTracking: true,
                            subplotIntegration: true,
                            narrativePacing: true,
                            conflictDevelopment: true,
                            resolutionQuality: true,
                            storyStructure: true,
                            narrativeVoice: true
                        },
                        contextualAnalysis: {
                            worldBuilding: {
                                physicalSettings: true,
                                socialStructures: true,
                                culturalElements: true,
                                historicalContext: true,
                                rules: true,
                                technology: true,
                                environment: true
                            },
                            thematicDepth: {
                                mainThemes: true,
                                symbolism: true,
                                motifs: true,
                                subtext: true,
                                messageClarity: true
                            },
                            genreConsistency: true,
                            toneConsistency: true,
                            atmosphereBuilding: true
                        },
                        technicalAnalysis: {
                            grammarAndSyntax: true,
                            readabilityMetrics: true,
                            sentenceVariety: true,
                            vocabularyUse: true,
                            dialogueFormatting: true,
                            paragraphStructure: true,
                            chapterOrganization: true,
                            transitionQuality: true
                        },
                        readerEngagement: {
                            pacing: true,
                            tension: true,
                            emotionalImpact: true,
                            clarity: true,
                            immersion: true,
                            memorability: true
                        }
                    }));

                    try {
                        setFiles(prev => prev.map((f, i) => 
                            i === index ? { ...f, status: 'uploading' } : f
                        ));

                        const response = await fetch("/api/analyze", {
                            method: "POST",
                            body: formData,
                            headers: {
                                'x-process-mode': 'complete-pdf',
                                'x-analysis-depth': 'comprehensive',
                                'x-character-tracking': 'enabled',
                                'x-context-analysis': 'deep'
                            }
                        });

                        if (!response.ok) {
                            throw new Error(`Upload failed for ${fileStatus.file.name}`);
                        }

                        const data = await response.json();
                        
                        if (data.jobId) {
                            setFiles(prev => prev.map((f, i) => 
                                i === index ? { ...f, jobId: data.jobId } : f
                            ));
                            
                            setProcessingLogs(prev => [...prev, `Started comprehensive analysis of ${fileStatus.file.name}`]);
                            setProcessingLogs(prev => [...prev, `Analyzing character development and relationships...`]);
                            setProcessingLogs(prev => [...prev, `Tracking narrative consistency and world-building...`]);
                            pollJobStatus(data.jobId, index);
                        }

                    } catch (error) {
                        console.error(`Error uploading ${fileStatus.file.name}:`, error);
                        setFiles(prev => prev.map((f, i) => 
                            i === index ? { ...f, status: 'error', error: error.message } : f
                        ));
                        setProcessingLogs(prev => [...prev, `Error processing ${fileStatus.file.name}: ${error.message}`]);
                    }
                } catch (error: any) {
                    console.error(`Error uploading ${fileStatus.file.name}:`, error);
                    setFiles(prev => prev.map((f, i) => 
                        i === index ? { ...f, status: 'error', error: error.message } : f
                    ));
                    setProcessingLogs(prev => [...prev, `Error processing ${fileStatus.file.name}: ${error.message}`]);
                }
            });
            
            await Promise.all(uploadPromises);
            setUploading(false);
        } catch (error) {
            console.error('Upload failed:', error);
            message.error('Upload failed');
            setShowLoader(false);
            setUploading(false);
        }
    };

    // Add new function for polling job status
    const pollJobStatus = async (jobId: string, fileIndex: number) => {
        try {
            // Use the same endpoint as the analysis API
            const response = await fetch(`/api/analyze?jobId=${jobId}&type=status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            // Handle non-200 responses
            if (!response.ok) {
                if (response.status === 404) {
                    // Job not found - might have expired or been cleaned up
                    throw new Error('Analysis job not found. It may have expired.');
                }
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            // Ensure we have JSON response before parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format from server');
            }
            
            const data = await response.json();
            
            // Update file status
            const updatedFiles = [...files];
            updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                progress: data.progress || 0,
                status: data.status
            };
            setFiles(updatedFiles);
            
            // Update processing logs
            if (data.log) {
                setProcessingLogs(prevLogs => [...prevLogs, data.log]);
            }
            
            if (data.status === 'completed' && data.completedData) {
                // Update file status to success and set progress to 100%
                updatedFiles[fileIndex] = {
                    ...updatedFiles[fileIndex],
                    status: 'success',
                    progress: 100,
                    analysis: data.completedData
                };
                setFiles(updatedFiles);
                
                // Update character analysis if present
                if (data.completedData.characterAnalysis) {
                    setCharacterMap(prevMap => ({
                        ...prevMap,
                        ...data.completedData.characterAnalysis
                    }));
                    setMainCharacters(Object.keys(data.completedData.characterAnalysis));
                }
                
                // Update plot timeline if present
                if (data.completedData.plotTimeline) {
                    setPlotTimeline(prevTimeline => [...prevTimeline, ...(data.completedData.plotTimeline as any[])]);
                }
                
                // Update world building elements if present
                if (data.completedData.worldBuilding) {
                    setWorldBuildingElements(prevElements => {
                        const newElements = { ...prevElements };
                        Object.entries(data.completedData.worldBuilding as Record<string, string[]>).forEach(([key, value]) => {
                            newElements[key] = Array.from(new Set([...(newElements[key] || []), ...value]));
                        });
                        return newElements;
                    });
                }
                
                // Update main analysis states
                if (data.completedData.analysis) setAnalysis(data.completedData.analysis);
                if (data.completedData.summary) setSummary(data.completedData.summary);
                if (data.completedData.prologue) setPrologue(data.completedData.prologue);
                if (data.completedData.constructiveCriticism) {
                    setConstructiveCriticism(data.completedData.constructiveCriticism);
                }
                
                // Create downloadable CSV if present
                if (data.completedData.csvContent) {
                    const blob = new Blob([data.completedData.csvContent], { type: 'text/csv' });
                    setDownloadLink(URL.createObjectURL(blob));
                }
                
                // Add completion log
                setProcessingLogs(prevLogs => [...prevLogs, 'Analysis completed successfully!']);
                setShowLoader(false);
                return;
            }
            
            if (data.status === 'error') {
                updatedFiles[fileIndex] = {
                    ...updatedFiles[fileIndex],
                    status: 'error',
                    error: data.error || 'An unknown error occurred'
                };
                setFiles(updatedFiles);
                setShowLoader(false);
                message.error(`Analysis failed: ${data.error || 'Unknown error'}`);
                return;
            }
            
            // Continue polling if job is still in progress
            setTimeout(() => pollJobStatus(jobId, fileIndex), 2000);
            
        } catch (error: any) {
            console.error('Error polling job status:', error);
            
            // Update file status to error
            const updatedFiles = [...files];
            updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                status: 'error',
                error: error.message || 'Failed to check job status'
            };
            setFiles(updatedFiles);
            
            // Show error message to user
            message.error(`Analysis status check failed: ${error.message}`);
            
            // Hide loader
            setShowLoader(false);
            
            // Add error to processing logs
            setProcessingLogs(prev => [...prev, `Error: ${error.message}`]);
        }
    };

    // Add new function to remove a file from the queue
    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
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

    // Update the results state when analysis changes
    useEffect(() => {
        if (analysis.length > 0) {
            const calculatedResults: AnalysisResults = {
                percentage: 0,
                totalScore: 0,
                maxPossibleScore: 0,
                strengths: [],
                improvements: [],
                analysis: analysis
            };

            // Calculate scores and update other fields
            let totalScore = 0;
            const improvements: Array<{ area: string; score: number; justification: string }> = [];
            const strengths: string[] = [];

            analysis.forEach(item => {
                const score = item.Score > 5 ? item.Score / 2 : item.Score;
                totalScore += score;

                if (score >= 4) {
                    strengths.push(`Strong ${item.Parameter.toLowerCase()}: ${item.Justification}`);
                } else if (score <= 2) {
                    improvements.push({
                        area: item.Parameter,
                        score: score,
                        justification: item.Justification
                    });
                }
            });

            calculatedResults.totalScore = Math.round((totalScore / analysis.length) * 10) / 10;
            calculatedResults.maxPossibleScore = 5;
            calculatedResults.percentage = (calculatedResults.totalScore / calculatedResults.maxPossibleScore) * 100;
            calculatedResults.strengths = strengths;
            calculatedResults.improvements = improvements;

            setResults(calculatedResults);
        }
    }, [analysis]);

    // Helper function for character relationships
    const handleCharacterRelationship = (dynamics: unknown) => {
        if (Array.isArray(dynamics)) {
            return dynamics.join(', ');
        }
        return String(dynamics);
    };

    // Function to generate DOCX report
    const generateDocx = async () => {
        try {
            setCapturingPdf(true);
            
            // Create a new instance of Document
            const doc = new DocxDocument({
                sections: [{
                    properties: {},
                    children: [
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "eBook Analysis Report",
                                    bold: true,
                                    size: 32
                                })
                            ]
                        }),
                        // Add more content here
                    ]
                }]
            });

            // Generate and save the document
            const buffer = await Packer.toBuffer(doc);
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(blob, 'ebook-analysis.docx');
            
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 3000);
        } catch (error) {
            console.error('Error generating DOCX:', error);
            message.error('Failed to generate DOCX report');
        } finally {
            setCapturingPdf(false);
        }
    };

    // Function to generate a simple PDF report
    const generateSimplePdf = async () => {
        try {
            setCapturingPdf(true);
            const pdf = new jsPDF();
            
            // Add title
            pdf.setFontSize(20);
            pdf.text('eBook Analysis Report', 20, 20);
            
            // Add summary
            pdf.setFontSize(12);
            if (summary) {
                pdf.text('Summary:', 20, 40);
                const splitSummary = pdf.splitTextToSize(summary, 170);
                pdf.text(splitSummary, 20, 50);
            }
            
            // Add analysis results
            let yPos = 150; // Fixed position instead of using lastAutoTable
            pdf.text('Analysis Results:', 20, yPos);
            
            // Save the PDF
            pdf.save('simple-analysis-report.pdf');
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 3000);
        } catch (error) {
            console.error('Error generating PDF:', error);
            message.error('Failed to generate PDF report');
        } finally {
            setCapturingPdf(false);
        }
    };

    // Function to generate an enhanced PDF report with visualizations
    const generateEnhancedPdf = async () => {
        try {
            setCapturingPdf(true);
            
            // Create new PDF document
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.width;
            
            // Add cover page
            pdf.setFontSize(24);
            pdf.text('eBook Analysis Report', pageWidth / 2, 80, { align: 'center' });
            
            // Add timestamp
            pdf.setFontSize(12);
            pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 120, { align: 'center' });
            
            // Capture and add visualizations
            if (analysisContentRef.current) {
                const canvas = await html2canvas(analysisContentRef.current);
                const imgData = canvas.toDataURL('image/png');
                
                // Add new page for visualizations
                pdf.addPage();
                const imgWidth = pageWidth - 40;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
            }
            
            // Add editorial feedback if available
            if (editorialContentRef.current) {
                const canvas = await html2canvas(editorialContentRef.current);
                const imgData = canvas.toDataURL('image/png');
                
                // Add new page for editorial feedback
                pdf.addPage();
                const imgWidth = pageWidth - 40;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
            }
            
            // Save the enhanced PDF
            pdf.save('enhanced-analysis-report.pdf');
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 3000);
        } catch (error) {
            console.error('Error generating enhanced PDF:', error);
            message.error('Failed to generate enhanced PDF report');
        } finally {
            setCapturingPdf(false);
        }
    };

    const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(null);
    const [showComparison, setShowComparison] = useState(false);

    const renderComparison = () => {
        if (selectedFileIndex === null || files.length <= 1) return null;

        const selectedFile = files[selectedFileIndex];
        const otherFiles = files.filter((_, index) => index !== selectedFileIndex);

        return (
            <Card 
                title="File Comparison"
                className="comparison-card"
                style={{ 
                    marginTop: '20px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
            >
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Card 
                            title={selectedFile.file.name}
                            type="inner"
                            style={{ background: '#ffffff' }}
                        >
                            {selectedFile.analysis && (
                                <>
                                    <div style={{ marginBottom: '16px' }}>
                                        <strong>Overall Score:</strong> {selectedFile.analysis.totalScore}/5
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <strong>Key Strengths:</strong>
                                        <ul>
                                            {selectedFile.analysis.strengths?.slice(0, 3).map((strength, i) => (
                                                <li key={i}>{strength}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <strong>Areas for Improvement:</strong>
                                        <ul>
                                            {selectedFile.analysis.improvements?.slice(0, 3).map((item, i) => (
                                                <li key={i}>{item.area}: {item.justification}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <Button 
                                        type="primary"
                                        icon={<DownloadOutlined />}
                                        onClick={() => generateIndividualReport(selectedFileIndex)}
                                        style={{ marginTop: '16px' }}
                                    >
                                        Download Report
                                    </Button>
                                </>
                            )}
                        </Card>
                    </Col>
                    {otherFiles.map((file, index) => (
                        <Col span={12} key={index}>
                            <Card 
                                title={file.file.name}
                                type="inner"
                                style={{ background: '#ffffff' }}
                            >
                                {file.analysis && (
                                    <>
                                        <div style={{ marginBottom: '16px' }}>
                                            <strong>Overall Score:</strong> {file.analysis.totalScore}/5
                                        </div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <strong>Key Strengths:</strong>
                                            <ul>
                                                {file.analysis.strengths?.slice(0, 3).map((strength, i) => (
                                                    <li key={i}>{strength}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <strong>Areas for Improvement:</strong>
                                            <ul>
                                                {file.analysis.improvements?.slice(0, 3).map((item, i) => (
                                                    <li key={i}>{item.area}: {item.justification}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <Button 
                                            type="primary"
                                            icon={<DownloadOutlined />}
                                            onClick={() => generateIndividualReport(index)}
                                            style={{ marginTop: '16px' }}
                                        >
                                            Download Report
                                        </Button>
                                    </>
                                )}
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Card>
        );
    };

    const generateIndividualReport = async (index: number) => {
        try {
            setCapturingPdf(true);
            const file = files[index];
            
            // Create new PDF document
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.width;
            
            // Add cover page
            pdf.setFontSize(24);
            pdf.text(`Analysis Report: ${file.file.name}`, pageWidth / 2, 80, { align: 'center' });
            
            // Add timestamp
            pdf.setFontSize(12);
            pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 120, { align: 'center' });
            
            // Add analysis content
            if (file.analysis) {
                // Add summary section
                pdf.addPage();
                pdf.setFontSize(16);
                pdf.text('Analysis Summary', 40, 40);
                pdf.setFontSize(12);
                
                let yPos = 80;
                
                // Add overall score
                pdf.text(`Overall Score: ${file.analysis.totalScore}/5`, 40, yPos);
                yPos += 30;
                
                // Add strengths
                pdf.text('Key Strengths:', 40, yPos);
                yPos += 20;
                file.analysis.strengths?.forEach(strength => {
                    pdf.text(`• ${strength}`, 60, yPos);
                    yPos += 20;
                });
                
                // Add improvements
                yPos += 20;
                pdf.text('Areas for Improvement:', 40, yPos);
                yPos += 20;
                file.analysis.improvements?.forEach(item => {
                    const text = `• ${item.area}: ${item.justification}`;
                    const lines = pdf.splitTextToSize(text, pageWidth - 80);
                    lines.forEach(line => {
                        pdf.text(line, 60, yPos);
                        yPos += 20;
                    });
                });
            }
            
            // Save the PDF
            pdf.save(`${file.file.name}-analysis.pdf`);
            setPdfSuccess(true);
            setTimeout(() => setPdfSuccess(false), 3000);
        } catch (error) {
            console.error('Error generating individual PDF:', error);
            message.error('Failed to generate PDF report');
        } finally {
            setCapturingPdf(false);
        }
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorBgBase: '#ffffff',
                    colorTextBase: '#000000',
                    colorBorder: '#f0f0f0',
                    borderRadius: 8
                }
            }}
        >
            <Layout style={{ minHeight: '100vh', background: '#ffffff' }}>
                <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
                <div className="content-container" style={{ padding: '0 50px', marginTop: 64, background: '#ffffff' }}>
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
                    <BookOutlined style={{ fontSize: 24, marginRight: 10, color: '#ffffff' }} />
                    <h1 style={{ 
                        margin: 0, 
                        fontSize: '1.5rem',
                        padding: '12px 0',
                        color: '#ffffff'
                    }}>
                        📖 eBook AI Analyzer
                    </h1>
                </Header>
                
                <Content style={{ padding: '20px', background: '#ffffff' }}>
                    <Row justify="center" gutter={[16, 24]}>
                        <Col xs={24} sm={22} md={18} lg={14} xl={12}>
                            <Card 
                                title={
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                        <span style={{ color: '#000000' }}>Upload Your eBook</span>
                                    </div>
                                } 
                                hoverable
                                className="custom-card"
                                style={{ 
                                    marginBottom: '20px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    borderRadius: '8px',
                                    background: '#ffffff'
                                }}
                            >
                                <Upload
                                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    multiple
                                    maxCount={10}
                                    showUploadList={{
                                        showRemoveIcon: true,
                                        removeIcon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
                                    }}
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
                                        icon={<UploadOutlined style={{ color: '#1890ff' }} />} 
                                        type="primary"
                                        ghost
                                        className={!files.length ? "pulse" : ""}
                                        style={{ 
                                            width: '100%', 
                                            height: '50px',
                                            background: '#ffffff',
                                            borderColor: '#1890ff',
                                            color: '#1890ff'
                                        }}
                                    >
                                        Click to Upload Multiple PDFs (Max 10)
                                    </Button>
                                </Upload>
                                
                                {files.length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        {files.map((file, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '10px',
                                                    marginBottom: '10px',
                                                    background: '#f8f9fa',
                                                    borderRadius: '4px',
                                                    border: '1px solid #e8e8e8'
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ color: '#000000' }}>{file.file.name}</div>
                                                    <Progress 
                                                        percent={file.progress} 
                                                        size="small" 
                                                        status={
                                                            file.status === 'error' ? 'exception' :
                                                            file.status === 'success' ? 'success' :
                                                            'active'
                                                        }
                                                    />
                                                </div>
                                                {file.status === 'error' && (
                                                    <div style={{ color: '#ff4d4f', marginRight: '10px' }}>
                                                        {file.error}
                                                    </div>
                                                )}
                                                {file.status !== 'uploading' && (
                                                    <Button
                                                        type="text"
                                                        danger
                                                        onClick={() => removeFile(index)}
                                                        style={{ marginLeft: '10px' }}
                                                    >
                                                        Remove
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <Button
                                            onClick={handleUpload}
                                            loading={uploading}
                                            type="primary"
                                            style={{ 
                                                width: '100%', 
                                                marginTop: '15px',
                                                height: '50px',
                                                fontSize: '16px',
                                                background: '#1890ff'
                                            }}
                                            disabled={files.length === 0 || uploading}
                                        >
                                            {uploading ? 'Processing Files...' : 'Analyze All Files'}
                                        </Button>
                                    </div>
                                )}
                            </Card>

                            {analysis.length === 0 && !loading && (
                                <Alert 
                                    message="Get started by uploading a PDF to analyze." 
                                    description="Our AI will analyze your eBook and provide detailed insights on readability, content quality, structure, and more." 
                                    type="info" 
                                    showIcon 
                                    style={{ 
                                        marginTop: '30px',
                                        background: '#ffffff',
                                        border: '1px solid #91d5ff'
                                    }}
                                />
                            )}
                        </Col>
                    </Row>

                    {files.length > 0 && (
                        <Row justify="center" style={{ marginTop: '20px' }}>
                            <Col xs={24} sm={22} md={20} lg={18} xl={16}>
                                <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: '20px' }}>
                                    <Select
                                        style={{ width: 300 }}
                                        placeholder="Select a file to view"
                                        onChange={(value) => setSelectedFileIndex(value)}
                                        value={selectedFileIndex}
                                    >
                                        {files.map((file, index) => (
                                            <Select.Option key={index} value={index}>
                                                {file.file.name}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    
                                    {files.length > 1 && (
                                        <Button
                                            type="primary"
                                            icon={<SwapOutlined />}
                                            onClick={() => setShowComparison(!showComparison)}
                                        >
                                            {showComparison ? 'Hide Comparison' : 'Compare Files'}
                                        </Button>
                                    )}
                                </Space>
                                
                                {showComparison && renderComparison()}
                            </Col>
                        </Row>
                    )}

                    {selectedFileIndex !== null && files[selectedFileIndex]?.analysis && (
                        <>
                            {/* Generate Report Buttons */}
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

                            {/* Editorial Feedback Card */}
                            {constructiveCriticism && (
                                <Row justify="center" gutter={[0, 24]}>
                                    <Col xs={24} sm={22} md={20} lg={18} xl={16}>
                                        <Card 
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <EditOutlined style={{ marginRight: 8, color: '#fa8c16', fontSize: '20px' }} />
                                                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fa8c16' }}>Editorial Assessment</span>
                                                </div>
                                            }
                                            className="custom-card editorial-card fade-in"
                                            style={{ 
                                                marginTop: '20px',
                                                    boxShadow: '0 4px 20px rgba(250, 140, 22, 0.15)',
                borderRadius: '12px',
                                                    borderTop: '4px solid #fa8c16',
                                                    background: '#ffffff'
                                            }}
                                            variant="outlined"
                                            hoverable
                                        >
                                            <div ref={editorialContentRef}>
                                                <div style={{
                                                        padding: '15px 20px',
                                                        background: 'rgba(250, 140, 22, 0.05)',
                                                    borderRadius: '8px',
                                                    marginBottom: '20px',
                                                        border: '1px solid rgba(250, 140, 22, 0.2)'
                                                    }}>
                                                        <Typography.Text type="secondary" style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                                                            Professional Editorial Feedback
                                                        </Typography.Text>
                                                        <Typography.Text style={{ fontSize: '16px', display: 'block', color: '#333' }}>
                                                            Curated recommendations to enhance your book's quality and impact.
                                                        </Typography.Text>
                                                    </div>
                                                    
                                                    {/* Key Recommendation Highlight */}
                                                    <div style={{
                                                        padding: '20px',
                                                        background: 'linear-gradient(to right, rgba(250, 140, 22, 0.1), rgba(250, 140, 22, 0.02))',
                                                        borderRadius: '12px',
                                                        marginBottom: '25px',
                                                        border: '1px dashed #fa8c16',
                                                        position: 'relative',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{ 
                                                            position: 'absolute', 
                                                            top: 0, 
                                                            left: 0, 
                                                            width: '5px', 
                                                            height: '100%', 
                                                            background: '#fa8c16' 
                                                        }}></div>
                                                        <Title level={5} style={{ color: '#fa8c16', marginTop: 0, position: 'relative' }}>
                                                            TOP PRIORITY
                                                            <div style={{ 
                                                                position: 'absolute', 
                                                                top: '50%', 
                                                                right: '-5px', 
                                                                width: '30px', 
                                                                height: '30px', 
                                                                transform: 'translateY(-50%)', 
                                                                opacity: 0.2 
                                                            }}>
                                                                <EditOutlined style={{ fontSize: '30px', color: '#fa8c16' }} />
                                                            </div>
                                                        </Title>
                                                        
                                                        <Title level={5} style={{ 
                                                            marginTop: '15px', 
                                                            marginBottom: '10px', 
                                                            fontWeight: '500',
                                                            color: '#555',
                                                            fontSize: '15px'
                                                        }}>
                                                            EDITOR'S KEY RECOMMENDATION
                                                        </Title>
                                                        
                                                        <Paragraph style={{ 
                                                            fontWeight: 400, 
                                                            fontSize: '15px', 
                                                            lineHeight: '1.6', 
                                                            color: '#333'
                                                        }}>
                                                            {constructiveCriticism.split('\n')[0].split(/(\*\*.*?\*\*)/).map((part, idx) => {
                                                                // Check if this part is a heading encased in asterisks
                                                                if (part.startsWith('**') && part.endsWith('**')) {
                                                                    const headingText = part.substring(2, part.length - 2);
                                                                    return (
                                                                        <span 
                                                                            key={idx}
                                                                            style={{
                                                                                fontWeight: 'bold',
                                                                                color: '#fa8c16',
                                                                                padding: '0 2px'
                                                                            }}
                                                                        >
                                                                            {headingText}
                                                                        </span>
                                                                    );
                                                                }
                                                                
                                                                // Regular text
                                                                return (
                                                                    <span key={idx}>
                                                                        {part}
                                                                    </span>
                                                                );
                                                            })}
                                                    </Paragraph>
                                                </div>
                                                    
                                                    {/* Detailed Feedback */}
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <Title level={5} style={{ 
                                                            borderBottom: '2px solid #f0f0f0', 
                                                            paddingBottom: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            color: '#333'
                                                        }}>
                                                            <CommentOutlined style={{ marginRight: '8px', color: '#fa8c16' }} />
                                                            DETAILED FEEDBACK
                                                        </Title>
                                            
                                            <div style={{ fontSize: '15px', lineHeight: '1.8' }}>
                                                {constructiveCriticism.split('\n').slice(1).map((paragraph, i) => {
                                                    // Check if paragraph is a numbered point with a heading (e.g., "1. **Copyright Notice**")
                                                    const numberedHeadingMatch = paragraph.match(/^(\d+)\.\s+\*\*(.*?)\*\*:?(.*)$/);
                                                    
                                                    // Check if paragraph starts with a heading like "**Cover Page:**"
                                                    const standaloneHeadingMatch = paragraph.match(/^\*\*(.*?)(?:\*\*:|\*\*)(.*)$/);
                                                    
                                                    if (numberedHeadingMatch) {
                                                        const [, number, headingText, remainingText] = numberedHeadingMatch;
                                                        
                                                        return (
                                                            <div className="feedback-entry" key={i} style={{
                                                                marginBottom: '20px',
                                                                padding: '15px',
                                                                background: 'white',
                                                                borderRadius: '8px',
                                                                border: '1px solid #f0f0f0',
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    marginBottom: '12px'
                                                                }}>
                                                                    <div style={{ 
                                                                        width: '28px',
                                                                        height: '28px',
                                                                        borderRadius: '50%',
                                                                        background: 'rgba(250, 140, 22, 0.1)',
                                                                        color: '#fa8c16',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontWeight: 'bold',
                                                                        marginRight: '10px'
                                                                    }}>
                                                                        {number}
                                                                    </div>
                                                                    <h4 style={{ 
                                                                        margin: '0',
                                                                        fontSize: '16px',
                                                                        fontWeight: 'bold',
                                                                        color: '#fa8c16'
                                                                    }}>
                                                                        {headingText}
                                                                    </h4>
                                                                </div>
                                                                
                                                                <Paragraph style={{ 
                                                                    margin: '0 0 0 38px',
                                                                    fontSize: '14px',
                                                                    color: '#555'
                                                                }}>
                                                                    {remainingText}
                                                                </Paragraph>
                                                            </div>
                                                        );
                                                    } else if (standaloneHeadingMatch) {
                                                        // Handle standalone headings like "**Cover Page:**"
                                                        const [, headingText, remainingText] = standaloneHeadingMatch;
                                                        
                                                        return (
                                                            <div className="feedback-entry" key={i} style={{
                                                                marginBottom: '20px',
                                                                padding: '15px',
                                                                background: 'white',
                                                                borderRadius: '8px',
                                                                border: '1px solid #f0f0f0',
                                                                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <div style={{ 
                                                                    marginBottom: '12px'
                                                                }}>
                                                                    <h4 style={{ 
                                                                        margin: '0',
                                                                        fontSize: '16px',
                                                                        fontWeight: 'bold',
                                                                        color: '#fa8c16',
                                                                        display: 'flex',
                                                                        alignItems: 'center'
                                                                    }}>
                                                                        <div style={{ 
                                                                            width: '8px', 
                                                                            height: '8px', 
                                                                            borderRadius: '50%', 
                                                                            background: '#fa8c16', 
                                                                            marginRight: '8px' 
                                                                        }}></div>
                                                                        {headingText}
                                                                    </h4>
                                                                </div>
                                                                
                                                                <Paragraph style={{ 
                                                                    margin: '0 0 0 16px',
                                                                    fontSize: '14px',
                                                                    color: '#555'
                                                                }}>
                                                                    {remainingText}
                                                                </Paragraph>
                                                            </div>
                                                        );
                                                    }
                                                    
                                                    // Handle regular paragraphs or other ** patterns
                                                    // Split the paragraph into words and wrap suggestions in spans
                                                    const words = paragraph.split(/(\s+)/);
                                                    const suggestionWords = [
                                                        'should consider', 'recommend', 'could improve', 'suggest',
                                                        'try to', 'focus on', 'needs to', 'must', 'important to',
                                                        'enhance', 'revise', 'develop', 'strengthen', 'add',
                                                        'remove', 'modify', 'prioritize'
                                                    ];
                                                    
                                                    return (
                                                        <div className="feedback-entry" key={i} style={{
                                                            marginBottom: '15px',
                                                            padding: '12px 15px',
                                                            background: i % 2 === 0 ? '#fafafa' : 'transparent',
                                                            borderRadius: '8px'
                                                        }}>
                                                            <Paragraph style={{ margin: 0 }}>
                                                                {words.map((word, j) => {
                                                                    // Check if word contains ** pattern indicating heading
                                                                    if (word.startsWith('**') && word.endsWith('**')) {
                                                                        const headingText = word.substring(2, word.length - 2);
                                                                        return (
                                                                            <h4 
                                                                                key={j}
                                                                                style={{
                                                                                    margin: '15px 0 8px', 
                                                                                    color: '#fa8c16', 
                                                                                    fontSize: '16px', 
                                                                                    borderBottom: '1px solid #f0f0f0', 
                                                                                    paddingBottom: '5px',
                                                                                    fontWeight: 'bold',
                                                                                    display: 'block',
                                                                                    width: '100%'
                                                                                }}
                                                                            >
                                                                                {headingText}
                                                                            </h4>
                                                                        );
                                                                    }
                                                                    
                                                                    const isSuggestion = suggestionWords.some(suggestion => 
                                                                        word.toLowerCase().includes(suggestion)
                                                                    );
                                                                    return (
                                                                        <span 
                                                                            key={j}
                                                                            style={{
                                                                                backgroundColor: isSuggestion ? 'rgba(250, 140, 22, 0.1)' : 'transparent',
                                                                                color: isSuggestion ? '#fa8c16' : 'inherit',
                                                                                padding: isSuggestion ? '0 4px' : '0',
                                                                                borderRadius: isSuggestion ? '3px' : '0',
                                                                                fontWeight: isSuggestion ? '500' : 'normal'
                                                                            }}
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
                                                
                                                {/* Action Steps */}
                                                <div style={{
                                                    background: '#f9f9f9',
                                                    borderRadius: '10px',
                                                    padding: '20px',
                                                    marginTop: '25px',
                                                    border: '1px solid #eee'
                                                }}>
                                                    <Title level={5} style={{ color: '#333', marginTop: 0, marginBottom: '15px' }}>
                                                        RECOMMENDED NEXT STEPS
                                                    </Title>
                                                    <Row gutter={[16, 16]}>
                                                        <Col span={8}>
                                                            <div style={{ 
                                                                textAlign: 'center', 
                                                                padding: '15px', 
                                                                background: 'white', 
                                                                borderRadius: '8px', 
                                                                height: '100%',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <div style={{ 
                                                                    width: '40px', 
                                                                    height: '40px', 
                                                                    borderRadius: '50%', 
                                                                    background: 'rgba(250, 140, 22, 0.1)', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center',
                                                                    margin: '0 auto 10px'
                                                                }}>
                                                                    <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>1</span>
                                                                </div>
                                                                <Typography.Text strong style={{ display: 'block', marginBottom: '5px' }}>Review Analysis</Typography.Text>
                                                                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                                                    Carefully consider each point in the editorial assessment
                                                                </Typography.Text>
                                                            </div>
                                                        </Col>
                                                        <Col span={8}>
                                                            <div style={{ 
                                                                textAlign: 'center', 
                                                                padding: '15px', 
                                                                background: 'white', 
                                                                borderRadius: '8px', 
                                                                height: '100%',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <div style={{ 
                                                                    width: '40px', 
                                                                    height: '40px', 
                                                                    borderRadius: '50%', 
                                                                    background: 'rgba(250, 140, 22, 0.1)', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center',
                                                                    margin: '0 auto 10px'
                                                                }}>
                                                                    <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>2</span>
                                                                </div>
                                                                <Typography.Text strong style={{ display: 'block', marginBottom: '5px' }}>Prioritize Changes</Typography.Text>
                                                                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                                                    Focus on addressing major issues first
                                                                </Typography.Text>
                                                            </div>
                                                        </Col>
                                                        <Col span={8}>
                                                            <div style={{ 
                                                                textAlign: 'center', 
                                                                padding: '15px', 
                                                                background: 'white', 
                                                                borderRadius: '8px', 
                                                                height: '100%',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                            }}>
                                                                <div style={{ 
                                                                    width: '40px', 
                                                                    height: '40px', 
                                                                    borderRadius: '50%', 
                                                                    background: 'rgba(250, 140, 22, 0.1)', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center',
                                                                    margin: '0 auto 10px'
                                                                }}>
                                                                    <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>3</span>
                                                                </div>
                                                                <Typography.Text strong style={{ display: 'block', marginBottom: '5px' }}>Implement Revisions</Typography.Text>
                                                                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                                                    Make targeted improvements based on feedback
                                                                </Typography.Text>
                                                            </div>
                                                        </Col>
                                                    </Row>
                                                </div>
                                                
                                                {/* Additional Sections - Table of Contents & Introduction */}
                                                <div style={{ 
                                                    marginTop: '30px',
                                                    padding: '20px',
                                                    background: 'rgba(250, 140, 22, 0.03)',
                                                    borderRadius: '8px'
                                                }}>
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{
                                                            fontSize: '16px',
                                                            fontWeight: 'bold',
                                                            color: '#fa8c16',
                                                            marginBottom: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}>
                                                            <div style={{ 
                                                                width: '8px', 
                                                                height: '8px', 
                                                                borderRadius: '50%', 
                                                                background: '#fa8c16', 
                                                                marginRight: '8px' 
                                                            }}></div>
                                                            TABLE OF CONTENTS
                                                        </h4>
                                                        <Paragraph style={{ paddingLeft: '16px' }}>
                                                            While functional, the table of contents could be more engaging. Consider adding titles to the chapters if possible, which can serve as intriguing previews that stimulate interest. If the chapters must remain numerically listed, a brief, thematic subtitle could add a layer of mystery and anticipation.
                                                        </Paragraph>
                                                    </div>
                                                    
                                                    <div>
                                                        <h4 style={{
                                                            fontSize: '16px',
                                                            fontWeight: 'bold',
                                                            color: '#fa8c16',
                                                            marginBottom: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}>
                                                            <div style={{ 
                                                                width: '8px', 
                                                                height: '8px', 
                                                                borderRadius: '50%', 
                                                                background: '#fa8c16', 
                                                                marginRight: '8px' 
                                                            }}></div>
                                                            INTRODUCTION
                                                        </h4>
                                                        <Paragraph style={{ paddingLeft: '16px' }}>
                                                            The introduction promises a deep dive into the complexities of the human mind through the lens of hypnosis. It's beautifully written but stops abruptly. Ensure that this section flows seamlessly into the body of the book, perhaps by ending with a question, a statement of intent, or a brief overview of what the reader can expect to discover within the pages.
                                                        </Paragraph>
                                                    </div>
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
                                            <BookOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                            <span style={{ color: '#000000' }}>Analysis Report</span>
                                        </div>
                                    }
                                    className="custom-card fade-in"
                                    style={{ 
                                        marginTop: '20px',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                        borderRadius: '8px',
                                        background: '#ffffff'
                                    }}
                                    extra={
                                        <Button
                                            type="primary"
                                            icon={<DownloadOutlined />}
                                            onClick={() => generateIndividualReport(selectedFileIndex)}
                                        >
                                            Download Report
                                        </Button>
                                    }
                                >
                                    <div ref={analysisContentRef}>
                                        {summary && (
                                                <div className="book-summary fade-in" style={{ marginBottom: '30px' }}>
                                                <Title level={4}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <BookOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                                        <span>Book Summary</span>
                                                    </div>
                                                </Title>
                                                    <div style={{
                                                        padding: '20px',
                                                        background: 'linear-gradient(to right, rgba(24, 144, 255, 0.05), rgba(24, 144, 255, 0.01))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(24, 144, 255, 0.1)',
                                                        position: 'relative'
                                                    }}>
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '10px',
                                                            right: '10px',
                                                            fontSize: '24px',
                                                            color: 'rgba(24, 144, 255, 0.1)'
                                                        }}>
                                                            <BookOutlined />
                                                        </div>
                                                        {summary.split('\n').map((paragraph, i) => {
                                                            // Process paragraphs to convert ** to headings
                                                            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                                                                const headingText = paragraph.substring(2, paragraph.length - 2);
                                                                return (
                                                                    <div key={i}>
                                                                        <h4 style={{ 
                                                                            margin: '15px 0 8px', 
                                                                            color: '#1890ff', 
                                                                            fontSize: '16px', 
                                                                            borderBottom: '1px solid rgba(24, 144, 255, 0.2)', 
                                                                            paddingBottom: '5px',
                                                                            fontWeight: 'bold'
                                                                        }}>
                                                                            {headingText}
                                                                        </h4>
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            // Check for ** patterns within paragraph
                                                            const processedText = paragraph.replace(
                                                                /\*\*(.*?)\*\*/g, 
                                                                '<h4 style="margin: 15px 0 8px; color: #1890ff; font-size: 16px; border-bottom: 1px solid rgba(24, 144, 255, 0.2); padding-bottom: 5px;">$1</h4>'
                                                            );
                                                            
                                                            if (processedText !== paragraph) {
                                                                return (
                                                                    <div 
                                                                        key={i} 
                                                                        dangerouslySetInnerHTML={{ __html: processedText }}
                                                                        style={{ 
                                                                            marginBottom: i < summary.split('\n').length - 1 ? '16px' : 0,
                                                                        }}
                                                                    />
                                                                );
                                                            }
                                                            
                                                            return (
                                                                <Paragraph key={i} style={{ 
                                                                    fontSize: '15px', 
                                                                    lineHeight: '1.8',
                                                                    marginBottom: i < summary.split('\n').length - 1 ? '16px' : 0,
                                                                    textAlign: 'justify'
                                                                }}>
                                                                    {paragraph}
                                                </Paragraph>
                                                            );
                                                        })}
                                                    </div>
                                                <Divider />
                                            </div>
                                        )}
                                        
                                        {prologue && (
                                                <div className="book-prologue slide-in" style={{ marginBottom: '30px' }}>
                                                <Title level={4}>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <CommentOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                                                            <span style={{ color: '#722ed1' }}>Compelling Prologue</span>
                                                    </div>
                                                </Title>
                                                    <div style={{
                                                        padding: '25px',
                                                        background: 'linear-gradient(to right, rgba(114, 46, 209, 0.05), rgba(114, 46, 209, 0.02))',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(114, 46, 209, 0.1)',
                                                        position: 'relative',
                                                        fontFamily: '"Georgia", serif'
                                                    }}>
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '10px',
                                                            right: '10px',
                                                            fontSize: '24px',
                                                            color: 'rgba(114, 46, 209, 0.1)'
                                                        }}>
                                                            <CommentOutlined />
                                                        </div>
                                                        <div style={{
                                                            fontSize: '28px',
                                                            fontFamily: '"Georgia", serif',
                                                            lineHeight: '1.5',
                                                            color: '#722ed1',
                                                            marginBottom: '15px',
                                                            fontStyle: 'italic',
                                                            textAlign: 'center'
                                                        }}>
                                                            "{prologue.split(' ').slice(0, 7).join(' ')}..."
                                                        </div>
                                                        {prologue.split('\n').map((paragraph, i) => {
                                                            // Process paragraphs to convert ** to headings
                                                            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                                                                const headingText = paragraph.substring(2, paragraph.length - 2);
                                                                return (
                                                                    <div key={i}>
                                                                        <h4 style={{ 
                                                                            margin: '15px 0 8px', 
                                                                            color: '#722ed1', 
                                                                            fontSize: '17px', 
                                                                            borderBottom: '1px solid rgba(114, 46, 209, 0.2)', 
                                                                            paddingBottom: '5px',
                                                                            fontWeight: 'bold',
                                                                            fontFamily: '"Georgia", serif',
                                                                        }}>
                                                                            {headingText}
                                                                        </h4>
                                                                    </div>
                                                                );
                                                            }
                                                            
                                                            // Check for ** patterns within paragraph
                                                            const processedText = paragraph.replace(
                                                                /\*\*(.*?)\*\*/g, 
                                                                '<h4 style="margin: 15px 0 8px; color: #722ed1; font-size: 17px; border-bottom: 1px solid rgba(114, 46, 209, 0.2); padding-bottom: 5px; font-family: Georgia, serif;">$1</h4>'
                                                            );
                                                            
                                                            if (processedText !== paragraph) {
    return (
                                                                    <div 
                                                                        key={i} 
                                                                        dangerouslySetInnerHTML={{ __html: processedText }}
                                                                        style={{ 
                                                                            marginBottom: i < prologue.split('\n').length - 1 ? '16px' : 0,
                                                                        }}
                                                                    />
                                                                );
                                                            }
                                                            
                                                            return (
                                                                <Paragraph key={i} style={{ 
                                                                    fontSize: '16px', 
                                                                    lineHeight: '1.9',
                                                                    marginBottom: i < prologue.split('\n').length - 1 ? '16px' : 0,
                                                                    fontStyle: 'italic',
                                                                    color: '#333',
                                                                    textAlign: 'justify'
                                                                }}>
                                                                    {paragraph}
                                                </Paragraph>
                                                            );
                                                        })}
                                                    </div>
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
                                            <div className="parameter-cards-container" style={{ marginBottom: '30px' }}>
                                                {analysis.map((item, index) => {
                                                    // Scale down score if it's out of 10
                                                    const scaledScore = item.Score > 5 ? item.Score / 2 : item.Score;
                                                    let scoreColor = '#f5222d'; // Red for low scores
                                                    let bgColor = 'rgba(245, 34, 45, 0.05)';
                                                    let borderColor = 'rgba(245, 34, 45, 0.2)';
                                                    
                                                    if (scaledScore >= 4) {
                                                        scoreColor = '#52c41a'; // Green for high scores
                                                        bgColor = 'rgba(82, 196, 26, 0.05)';
                                                        borderColor = 'rgba(82, 196, 26, 0.2)';
                                                    } else if (scaledScore >= 3) {
                                                        scoreColor = '#faad14'; // Yellow for medium scores
                                                        bgColor = 'rgba(250, 173, 20, 0.05)';
                                                        borderColor = 'rgba(250, 173, 20, 0.2)';
                                                    }
                                                    
                                                    return (
                                                        <Card
                                                            key={index}
                                                            className="parameter-card"
                                                            style={{
                                                                marginBottom: '20px',
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                border: `1px solid ${borderColor}`,
                                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                                                            }}
                                                            title={
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <span style={{ 
                                                                        fontWeight: 'bold',
                                                                        color: '#333'
                                                                    }}>
                                                                        {item.Parameter}
                                                                    </span>
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '10px'
                                                                    }}>
                                                                        <span style={{ 
                                                                            fontSize: '14px',
                                                                            color: '#888'
                                                                        }}>
                                                                            Score:
                                                                        </span>
                                                                        <div style={{
                                                                            width: '40px',
                                                                            height: '40px',
                                                                            borderRadius: '50%',
                                                                            display: 'flex',
                                                                            justifyContent: 'center',
                                                                            alignItems: 'center',
                                                                            background: bgColor,
                                                                            border: `2px solid ${scoreColor}`,
                                                                            color: scoreColor,
                                                                            fontWeight: 'bold',
                                                                            fontSize: '16px'
                                                                        }}>
                                                                            {scaledScore.toFixed(1)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            }
                                                            headStyle={{
                                                                background: bgColor,
                                                                borderBottom: `1px solid ${borderColor}`
                                                            }}
                                                            bodyStyle={{
                                                                padding: '20px',
                                                                background: 'white'
                                                            }}
                                                        >
                                                            <div>
                                                                {item.Justification.split('\n').map((paragraph, i) => {
                                                                    // Identify and style key terms, highlights, and bullet points
                                                                    const processedText = paragraph
                                                                        // Convert **text** to proper headings
                                                                        .replace(/\*\*(.*?)\*\*/g, '<h4 style="margin: 15px 0 8px; color: #333; font-size: 16px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px;">$1</h4>')
                                                                        .replace(/\*(.*?)\*/g, '<span style="font-style: italic;">$1</span>')
                                                                        .replace(/- (.*?)(?=\n|$)/g, '<div style="margin-bottom: 8px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: ' + scoreColor + '; margin-right: 8px; margin-bottom: 2px;"></span>$1</div>')
                                                                        .replace(/\b(excellent|outstanding|exceptional|remarkable|impressive)\b/gi, '<span style="color: #52c41a; font-weight: 500;">$1</span>')
                                                                        .replace(/\b(improvement|improve|lacking|weak|limited)\b/gi, '<span style="color: #faad14; font-weight: 500;">$1</span>')
                                                                        .replace(/\b(poor|inadequate|deficient|problematic|flawed)\b/gi, '<span style="color: #f5222d; font-weight: 500;">$1</span>');

    return (
                                                                        <div 
                                                                            key={i}
                                                                            style={{ 
                                                                                marginBottom: i < item.Justification.split('\n').length - 1 ? '16px' : 0,
                                                                                lineHeight: '1.8',
                                                                                fontSize: '14px',
                                                                                color: '#555',
                                                                                textAlign: 'justify'
                                                                            }}
                                                                            dangerouslySetInnerHTML={{ __html: processedText }}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        </Card>
                                                    );
                                                })}
                                            </div>

                                        {/* Character Network Visualization */}
                                        <div className="visualization-section">
                                            <Title level={4}>
                                                <UserOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                                                Character Network
                                            </Title>
                                            <Card className="network-card" style={{ marginBottom: '30px' }}>
                                                <div className="character-network">
                                                    {mainCharacters.map((character, index) => {
                                                        const charData = characterMap[character];
                                                        if (!charData) return null;
                                                        
                                                        return (
                                                            <div key={index} className="character-node">
                                                                <Avatar size={64} icon={<UserOutlined />} style={{
                                                                    backgroundColor: `hsl(${index * 40}, 70%, 50%)`
                                                                }} />
                                                                <div className="character-info">
                                                                    <h4>{character}</h4>
                                                                    <div className="character-stats">
                                                                        <Tag color="blue">Appearances: {charData.appearances}</Tag>
                                                                        {charData.traits.map((trait, i) => (
                                                                            <Tag key={i} color="cyan">{trait}</Tag>
                                                                        ))}
                                                                    </div>
                                                                    <div className="character-relationships">
                                                                        {Object.entries(charData.relationships).map(([relatedChar, dynamics], i) => (
                                                                            <div key={i} className="relationship-line">
                                                                                <small>{relatedChar}: {handleCharacterRelationship(dynamics)}</small>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Timeline Progression */}
                                        <div className="visualization-section">
                                            <Title level={4}>
                                                <FieldTimeOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                                                Story Timeline
                                            </Title>
                                            <Card className="timeline-card" style={{ marginBottom: '30px' }}>
                                                <Timeline mode="alternate">
                                                    {plotTimeline.map((event, index) => (
                                                        <Timeline.Item 
                                                            key={index}
                                                            color={index % 2 === 0 ? '#722ed1' : '#1890ff'}
                                                            dot={index % 2 === 0 ? <FieldTimeOutlined /> : <GlobalOutlined />}
                                                        >
                                                            <Card size="small" className="timeline-event">
                                                                <h4>{event.chapter}</h4>
                                                                <p>{event.events.join(', ')}</p>
                                                                <div className="event-details">
                                                                    <Tag color="purple">Location: {event.location}</Tag>
                                                                    {event.characters.map((char, i) => (
                                                                        <Tag key={i} color="blue">{char}</Tag>
                                                                    ))}
                                                                </div>
                                                                <div className="event-significance">
                                                                    <small>{event.significance}</small>
                                                                </div>
                                                            </Card>
                                                        </Timeline.Item>
                                                    ))}
                                                </Timeline>
                                            </Card>
                                        </div>

                                        {/* World Building Elements */}
                                        <div className="visualization-section">
                                            <Title level={4}>
                                                <GlobalOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                                                World Building Elements
                                            </Title>
                                            <Card className="world-building-card" style={{ marginBottom: '30px' }}>
                                                <Row gutter={[16, 16]}>
                                                    {Object.entries(worldBuildingElements).map(([category, elements], index) => (
                                                        <Col key={index} xs={24} sm={12} md={8}>
                                                            <Card 
                                                                title={category.charAt(0).toUpperCase() + category.slice(1)}
                                                                size="small"
                                                                className="element-card"
                                                            >
                                                                {Array.isArray(elements) ? (
                                                                    <ul className="element-list">
                                                                        {elements.map((element, i) => (
                                                                            <li key={i}>
                                                                                <Tag color="green">{element}</Tag>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                ) : (
                                                                    Object.entries(elements).map(([key, value], i) => (
                                                                        <div key={i} className="location-item">
                                                                            <h4>{key}</h4>
                                                                            <ul>
                                                                                {Array.isArray(value) && value.map((detail, j) => (
                                                                                    <li key={j}>{detail}</li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </Card>
                                        </div>

                                        {/* Plot Arc Analysis */}
                                        <div className="visualization-section">
                                            <Title level={4}>
                                                <BookOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
                                                Plot Arc Analysis
                                            </Title>
                                            <Card className="plot-arc-card" style={{ marginBottom: '30px' }}>
                                                <div className="plot-arcs">
                                                    {results.narrativeContext?.plotArcs.map((arc, index) => (
                                                        <div key={index} className="plot-arc">
                                                            <h4>{arc.type}</h4>
                                                            <Progress 
                                                                percent={arc.effectiveness * 20} 
                                                                strokeColor={{
                                                                    '0%': '#fa8c16',
                                                                    '100%': '#722ed1'
                                                                }}
                                                                format={() => `${arc.effectiveness}/5`}
                                                            />
                                                            <p>{arc.analysis}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Thematic Development */}
                                        <div className="visualization-section">
                                            <Title level={4}>
                                                <BookOutlined style={{ marginRight: 8, color: '#eb2f96' }} />
                                                Thematic Development
                                            </Title>
                                            <Card className="themes-card" style={{ marginBottom: '30px' }}>
                                                <div className="themes-grid">
                                                    {results.narrativeContext?.themes.map((theme, index) => (
                                                        <Card 
                                                            key={index} 
                                                            size="small" 
                                                            className="theme-card"
                                                            style={{ marginBottom: '15px' }}
                                                        >
                                                            <h4>{theme.name}</h4>
                                                            <Progress 
                                                                percent={theme.strength * 20}
                                                                strokeColor={{
                                                                    '0%': '#eb2f96',
                                                                    '100%': '#722ed1'
                                                                }}
                                                                format={() => `${theme.strength}/5`}
                                                            />
                                                            <p>{theme.development}</p>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </Card>
                                        </div>

                                        {downloadLink && (
                                            <a 
                                                href={downloadLink}
                                                download="analysis.csv"
                                                className="ant-btn ant-btn-primary"
                                                style={{ marginRight: '10px' }}
                                            >
                                                Download CSV
                                            </a>
                                        )}
                                        
                                        <Button 
                                            type="primary"
                                            icon={<FilePdfOutlined />}
                                            onClick={generateEnhancedPdf}
                                            loading={capturingPdf}
                                            className="pdf-button"
                                            style={{ 
                                                marginTop: '15px', 
                                                marginLeft: downloadLink ? '10px' : '0',
                                            }}
                                        >
                                            {capturingPdf ? 'Generating...' : 'Save Enhanced PDF'}
                                        </Button>
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}
            </Content>
            
            <Footer style={{ 
                textAlign: 'center', 
                background: '#ffffff',
                padding: '10px',
                color: '#000000',
                borderTop: '1px solid #f0f0f0'
            }}>
                eBook AI Analyzer ©{new Date().getFullYear()} - Powered by Next.js and OpenAI
            </Footer>

            {/* Analysis Overlay */}
            {showAnalysisOverlay && (
                <div className="analyzerOverlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{ maxWidth: '600px', textAlign: 'center' }}>
                        <div className="processingIndicator" style={{
                            marginBottom: '30px'
                        }}>
                            {/* Progress Bar */}
                            <div className="progressBar" style={{
                                width: '100%',
                                height: '8px',
                                backgroundColor: '#f0f0f0',
                                borderRadius: '4px',
                                marginBottom: '15px',
                                overflow: 'hidden'
                            }}>
                                <div className="progressFill" style={{
                                    height: '100%',
                                    width: `${progress}%`,
                                    backgroundColor: '#1890ff',
                                    transition: 'width 0.5s ease-in-out'
                                }}></div>
                            </div>
                            
                            {/* Status Information */}
                            <div className="statusInfo" style={{
                                color: '#000000',
                                marginBottom: '20px',
                                fontSize: '16px',
                                fontWeight: 'bold'
                            }}>
                                <span>{analysisStage}</span>
                                <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '5px' }}>
                                    {progress}% Complete
                                </div>
                            </div>
                            
                            {/* Processing details section */}
                            <div style={{
                                background: '#ffffff',
                                padding: '15px',
                                borderRadius: '8px',
                                marginTop: '20px',
                                textAlign: 'left',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                display: showLoader ? 'block' : 'none',
                                border: '1px solid #f0f0f0'
                            }}>
                                <div style={{ color: '#000000', opacity: 0.9, fontSize: '14px' }}>
                                    {processingLogs.map((log, index) => (
                                        <div key={index} style={{ marginBottom: '5px' }}>
                                            <span style={{ color: '#1890ff' }}>{`>`}</span> {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <Typography.Title level={4} style={{ color: '#000000', marginTop: '20px' }}>
                        {jobId ? 'Analyzing Your Book' : 'Preparing Analysis'}
                    </Typography.Title>
                </div>
            )}
            </div>
        </Layout>
    </ConfigProvider>
    );
}