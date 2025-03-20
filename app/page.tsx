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
import { App as AntApp } from 'antd';
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

            {/* Prompt-wise Analysis Section */}
            <View style={pdfStyles.section}>
                <PDFText style={pdfStyles.title}>Prompt-wise Analysis</PDFText>
                {data.analysis?.map((item, index) => (
                    <View key={index} style={pdfStyles.section}>
                        <PDFText style={pdfStyles.subtitle}>{item.Parameter}</PDFText>
                        <View style={pdfStyles.scoreContainer}>
                            <PDFText style={pdfStyles.scoreLabel}>Score:</PDFText>
                            <PDFText style={pdfStyles.scoreValue}>
                                {item.Score > 5 ? (item.Score / 2).toFixed(1) : item.Score}/5
                            </PDFText>
                        </View>
                        <PDFText style={pdfStyles.text}>{item.Justification}</PDFText>
                    </View>
                ))}
            </View>

            {/* Overall Score Section */}
            <View style={pdfStyles.section}>
                <PDFText style={pdfStyles.title}>Overall Assessment</PDFText>
                <View style={pdfStyles.scoreContainer}>
                    <PDFText style={pdfStyles.scoreLabel}>Overall Score:</PDFText>
                    <PDFText style={pdfStyles.scoreValue}>{data.totalScore}/5</PDFText>
                </View>
            </View>
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
    const resultCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        @keyframes pageFlip {
            0% { transform: rotateY(0deg); }
            50% { transform: rotateY(-180deg); }
            100% { transform: rotateY(0deg); }
        }

        @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes checkmark {
            0% { height: 0; width: 0; opacity: 0; }
            100% { height: 40px; width: 20px; opacity: 1; }
        }
        
        @keyframes thinking {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        
        @keyframes float {
            0% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-5px) rotate(2deg); }
            50% { transform: translateY(0) rotate(0deg); }
            75% { transform: translateY(5px) rotate(-2deg); }
            100% { transform: translateY(0) rotate(0deg); }
        }
        
        @keyframes rotateBook {
            0% { transform: rotate(0deg); }
            25% { transform: rotate(-5deg); }
            75% { transform: rotate(5deg); }
            100% { transform: rotate(0deg); }
        }
        
        .book-loading {
            position: relative;
            width: 100%;
            height: 100%;
            perspective: 1200px;
        }

        .book {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80px;
            height: 100px;
            transform-style: preserve-3d;
            animation: rotateBook 3s ease-in-out infinite;
        }

        .page {
            position: absolute;
            width: 100%;
            height: 100%;
            background: #fff;
            border: 2px solid #1890ff;
            border-radius: 3px;
            transform-origin: left center;
            transform-style: preserve-3d;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .page:nth-child(1) {
            animation: pageFlip 1.5s infinite;
        }

        .page:nth-child(2) {
            animation: pageFlip 1.5s infinite 0.3s;
        }

        .page:nth-child(3) {
            animation: pageFlip 1.5s infinite 0.6s;
        }
        
        .brain-container {
            position: absolute;
            top: 40%; /* Move higher */
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 200px; /* Fixed width */
        }
        
        .brain {
            font-size: 60px;
            margin-bottom: 20px;
            animation: float 3s ease-in-out infinite;
        }
        
        .thinking-dots {
            display: flex;
            justify-content: center;
            margin-top: 10px;
        }
        
        .dot {
            width: 10px;
            height: 10px;
            margin: 0 5px;
            background-color: #1890ff;
            border-radius: 50%;
            opacity: 0.8;
        }
        
        .dot:nth-child(1) {
            animation: thinking 0.8s ease-in-out infinite;
            animation-delay: 0s;
        }
        
        .dot:nth-child(2) {
            animation: thinking 0.8s ease-in-out infinite;
            animation-delay: 0.15s;
        }
        
        .dot:nth-child(3) {
            animation: thinking 0.8s ease-in-out infinite;
            animation-delay: 0.3s;
        }
        
        .ai-message {
            font-size: 18px;
            margin-top: 15px;
            text-align: center;
            font-weight: 500;
            color: #1890ff;
        }
        
        .funny-loading-messages {
            margin-top: 30px;
            text-align: center;
            min-height: 60px;
        }
        
        .loading-message {
            font-size: 16px;
            color: #555;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            text-align: center;
        }
        
        .loading-message.active {
            opacity: 1;
        }

        .success-animation {
            position: relative;
            width: 100%;
            height: 100%;
        }

        .checkmark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 3px solid #52c41a;
            animation: scaleIn 0.5s ease-in-out;
            background: #fff;
        }

        .check {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -60%) rotate(45deg);
            width: 20px;
            height: 40px;
            border: solid #52c41a;
            border-width: 0 3px 3px 0;
            opacity: 0;
            animation: checkmark 0.5s ease-in-out 0.5s forwards;
        }

        .analyzerOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
        }

        .loader-container {
            margin-bottom: 30px;
            position: relative;
            width: 120px;
            height: 120px;
            margin: 0 auto 30px;
        }

        .progressBar {
            width: 100%;
            max-width: 400px;
            height: 8px;
            background-color: #f0f0f0;
            border-radius: 4px;
            margin-bottom: 15px;
            overflow: hidden;
        }

        .progressFill {
            height: 100%;
            background-color: #1890ff;
            transition: width 0.5s ease-in-out, background-color 0.5s ease-in-out;
        }

        .statusInfo {
            color: #000000;
            margin-bottom: 20px;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
        }
        
        /* Fix for content overflow issues */
        .ant-card-body {
            overflow: hidden;
        }
        
        /* Fix for tag overflow */
        .ant-tag {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-bottom: 5px;
        }
        
        /* Character network fixes */
        .character-network {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .character-node {
            flex: 1 1 300px;
            max-width: 100%;
            padding: 15px;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            margin-bottom: 10px;
            overflow: hidden;
        }
        
        .character-info h4 {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }
        
        .character-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .character-relationships {
            max-height: 150px;
            overflow-y: auto;
            margin-top: 10px;
        }
        
        .relationship-line {
            white-space: normal;
            word-break: break-word;
            margin-bottom: 5px;
        }
        
        /* Timeline fixes */
        .timeline-event {
            max-width: 100%;
            overflow: hidden;
        }
        
        .timeline-event h4 {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .timeline-event p {
            max-height: 60px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }
        
        .event-details {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 8px;
        }
        
        .event-significance {
            margin-top: 8px;
            font-size: 12px;
            color: #666;
            max-height: 40px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        
        /* World building elements fixes */
        .element-card {
            height: 100%;
            overflow: hidden;
        }
        
        .element-list {
            list-style: none;
            padding-left: 0;
            margin: 0;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .element-list li {
            margin-bottom: 5px;
            white-space: normal;
            word-break: break-word;
        }
        
        .location-item {
            margin-bottom: 10px;
        }
        
        .location-item h4 {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .location-item ul {
            padding-left: 15px;
            max-height: 150px;
            overflow-y: auto;
        }
        
        .location-item ul li {
            white-space: normal;
            word-break: break-word;
            margin-bottom: 5px;
        }
        
        /* Plot arc and theme fixes */
        .plot-arcs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .plot-arc {
            height: 100%;
        }
        
        .theme-card p {
            white-space: normal;
            word-break: break-word;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
        }
        
        /* Custom card fixes */
        .custom-card {
            overflow: hidden;
        }
        
        /* Editorial feedback fixes */
        .feedback-entry {
            width: 100%;
            overflow: hidden;
        }
        
        .feedback-entry h4 {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }
        
        .feedback-entry p, .feedback-entry .ant-typography {
            white-space: normal;
            word-break: break-word;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
        }
        
        .citation-text {
            white-space: normal;
            word-break: break-word;
            overflow: hidden;
            max-height: 150px;
            overflow-y: auto;
        }
        
        /* Mobile responsiveness fixes */
        @media (max-width: 768px) {
            .plot-arcs {
                grid-template-columns: 1fr;
            }
            
            .mobile-responsive-button {
                width: 100%;
                margin: 5px 0 !important;
            }
            
            .character-node {
                flex: 1 1 100%;
            }
        }
    `;
    
    // Refs for capturing PDF content
    const editorialContentRef = useRef<HTMLDivElement>(null);
    const analysisContentRef = useRef<HTMLDivElement>(null);
    
    // Create a message API instance
    const [messageApi, contextHolder] = message.useMessage();

    // Add these near the other state variables
    const [vercelDeployment, setVercelDeployment] = useState(true); // Set to true by default for serverless operation
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    
    // Add this to the component
    const funnyLoadingMessages = [
        "Reading every word... twice for good measure",
        "Consulting with fictional literary experts",
        "Teaching AI to recognize sarcasm (still working on it)",
        "Searching for plot holes... and donuts",
        "Analyzing whether any characters would make good memes",
        "Counting words obsessively",
        "Debating whether this book would make a good movie",
        "Finding the deepest meaning... or making one up",
        "Brewing coffee for our AI brain cells",
        "Checking if AI would be a better protagonist",
        "Building suspense... by processing very slowly",
        "Wondering if we should write our own book instead",
        "Calculating how many trees were saved by using eBooks",
        "Judging the book by its cover (then by its content)",
        "Taking a quick nap... just kidding, AIs don't sleep",
        "Job status not found, but we're still thinking really hard"
    ];

    // Add this useEffect to rotate through the funny messages
    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (vercelDeployment && showAnalysisOverlay) {
            interval = setInterval(() => {
                setLoadingMessageIndex(prev => (prev + 1) % funnyLoadingMessages.length);
            }, 4000);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [vercelDeployment, showAnalysisOverlay, funnyLoadingMessages.length]);
    
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
                            setVercelDeployment(true);
                            
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
    
    // Check URL parameters for serverless mode request
    useEffect(() => {
        // If URL contains ?serverless=true, automatically switch to serverless mode
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('serverless') === 'true') {
                console.log("Serverless mode detected in URL, activating serverless mode");
                setVercelDeployment(true);
                
                // Remove the parameter from URL to avoid loops
                const newUrl = window.location.pathname + 
                    (window.location.search.replace(/[?&]serverless=true/, '')
                        .replace(/^&/, '?') || '') +
                    window.location.hash;
                window.history.replaceState({}, document.title, newUrl);
                
                // Show message to user
                message.info("Running in serverless mode for better stability", 5);
            }
        }
    }, []);
    
    // Function to restart in emergency mode
    const restartInEmergencyMode = () => {
        // Add serverless=true parameter to URL and reload page
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('serverless', 'true');
        window.location.href = currentUrl.toString();
    };

    // Add check for final result button to serverless display
    const checkForResults = () => {
        message.loading("Checking for results...", 3);
        checkFinalResult(false);
    };
    
    // Improved serverless progress checker
    const startSimpleProgressCheck = () => {
        // Use artificial progress as fallback
        let artificialProgress = 10;
        let checkCounter = 0;
        
        // Clear any existing interval
        if (resultCheckIntervalRef.current) {
            clearInterval(resultCheckIntervalRef.current);
        }
        
        // Use a much slower polling interval (60 seconds instead of 12)
        const autoCheckInterval = setInterval(() => {
            checkCounter++;
            
            // Skip network requests entirely most of the time
            // Only check the server every 3rd interval to reduce load
            if (checkCounter % 3 === 0) {
                fetch(`/api/analyze?finalResult=true&jobId=${jobId}`, {
                    // Add timeout to prevent hanging requests
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                })
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error("Not ready yet");
                })
                .then(data => {
                    if (data.analysis) {
                        // Success! We have the final data
                        clearInterval(autoCheckInterval);
                        setLoading(false);
                        setProgress(100);
                        setAnalysisStage("Analysis complete!");
                        setShowAnalysisOverlay(false);
                        resultCheckIntervalRef.current = null;
                        
                        // Update UI with results
                        setAnalysis(data.analysis);
                        setSummary(data.summary || "");
                        setPrologue(data.prologue || "");
                        setConstructiveCriticism(data.constructiveCriticism || "");
                        
                        // Notify user of completion
                        message.success("Analysis completed successfully!", 5);
                    } else {
                        // Still processing, increase progress gradually
                        // Calculate progress in a way that never quite reaches 100%
                        artificialProgress = Math.min(artificialProgress + (4 - (0.1 * checkCounter)), 95);
                        setProgress(artificialProgress);
                        
                        // Update UI with more specific messages based on progress
                        updateProgressStage(artificialProgress);
                    }
                })
                .catch(error => {
                    console.log("Periodic check failed, continuing with estimate");
                    // Still update progress even on failure
                    artificialProgress = Math.min(artificialProgress + 1, 90);
                    setProgress(artificialProgress);
                    updateProgressStage(artificialProgress);
                });
            } else {
                // Just update progress without network request
                artificialProgress = Math.min(artificialProgress + 2, 90);
                setProgress(artificialProgress);
                updateProgressStage(artificialProgress);
            }
        }, 60000); // 60 seconds instead of 12 seconds
        
        // Store interval ref so we can clear it when needed
        resultCheckIntervalRef.current = autoCheckInterval;
        
        // Update UI with initial progress stage
        updateProgressStage(artificialProgress);
    };
    
    // Helper function to update progress stage based on progress percentage
    const updateProgressStage = (progress: number) => {
        if (progress < 20) {
            setAnalysisStage("Extracting text from document...");
        } else if (progress < 40) {
            setAnalysisStage("Analyzing document structure...");
        } else if (progress < 60) {
            setAnalysisStage("Processing content and relationships...");
        } else if (progress < 75) {
            setAnalysisStage("Generating insights...");
        } else if (progress < 85) {
            setAnalysisStage("Evaluating narrative elements...");
        } else {
            setAnalysisStage("Finalizing analysis...");
        }
    };
    
    // Check for final result directly instead of relying on status updates
    const checkFinalResult = async (showError: boolean = true) => {
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
        setShowAnalysisOverlay(true);
        
        try {
            // Reset all states
            setAnalysis([]);
            setSummary('');
            setPrologue('');
            setConstructiveCriticism('');
            setDownloadLink(null);
            setProcessingLogs([]);
            setCharacterMap({});
            setMainCharacters([]);
            setPlotTimeline([]);
            setWorldBuildingElements({
                locations: {},
                customs: [],
                history: [],
                rules: [],
                technology: [],
                socialStructure: []
            });
            setResults({
                percentage: 0,
                totalScore: 0,
                maxPossibleScore: 5,
                strengths: [],
                improvements: [],
                narrativeContext: {
                    plotArcs: [],
                    themes: []
                }
            });
            
            // Process all files concurrently
            const uploadPromises = files.map(async (fileStatus, index) => {
                try {
                    const formData = new FormData();
                    formData.append('file', fileStatus.file);
                    formData.append("processType", "complete");
                    
                    setFiles(prev => prev.map((f, i) => 
                        i === index ? { ...f, status: 'uploading' } : f
                    ));
                    
                    setProcessingLogs(prev => [...prev, `Starting analysis of ${fileStatus.file.name}...`]);

                    const response = await fetch("/api/analyze", {
                        method: "POST",
                        body: formData,
                        headers: {
                            'x-process-mode': 'complete-pdf',
                            'x-analysis-depth': 'comprehensive',
                            'x-character-tracking': 'enabled',
                            'x-context-analysis': 'deep',
                            'x-world-building': 'enabled',
                            'x-plot-analysis': 'enabled',
                            'x-theme-analysis': 'enabled',
                            'x-exclude-authors': 'true',
                            'x-character-filter': 'strict',
                            'x-serverless-mode': 'true' // Add header to signal serverless mode to backend
                        }
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({
                            error: `Server returned status ${response.status}`
                        }));
                        
                        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
                    }

                    const data = await response.json();
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    if (data.jobId) {
                        setJobId(data.jobId); // Set job ID at the top level for easier access
                        setFiles(prev => prev.map((f, i) => 
                            i === index ? { ...f, jobId: data.jobId } : f
                        ));
                        
                        setProcessingLogs(prev => [
                            ...prev, 
                            `Analysis started for ${fileStatus.file.name}`,
                            'Processing in serverless mode...',
                            'Your file is being analyzed in the background...',
                            'Results will appear when processing is complete.'
                        ]);
                        
                        // Start serverless progress check immediately
                        startSimpleProgressCheck();
                    } else {
                        throw new Error('No job ID received from server');
                    }

                } catch (error: any) {
                    console.error(`Error uploading ${fileStatus.file.name}:`, error);
                    setFiles(prev => prev.map((f, i) => 
                        i === index ? { ...f, status: 'error', error: error.message } : f
                    ));
                    setProcessingLogs(prev => [...prev, `Error processing ${fileStatus.file.name}: ${error.message}`]);
                    messageApi.error(`Failed to process ${fileStatus.file.name}: ${error.message}`);
                }
            });
            
            await Promise.all(uploadPromises);
            setUploading(false);
            
        } catch (error: any) {
            console.error('Upload failed:', error);
            messageApi.error('Upload failed');
            setShowLoader(false);
            setShowAnalysisOverlay(false);
            setUploading(false);
        }
    };

    // Add new function for polling job status
    const pollJobStatus = async (jobId: string, fileIndex: number) => {
        try {
            const response = await fetch(`/api/analyze?jobId=${jobId}&type=status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: `Server returned status ${response.status}: ${response.statusText}`
                }));
                
                throw new Error(errorData.error || `Server error: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Check for error in the response data
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Special handling for Vercel deployments where job status is lost between serverless function calls
            if (data.vercelDeployment) {
                console.log("Received vercelDeployment status - job status not found but continuing processing");
                setVercelDeployment(true); // Set flag for better UI experience
                
                // Update progress but not too quickly to avoid false completions
                const currentProgress = progress || 0;
                const newProgress = Math.min(currentProgress + 5, 90); // Cap at 90% until we get real completion
                setProgress(newProgress);
                
                if (data.message) {
                    setAnalysisStage(data.message);
                    // Only add this message once to avoid duplicates
                    if (!processingLogs.includes(data.message)) {
                        setProcessingLogs(prev => [...prev, data.message]);
                    }
                }
                
                // Instead of error, we'll just keep polling but slow it down a bit
                setTimeout(() => {
                    // After about a minute, try to get the final result
                    if (newProgress > 85) {
                        // Try to get the final result directly
                        fetch(`/api/analyze?finalResult=true&jobId=${jobId}`)
                            .then(response => response.json())
                            .then(finalData => {
                                if (finalData.analysis) {
                                    // Success! We have the final data
                                    updateUIWithResults(finalData, fileIndex);
                                    return;
                                } else {
                                    // Still processing, continue polling
                                    pollJobStatus(jobId, fileIndex);
                                }
                            })
                            .catch(error => {
                                console.error("Error checking final result:", error);
                                pollJobStatus(jobId, fileIndex);
                            });
                    } else {
                        // Continue regular polling
                        pollJobStatus(jobId, fileIndex);
                    }
                }, 4000); // Increased polling interval for Vercel
                
                return;
            }
            
            // Update progress and stage
            if (data.progress !== undefined) {
                setProgress(data.progress);
            }
            if (data.stage) {
                setAnalysisStage(data.stage);
            }
            
            // Update file status and analysis data
            if (data.status === 'completed' && data.analysis) {
                updateUIWithResults(data, fileIndex);
                return;
            }
            
            // Continue polling if job is still in progress
            setTimeout(() => pollJobStatus(jobId, fileIndex), 2000);
            
        } catch (error: any) {
            console.error('Error polling job status:', error);
            handleAnalysisError(error.message || 'Failed to check job status', fileIndex);
        }
    };

    // Helper function to update UI with results to avoid code duplication
    const updateUIWithResults = (data: any, fileIndex: number) => {
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            status: 'success',
            progress: 100,
            analysis: data.analysis
        };
        setFiles(updatedFiles);
        
        // Update analysis states with the complete data
        // Fix the structure mismatch between frontend and backend
        setAnalysis(Array.isArray(data.analysis) ? data.analysis : []);
        setSummary(data.summary || '');
        setPrologue(data.prologue || '');
        setConstructiveCriticism(data.constructiveCriticism || '');
        
        // Update character network
        if (data.characters) {
            setCharacterMap(data.characters.characterMap || {});
            setMainCharacters(data.characters.mainCharacters || []);
        }
        
        // Update plot timeline
        if (data.timeline) {
            setPlotTimeline(data.timeline || []);
        }
        
        // Update world building elements
        if (data.worldBuilding) {
            setWorldBuildingElements({
                locations: data.worldBuilding.locations || {},
                customs: data.worldBuilding.customs || [],
                history: data.worldBuilding.history || [],
                rules: data.worldBuilding.rules || [],
                technology: data.worldBuilding.technology || [],
                socialStructure: data.worldBuilding.socialStructure || []
            });
        }
        
        // Calculate overall score
        if (Array.isArray(data.analysis)) {
            const scores = data.analysis.map(item => 
                item.Score > 5 ? item.Score / 2 : item.Score
            );
            const totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            setResults({
                ...results,
                totalScore: Math.round(totalScore * 10) / 10,
                maxPossibleScore: 5,
                percentage: (totalScore / 5) * 100,
                strengths: data.strengths || [],
                improvements: data.improvements || [],
                narrativeContext: {
                    plotArcs: data.plotArcs || [],
                    themes: data.themes || []
                }
            });
        }
        
        setProcessingLogs(prevLogs => [...prevLogs, 'Analysis completed successfully!']);
        setShowLoader(false);
        setShowAnalysisOverlay(false);
        messageApi.success('Analysis completed successfully!');
    };

    // Helper function to handle analysis errors
    const handleAnalysisError = (errorMessage: string, fileIndex: number) => {
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            status: 'error',
            error: errorMessage
        };
        setFiles(updatedFiles);
        setShowLoader(false);
        setShowAnalysisOverlay(false);
        messageApi.error(`Analysis failed: ${errorMessage}`);
        setProcessingLogs(prev => [...prev, `Error: ${errorMessage}`]);
    };

    // Helper function to update world building elements
    const updateWorldBuildingElements = (worldBuilding: Record<string, string[]>) => {
        setWorldBuildingElements(prevElements => {
            const newElements = { ...prevElements };
            Object.entries(worldBuilding).forEach(([key, value]) => {
                newElements[key] = Array.from(new Set([...(newElements[key] || []), ...value]));
            });
            return newElements;
        });
    };

    // Helper function to update analysis states
    const updateAnalysisStates = (data: any) => {
        if (data.analysis) setAnalysis(data.analysis);
        if (data.summary) setSummary(data.summary);
        if (data.prologue) setPrologue(data.prologue);
        if (data.constructiveCriticism) setConstructiveCriticism(data.constructiveCriticism);
        if (data.csvContent) {
            const blob = new Blob([data.csvContent], { type: 'text/csv' });
            setDownloadLink(URL.createObjectURL(blob));
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
                  size={50}
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

    // Helper function to format text with citations in different fonts
    const formatTextWithCitations = (text: string, itemIndex: number) => {
        // Split the text into paragraphs
        const paragraphs = text.split('\n');
        
        // Return formatted paragraphs with citations in different styles
        return paragraphs.map((paragraph, i) => {
            // Check if this paragraph is a citation (typically in quotes or with special markers)
            const isCitation = /^["']|^\[.*?\]|^Citation:|^Reference:/i.test(paragraph.trim());
            
            // Style differently based on whether it's a citation or regular text
            if (isCitation) {
                // Create citation style with different font and background
                return (
                    <div 
                        key={`${itemIndex}-${i}`}
                        className="citation-text"
                        style={{
                            fontFamily: '"Georgia", serif',
                            fontSize: '15px',
                            fontStyle: 'italic',
                            color: '#333',
                            background: 'rgba(0, 0, 0, 0.03)',
                            padding: '12px 15px',
                            borderLeft: '3px solid #1890ff',
                            marginBottom: '15px',
                            marginTop: '10px',
                            borderRadius: '0 4px 4px 0',
                            position: 'relative'
                        }}
                    >
                        <div 
                            style={{
                                position: 'absolute',
                                top: '5px',
                                right: '10px',
                                fontSize: '12px',
                                color: '#999'
                            }}
                        >
                            Citation
                        </div>
                        {paragraph}
                    </div>
                );
            } 
            // Special formatting for headings (paragraphs that are short and end with a colon)
            else if (/^.{5,50}:$/.test(paragraph) && paragraph.length < 60) {
                return (
                    <h4 
                        key={`${itemIndex}-${i}`}
                        style={{
                            marginTop: '15px',
                            marginBottom: '8px',
                            fontWeight: 'bold',
                            color: '#1890ff',
                            fontSize: '16px'
                        }}
                    >
                        {paragraph}
                    </h4>
                );
            }
            // Identify and style key terms, highlights, and bullet points
            else {
                const processedText = paragraph
                    // Convert **text** to proper headings
                    .replace(/\*\*(.*?)\*\*/g, '<h4 style="margin: 15px 0 8px; color: #333; font-size: 16px; border-bottom: 1px solid #f0f0f0; padding-bottom: 5px;">$1</h4>')
                    .replace(/\*(.*?)\*/g, '<span style="font-style: italic;">$1</span>')
                    .replace(/- (.*?)(?=\n|$)/g, '<div style="margin-bottom: 8px;"><span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #1890ff; margin-right: 8px; margin-bottom: 2px;"></span>$1</div>')
                    .replace(/\b(excellent|outstanding|exceptional|remarkable|impressive)\b/gi, '<span style="color: #52c41a; font-weight: 500;">$1</span>')
                    .replace(/\b(improvement|improve|lacking|weak|limited)\b/gi, '<span style="color: #faad14; font-weight: 500;">$1</span>')
                    .replace(/\b(poor|inadequate|deficient|problematic|flawed)\b/gi, '<span style="color: #f5222d; font-weight: 500;">$1</span>');
                    
                return (
                    <div 
                        key={`${itemIndex}-${i}`}
                        style={{ 
                            marginBottom: i < paragraphs.length - 1 ? '16px' : 0,
                            lineHeight: '1.8',
                            fontSize: '14px',
                            color: '#555',
                            textAlign: 'justify'
                        }}
                        dangerouslySetInnerHTML={{ __html: processedText }}
                    />
                );
            }
        });
    };

    // Function to generate DOCX report
    const generateDocx = async () => {
        try {
            setCapturingPdf(true);
            messageApi.loading('Generating Word document...');
            
            // Create a new instance of Document
            const doc = new DocxDocument({
                sections: [{
                    properties: {},
                    children: [
                        // Title Page
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "eBook Analysis Report",
                                    bold: true,
                                    size: 32
                                })
                            ],
                            spacing: {
                                after: 400
                            }
                        }),
                        
                        // Summary Section
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Book Summary",
                                    bold: true,
                                    size: 28,
                                    color: '1890FF'
                                })
                            ],
                            spacing: { before: 400, after: 200 }
                        }),
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: summary || "No summary available",
                                    size: 24
                                })
                            ],
                            spacing: { after: 200 }
                        }),
                        
                        // Overall Score
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Overall Assessment",
                                    bold: true,
                                    size: 28
                                })
                            ],
                            spacing: { before: 400, after: 200 }
                        }),
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: `Overall Score: ${results.totalScore}/5`,
                                    size: 24,
                                    bold: true
                                })
                            ],
                            spacing: { after: 200 }
                        }),
                        
                        // Strengths
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Key Strengths",
                                    bold: true,
                                    size: 24
                                })
                            ],
                            spacing: { before: 200, after: 100 }
                        }),
                        ...results.strengths.map(strength => 
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: `• ${strength}`,
                                        size: 24
                                    })
                                ],
                                spacing: { after: 100 }
                            })
                        ),
                        
                        // Areas for Improvement
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Areas for Improvement",
                                    bold: true,
                                    size: 24
                                })
                            ],
                            spacing: { before: 200, after: 100 }
                        }),
                        ...results.improvements.map(item => 
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: `• ${item.area} (Score: ${item.score}/5): ${item.justification}`,
                                        size: 24
                                    })
                                ],
                                spacing: { after: 100 }
                            })
                        ),
                        
                        // Detailed Analysis
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Detailed Analysis",
                                    bold: true,
                                    size: 28
                                })
                            ],
                            spacing: { before: 400, after: 200 }
                        }),
                        ...analysis.map(item => [
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: item.Parameter,
                                        bold: true,
                                        size: 24
                                    })
                                ],
                                spacing: { before: 200, after: 100 }
                            }),
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: `Score: ${item.Score > 5 ? (item.Score / 2).toFixed(1) : item.Score}/5`,
                                        size: 24,
                                        color: 
                                            item.Score >= 4 ? '52C41A' :
                                            item.Score >= 3 ? 'FAAD14' : 'F5222D'
                                    })
                                ],
                                spacing: { after: 100 }
                            }),
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: item.Justification,
                                        size: 24
                                    })
                                ],
                                spacing: { after: 200 }
                            })
                        ]).flat()
                    ]
                }]
            });

            // Generate and save the document
            const buffer = await Packer.toBuffer(doc);
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(blob, 'ebook-analysis.docx');
            
            messageApi.success('Word document generated successfully!');
        } catch (error) {
            console.error('Error generating DOCX:', error);
            messageApi.error('Failed to generate DOCX report');
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
                let yPos = 160;
                
                // Add prompt-wise analysis
                pdf.setFontSize(16);
                pdf.text('Prompt-wise Analysis', 40, yPos);
                yPos += 30;
                
                // Make sure analysis is actually an array we can iterate over
                const analysisArray = Array.isArray(file.analysis) ? file.analysis : 
                                       (Array.isArray(file.analysis.parameters) ? file.analysis.parameters : []);
                
                analysisArray.forEach((item: any) => {
                    if (yPos > 750) {
                        pdf.addPage();
                        yPos = 40;
                    }
                    
                    pdf.setFontSize(14);
                    pdf.text(item.Parameter, 40, yPos);
                    yPos += 20;
                    
                    pdf.setFontSize(12);
                    const score = item.Score > 5 ? (item.Score / 2).toFixed(1) : item.Score;
                    pdf.text(`Score: ${score}/5`, 40, yPos);
                    yPos += 20;
                    
                    const justificationLines = pdf.splitTextToSize(item.Justification, pageWidth - 80);
                    justificationLines.forEach((line: string) => {
                        if (yPos > 750) {
                            pdf.addPage();
                            yPos = 40;
                        }
                        pdf.text(line, 40, yPos);
                        yPos += 20;
                    });
                    
                    yPos += 20;
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

    // Add state for screenshot in progress
    const [takingScreenshot, setTakingScreenshot] = useState(false);
    
    // Function to capture full page screenshot in A4 segments
    const captureFullPageScreenshot = async () => {
        try {
            setTakingScreenshot(true);
            messageApi.loading('Capturing and processing screenshots...');
            
            // Wait for the message to display
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Hide any open message first
            messageApi.destroy();
            
            // Get the main content container with proper type assertion
            const contentElement = document.querySelector('.content-container') as HTMLElement;
            if (!contentElement) {
                throw new Error('Content container not found');
            }
            
            // A4 size proportions in PDF points (595 x 842 points at 72 DPI)
            // For screen display, use a proportional but smaller height to match
            // what would fit on an A4 page when printed
            const a4Width = 595; // Standard A4 width in points
            const a4Height = 842; // Standard A4 height in points
            
            // Scale for screen rendering (assuming 96 DPI screen)
            const screenScale = window.devicePixelRatio || 1;
            const scaledWidth = Math.floor(a4Width * 1.3); // Slightly larger for better quality
            const scaledHeight = Math.floor(a4Height * 1.3); // Maintain proportion
            
            // Get the actual dimensions of the content
            const totalHeight = contentElement.scrollHeight;
            const totalWidth = contentElement.scrollWidth;
            
            // Calculate how many segments we need (use the scaledHeight for division)
            const numSegments = Math.ceil(totalHeight / scaledHeight);
            
            console.log('Content dimensions:', { 
                totalWidth, 
                totalHeight, 
                a4Width, 
                a4Height, 
                scaledWidth, 
                scaledHeight, 
                numSegments,
                devicePixelRatio: window.devicePixelRatio
            });
            
            messageApi.loading(`Splitting content into ${numSegments} A4 pages...`);
            
            // Array to hold all segment canvases
            const segments: HTMLCanvasElement[] = [];
            
            // Create a reusable canvas for the entire content to avoid multiple renderings
            const fullCanvas = await html2canvas(contentElement, {
                scrollX: 0,
                scrollY: -window.scrollY,
                width: totalWidth,
                height: totalHeight,
                scale: screenScale,
                allowTaint: true,
                useCORS: true,
                logging: false
            });
            
            // Split into A4 sized segments
            for (let i = 0; i < numSegments; i++) {
                // Calculate the segment's y-position and height
                const segmentY = i * scaledHeight;
                const segmentHeight = Math.min(scaledHeight, totalHeight - segmentY);
                
                // Create a new canvas for this segment
                const segmentCanvas = document.createElement('canvas');
                segmentCanvas.width = scaledWidth;
                segmentCanvas.height = segmentHeight;
                
                // Draw the portion of the full canvas onto this segment
                const ctx = segmentCanvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(
                        fullCanvas, 
                        0, segmentY,              // Source x, y
                        totalWidth, segmentHeight, // Source width, height
                        0, 0,                     // Destination x, y
                        scaledWidth, segmentHeight // Destination width, height
                    );
                }
                
                segments.push(segmentCanvas);
            }
            
            // Save each segment as a separate image
            segments.forEach((canvas, index) => {
                const imgData = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `ebook-analysis-page-${index + 1}-of-${numSegments}.png`;
                link.href = imgData;
                link.click();
            });
            
            // Also create a combined PDF with all pages
            if (segments.length > 0) {
                try {
                    // Create PDF document
                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'pt',
                        format: 'a4'
                    });
                    
                    // Add each segment as a page
                    segments.forEach((canvas, index) => {
                        // For pages after the first, add a new page
                        if (index > 0) {
                            pdf.addPage();
                        }
                        
                        // Convert canvas to image
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        
                        // Add to PDF - adjust image to fit A4 page
                        pdf.addImage(imgData, 'JPEG', 0, 0, a4Width, a4Height * (canvas.height / scaledHeight));
                    });
                    
                    // Save the combined PDF
                    pdf.save('ebook-analysis-complete.pdf');
                    
                    // Success message for PDF
                    messageApi.success('Created PDF with all pages!', 3);
                } catch (pdfError) {
                    console.error('Error creating PDF:', pdfError);
                    messageApi.error('Failed to create PDF. Individual images were saved successfully.');
                }
            }
            
            // Optional: Also create a stitched image if there are multiple segments
            if (numSegments > 1) {
                // Create a canvas for the stitched image
                const stitchedCanvas = document.createElement('canvas');
                stitchedCanvas.width = scaledWidth;
                stitchedCanvas.height = totalHeight;
                
                // Draw all segments onto the stitched canvas
                const ctx = stitchedCanvas.getContext('2d');
                if (ctx) {
                    segments.forEach((segment, index) => {
                        ctx.drawImage(segment, 0, index * scaledHeight);
                    });
                    
                    // Save the stitched image
                    const imgData = stitchedCanvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `ebook-analysis-full-stitched.png`;
                    link.href = imgData;
                    
                    // Add a slight delay to avoid conflicts with individual segment downloads
                    setTimeout(() => {
                        link.click();
                    }, 1000);
                }
            }
            
            messageApi.success(`Saved ${numSegments} A4 page screenshots and PDF!`, 5);
        } catch (error) {
            console.error('Error capturing A4 screenshots:', error);
            messageApi.error('Failed to capture screenshots. Please try again.');
        } finally {
            setTakingScreenshot(false);
        }
    };

    // Function to directly create a PDF report from the current analysis
    const generatePdfReport = async () => {
        try {
            setCapturingPdf(true);
            messageApi.loading('Generating high-quality PDF report...');
            
            // Get the analysis content
            const analysisElement = document.querySelector('.content-container') as HTMLElement;
            if (!analysisElement) {
                throw new Error('Content element not found');
            }
            
            // Create PDF with standard A4 size
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });
            
            // PDF dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // Add cover page
            pdf.setFontSize(28);
            pdf.setTextColor(24, 144, 255); // Blue color
            pdf.text('eBook AI Analysis Report', pageWidth / 2, 100, { align: 'center' });
            
            // Add timestamp
            pdf.setFontSize(14);
            pdf.setTextColor(80, 80, 80); // Dark gray
            pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 140, { align: 'center' });
            
            // Add logo/graphic
            pdf.setFontSize(60);
            pdf.setTextColor(200, 200, 200); // Light gray
            pdf.text('📖', pageWidth / 2, 220, { align: 'center' });
            
            // Add quality note
            pdf.setFontSize(12);
            pdf.setTextColor(100, 100, 100);
            pdf.text('High-Quality Analysis Report', pageWidth / 2, pageHeight - 60, { align: 'center' });
            
            // Render with maximum quality settings
            const canvas = await html2canvas(analysisElement, {
                scale: 3, // Higher scale for better quality
                useCORS: true,
                allowTaint: true,
                scrollY: -window.scrollY,
                logging: false,
                backgroundColor: '#ffffff',
                imageTimeout: 0, // No timeout
                onclone: (clonedDoc) => {
                    // Improve styling in the cloned document for better PDF rendering
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        * { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            color: #000 !important;
                        }
                        h1, h2, h3, h4, h5, h6 { font-weight: bold !important; }
                        .citation-text { 
                            background: #f6f6f6 !important;
                            border-left: 3px solid #333 !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });
            
            // Calculate how many pages needed with higher resolution
            const imgHeight = canvas.height;
            const imgWidth = canvas.width;
            
            // Content scaling to fit page width with better margins
            const contentWidth = pageWidth - 60; // 30pt margins on both sides
            const scaleFactor = contentWidth / imgWidth;
            const contentHeight = imgHeight * scaleFactor;
            
            // How many pages this will take
            const totalPages = Math.ceil(contentHeight / (pageHeight - 140)); // 140pt for headers/margins
            
            // Calculate content segments with better precision
            for (let i = 0; i < totalPages; i++) {
                if (i > 0) {
                    pdf.addPage();
                }
                
                // Source area height with improved calculation
                const sourceHeight = Math.ceil((pageHeight - 140) / scaleFactor);
                const sourceY = i * sourceHeight;
                
                // Create temporary canvas for this segment with higher quality
                const tempCanvas = document.createElement('canvas');
                const ctx = tempCanvas.getContext('2d', { alpha: false });
                
                tempCanvas.width = imgWidth;
                tempCanvas.height = Math.min(sourceHeight, imgHeight - sourceY);
                
                if (ctx) {
                    // Improve rendering quality with better settings
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Clear background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    
                    // Draw portion to temp canvas
                    ctx.drawImage(
                        canvas,
                        0, sourceY,
                        imgWidth, tempCanvas.height,
                        0, 0,
                        imgWidth, tempCanvas.height
                    );
                    
                    // Add to PDF with better compression
                    const imgData = tempCanvas.toDataURL('image/jpeg', 1.0); // Maximum quality
                    pdf.addImage(
                        imgData, 
                        'JPEG', 
                        30, 40, // Margins
                        contentWidth, tempCanvas.height * scaleFactor
                    );
                    
                    // Add header
                    pdf.setFontSize(10);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text('eBook AI Analysis', 30, 20);
                    
                    // Add page number with better styling
                    pdf.setFontSize(10);
                    pdf.setTextColor(80, 80, 80);
                    pdf.text(`Page ${i+1} of ${totalPages}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
                }
            }
            
            // Save the PDF with a better filename
            pdf.save('ebook-analysis-professional-report.pdf');
            messageApi.success('High-quality PDF report generated successfully!');
        } catch (error) {
            console.error('Error generating PDF report:', error);
            messageApi.error('Failed to generate PDF report');
        } finally {
            setCapturingPdf(false);
        }
    };

    // Function to generate a simple DOCX report with just the analysis data
    const generateSimpleDocx = async () => {
        try {
            setCapturingPdf(true);
            messageApi.loading('Generating simple Word document...');
            
            // Create a new instance of Document
            const doc = new DocxDocument({
                sections: [{
                    properties: {},
                    children: [
                        // Title
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "eBook Analysis Report",
                                    bold: true,
                                    size: 36
                                })
                            ],
                            spacing: { after: 300 }
                        }),
                        
                        // Summary
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: "Book Summary",
                                    bold: true,
                                    size: 28
                                })
                            ],
                            spacing: { before: 200, after: 100 }
                        }),
                        new DocxParagraph({
                            children: [
                                new TextRun({
                                    text: summary || "No summary available",
                                    size: 24
                                })
                            ],
                            spacing: { after: 200 }
                        }),
                        
                        // Analysis Items
                        ...analysis.map(item => [
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: item.Parameter,
                                        bold: true,
                                        size: 24
                                    })
                                ],
                                spacing: { before: 200, after: 50 }
                            }),
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: `Score: ${item.Score}/5`,
                                        size: 24
                                    })
                                ],
                                spacing: { after: 50 }
                            }),
                            new DocxParagraph({
                                children: [
                                    new TextRun({
                                        text: item.Justification,
                                        size: 24
                                    })
                                ],
                                spacing: { after: 200 }
                            })
                        ]).flat()
                    ]
                }]
            });

            // Generate and save the document
            const buffer = await Packer.toBuffer(doc);
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            saveAs(blob, 'simple-ebook-analysis.docx');
            
            messageApi.success('Simple Word document generated successfully!');
        } catch (error) {
            console.error('Error generating DOCX:', error);
            messageApi.error('Failed to generate DOCX report');
        } finally {
            setCapturingPdf(false);
        }
    };

    // Initialize for serverless operation
    useEffect(() => {
        // Initialize app for serverless mode
        if (typeof window !== 'undefined') {
            console.log('Initializing app in serverless mode');
            
            // Handle page visibility change to check for results when user returns to tab
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && jobId && progress < 100 && progress > 10) {
                    console.log('Page became visible, checking for results...');
                    checkForResults();
                }
            });
            
            // Save job ID in sessionStorage for recovery if page refreshes
            if (jobId) {
                sessionStorage.setItem('currentJobId', jobId);
            } else {
                const savedJobId = sessionStorage.getItem('currentJobId');
                if (savedJobId && !analysis.length) {
                    console.log('Recovered job ID from session:', savedJobId);
                    setJobId(savedJobId);
                    // Try to get results for the saved job ID
                    fetch(`/api/analyze?finalResult=true&jobId=${savedJobId}`)
                        .then(response => response.ok ? response.json() : null)
                        .then(data => {
                            if (data && data.analysis) {
                                setAnalysis(data.analysis);
                                setSummary(data.summary || "");
                                setPrologue(data.prologue || "");
                                setConstructiveCriticism(data.constructiveCriticism || "");
                                message.success('Recovered your previous analysis!');
                                setShowAnalysisOverlay(false);
                            }
                        })
                        .catch(() => {
                            // Clear saved job ID if it's no longer valid
                            sessionStorage.removeItem('currentJobId');
                        });
                }
            }
        }
    }, [jobId]);

    return (
        <AntApp>
            {contextHolder}
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
                    
                    {/* Only keep the green DOCX button with simplified functionality */}
                    <div style={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        zIndex: 1000
                    }}>
                        <Button
                            type="primary"
                            shape="circle"
                            size="large"
                            style={{
                                width: 60,
                                height: 60,
                                background: '#52c41a',
                                borderColor: '#52c41a',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                            }}
                            icon={<FileTextOutlined style={{ fontSize: '24px' }}/>}
                            onClick={generateSimpleDocx}
                            loading={capturingPdf}
                            title="Generate Word Document Report"
                        />
                    </div>
                    
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
                                        
                                        {/* Overall Score Section */}
                                        <div className="overall-score-section fade-in" style={{ marginBottom: '20px' }}>
                                            <Title level={4}>Overall Assessment</Title>
                                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                                                <Progress 
                                                    className="dashboard-animate"
                                                    type="dashboard" 
                                                    percent={results.percentage} 
                                                    size={120}
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
                                                        {results.strengths.map((strength, index) => {
                                                            // Truncate strengths to max 20 words
                                                            const words = strength.split(' ');
                                                            const truncatedStrength = words.length > 20 
                                                                ? words.slice(0, 20).join(' ') + '...'
                                                                : strength;
                                                            
                                                            return (
                                                                <li className="strength-item" key={index}>{truncatedStrength}</li>
                                                            );
                                                        })}
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
                                                                {/* Format the justification text to highlight citations */}
                                                                {formatTextWithCitations(item.Justification, index)}
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
                                                <Timeline 
                                                    mode="alternate"
                                                    items={plotTimeline.map((event, index) => ({
                                                        key: index,
                                                        color: index % 2 === 0 ? '#722ed1' : '#1890ff',
                                                        dot: index % 2 === 0 ? <FieldTimeOutlined /> : <GlobalOutlined />,
                                                        children: (
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
                                                        )
                                                    }))}
                                                />
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

                                        {/* Plot Arc Analysis - ENHANCED VERSION */}
                                        <div className="visualization-section">
                                            <Title level={4} className="section-heading">
                                                <BookOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
                                                Plot Arc Analysis
                                            </Title>
                                            <Card 
                                                className="plot-arc-card" 
                                                style={{ 
                                                    marginBottom: '30px', 
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                    background: 'linear-gradient(to right bottom, rgba(250, 140, 22, 0.03), white)'
                                                }}
                                            >
                                                <div style={{ marginBottom: '20px', fontSize: '15px', lineHeight: '1.6', color: '#555' }}>
                                                    This analysis breaks down the structural narrative elements of your book, evaluating the effectiveness of various plot arcs.
                                                </div>
                                                <div className="plot-arcs">
                                                    {results.narrativeContext?.plotArcs?.map((arc, index) => (
                                                        <div 
                                                            key={index} 
                                                            className="plot-arc"
                                                            style={{
                                                                padding: '20px',
                                                                borderRadius: '10px',
                                                                background: 'white',
                                                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
                                                                border: '1px solid rgba(250, 140, 22, 0.1)'
                                                            }}
                                                        >
                                                            <div style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                marginBottom: '15px' 
                                                            }}>
                                                                <div style={{ 
                                                                    width: '36px', 
                                                                    height: '36px', 
                                                                    borderRadius: '50%', 
                                                                    background: 'rgba(250, 140, 22, 0.1)', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center', 
                                                                    marginRight: '10px' 
                                                                }}>
                                                                    {index === 0 ? <BookOutlined style={{ color: '#fa8c16' }} /> :
                                                                     index === 1 ? <UserOutlined style={{ color: '#fa8c16' }} /> :
                                                                     <SwapOutlined style={{ color: '#fa8c16' }} />}
                                                                </div>
                                                                <h4 style={{ margin: 0, color: '#fa8c16', fontWeight: 'bold' }}>
                                                                    {arc.type}
                                                                </h4>
                                                            </div>
                                                            
                                                            <div style={{ marginBottom: '15px' }}>
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    justifyContent: 'space-between', 
                                                                    alignItems: 'center', 
                                                                    marginBottom: '5px' 
                                                                }}>
                                                                    <span style={{ fontSize: '14px', color: '#666' }}>Effectiveness:</span>
                                                                    <span style={{ 
                                                                        fontWeight: 'bold', 
                                                                        color: 
                                                                            arc.effectiveness >= 4 ? '#52c41a' : 
                                                                            arc.effectiveness >= 3 ? '#fa8c16' : 
                                                                            '#f5222d' 
                                                                    }}>
                                                                        {arc.effectiveness}/5
                                                                    </span>
                                                                </div>
                                                                <Progress 
                                                                    percent={arc.effectiveness * 20} 
                                                                    strokeColor={{
                                                                        '0%': '#fa8c16',
                                                                        '100%': '#722ed1'
                                                                    }}
                                                                    showInfo={false}
                                                                />
                                                            </div>
                                                            
                                                            <div style={{ 
                                                                padding: '12px',
                                                                backgroundColor: 'rgba(250, 140, 22, 0.03)',
                                                                borderRadius: '8px',
                                                                borderLeft: '3px solid #fa8c16'
                                                            }}>
                                                                <p style={{ 
                                                                    margin: 0,
                                                                    lineHeight: '1.6', 
                                                                    fontSize: '14px',
                                                                    color: '#555'
                                                                }}>
                                                                    {arc.analysis}
                                                                </p>
                                                            </div>
                                                            
                                                            <div style={{ 
                                                                marginTop: '15px', 
                                                                display: 'flex', 
                                                                justifyContent: 'space-between' 
                                                            }}>
                                                                <Tag color="#fa8c16">
                                                                    {index === 0 ? 'Primary' : index === 1 ? 'Character-Driven' : 'Supporting'}
                                                                </Tag>
                                                                <div style={{ 
                                                                    fontSize: '13px', 
                                                                    color: '#999', 
                                                                    fontStyle: 'italic' 
                                                                }}>
                                                                    {arc.effectiveness >= 4 
                                                                        ? 'Well executed' 
                                                                        : arc.effectiveness === 3 
                                                                        ? 'Adequate development' 
                                                                        : 'Needs development'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        </div>

                                        {/* Thematic Development - ENHANCED VERSION */}
                                        <div className="visualization-section">
                                            <Title level={4} className="section-heading">
                                                <BookOutlined style={{ marginRight: 8, color: '#eb2f96' }} />
                                                Thematic Development
                                            </Title>
                                            <Card 
                                                className="themes-card" 
                                                style={{ 
                                                    marginBottom: '30px', 
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                    background: 'linear-gradient(to right bottom, rgba(235, 47, 150, 0.03), white)'
                                                }}
                                            >
                                                <div style={{ marginBottom: '20px', fontSize: '15px', lineHeight: '1.6', color: '#555' }}>
                                                    Analysis of the central themes in your book and how effectively they are developed throughout the narrative.
                                                </div>
                                                <Row gutter={[20, 20]}>
                                                    {results.narrativeContext?.themes?.map((theme, index) => (
                                                        <Col xs={24} md={12} lg={8} key={index}>
                                                            <Card 
                                                                className="theme-card" 
                                                                style={{ 
                                                                    height: '100%',
                                                                    borderRadius: '10px',
                                                                    borderLeft: '3px solid #eb2f96',
                                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                                                    transition: 'all 0.3s ease'
                                                                }}
                                                                bodyStyle={{
                                                                    padding: '20px',
                                                                    height: '100%',
                                                                    display: 'flex',
                                                                    flexDirection: 'column'
                                                                }}
                                                                hoverable
                                                            >
                                                                <div style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    marginBottom: '15px' 
                                                                }}>
                                                                    <div style={{ 
                                                                        width: '36px', 
                                                                        height: '36px', 
                                                                        borderRadius: '50%', 
                                                                        background: 'rgba(235, 47, 150, 0.1)', 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center',
                                                                        marginRight: '10px'
                                                                    }}>
                                                                        <span style={{ 
                                                                            color: '#eb2f96', 
                                                                            fontWeight: 'bold',
                                                                            fontSize: '18px'
                                                                        }}>{index + 1}</span>
                                                                    </div>
                                                                    <h4 style={{ 
                                                                        margin: 0, 
                                                                        color: '#eb2f96', 
                                                                        fontWeight: 'bold',
                                                                        fontSize: '16px'
                                                                    }}>
                                                                        {theme.name}
                                                                    </h4>
                                                                </div>
                                                                
                                                                <div style={{ marginBottom: '15px' }}>
                                                                    <div style={{ 
                                                                        display: 'flex', 
                                                                        justifyContent: 'space-between', 
                                                                        alignItems: 'center',
                                                                        marginBottom: '5px'
                                                                    }}>
                                                                        <span style={{ fontSize: '14px', color: '#666' }}>Strength:</span>
                                                                        <Tag color="#eb2f96">{theme.strength}/5</Tag>
                                                                    </div>
                                                                    <Progress 
                                                                        percent={theme.strength * 20}
                                                                        strokeColor={{
                                                                            '0%': '#eb2f96',
                                                                            '100%': '#722ed1'
                                                                        }}
                                                                        showInfo={false}
                                                                        size="small"
                                                                    />
                                                                </div>
                                                                
                                                                <div style={{
                                                                    padding: '12px',
                                                                    backgroundColor: 'rgba(235, 47, 150, 0.03)',
                                                                    borderRadius: '8px',
                                                                    marginBottom: '15px',
                                                                    flex: 1
                                                                }}>
                                                                    <p style={{ 
                                                                        margin: 0,
                                                                        fontSize: '14px',
                                                                        lineHeight: '1.6',
                                                                        color: '#555'
                                                                    }}>
                                                                        {theme.development}
                                                                    </p>
                                                                </div>
                                                                
                                                                {/* Theme occurrence indicators */}
                                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                    <div 
                                                                        style={{ 
                                                                            width: '10px', 
                                                                            height: '10px', 
                                                                            borderRadius: '50%', 
                                                                            background: '#eb2f96',
                                                                            margin: '0 5px'
                                                                        }}
                                                                        title="Beginning"
                                                                    ></div>
                                                                    <div 
                                                                        style={{ 
                                                                            width: '10px', 
                                                                            height: '10px', 
                                                                            borderRadius: '50%',
                                                                            background: theme.strength >= 3 ? '#eb2f96' : 'rgba(235, 47, 150, 0.3)',
                                                                            margin: '0 5px'
                                                                        }}
                                                                        title="Middle"
                                                                    ></div>
                                                                    <div 
                                                                        style={{ 
                                                                            width: '10px', 
                                                                            height: '10px', 
                                                                            borderRadius: '50%', 
                                                                            background: theme.strength >= 4 ? '#eb2f96' : 'rgba(235, 47, 150, 0.3)',
                                                                            margin: '0 5px'
                                                                        }}
                                                                        title="End"
                                                                    ></div>
                                                                </div>
                                                            </Card>
                                                        </Col>
                                                    ))}
                                                </Row>
                                            </Card>
                                        </div>

                                        <Button 
                                            type="primary"
                                            icon={<FileTextOutlined />}
                                            onClick={generateSimpleDocx}
                                            loading={capturingPdf}
                                            className="pdf-button"
                                            style={{ 
                                                marginTop: '15px',
                                                background: '#52c41a', 
                                                borderColor: '#52c41a',
                                                padding: '8px 16px',
                                                height: 'auto'
                                            }}
                                        >
                                            Generate Word Document
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
                <div className="analyzerOverlay">
                    <style>{animationStyles}</style>
                    <div style={{ maxWidth: '600px', textAlign: 'center' }}>
                        <div className="loader-container">
                            {progress < 100 ? (
                                vercelDeployment ? (
                                    <div className="brain-container">
                                        <div className="brain">🧠</div>
                                        <div className="ai-message">AI Analyzing Book</div>
                                        <div className="thinking-dots">
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="book-loading">
                                        <div className="book">
                                            <div className="page"></div>
                                            <div className="page"></div>
                                            <div className="page"></div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="success-animation">
                                    <div className="checkmark">
                                        <div className="check"></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="processingIndicator">
                            {vercelDeployment ? (
                                <div className="serverless-processing" style={{ 
                                    width: '100%', 
                                    maxWidth: '500px',
                                    margin: '0 auto',
                                    padding: '20px'
                                }}>
                                    {/* Show progress bar in serverless mode too */}
                                    <div className="progressBar" style={{ marginBottom: '15px' }}>
                                        <div 
                                            className="progressFill" 
                                            style={{
                                                width: `${progress}%`,
                                                backgroundColor: progress === 100 ? '#52c41a' : '#1890ff',
                                                transition: 'width 0.8s ease-in-out'
                                            }}
                                        ></div>
                                    </div>
                                    
                                    <div className="statusInfo" style={{ marginBottom: '15px' }}>
                                        <span>{analysisStage}</span>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            opacity: 0.8, 
                                            marginTop: '5px',
                                            color: progress === 100 ? '#52c41a' : '#1890ff'
                                        }}>
                                            {progress}% Complete (Estimate)
                                        </div>
                                    </div>
                                
                                    <div className="funny-loading-messages">
                                        {funnyLoadingMessages.map((message, index) => (
                                            <div 
                                                key={index} 
                                                className={`loading-message ${index === loadingMessageIndex ? 'active' : ''}`}
                                            >
                                                {message}
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div style={{ marginTop: '30px' }}>
                                        <Button 
                                            type="primary" 
                                            onClick={checkForResults} 
                                            style={{ marginRight: '10px' }}
                                        >
                                            Check for Results
                                        </Button>
                                        
                                        <Button 
                                            onClick={() => {
                                                window.location.reload();
                                            }}
                                        >
                                            Restart Analysis
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="progressBar">
                                        <div 
                                            className="progressFill" 
                                            style={{
                                                width: `${progress}%`,
                                                backgroundColor: progress === 100 ? '#52c41a' : '#1890ff'
                                            }}
                                        ></div>
                                    </div>
                                    
                                    <div className="statusInfo">
                                        <span>{analysisStage}</span>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            opacity: 0.8, 
                                            marginTop: '5px',
                                            color: progress === 100 ? '#52c41a' : '#1890ff'
                                        }}>
                                            {progress}% Complete
                                        </div>
                                    </div>

                                    {/* Add emergency restart button */}
                                    {progress > 20 && progress < 95 && (
                                        <Button 
                                            type="primary" 
                                            danger 
                                            onClick={restartInEmergencyMode}
                                            style={{ marginTop: '15px' }}
                                        >
                                            Restart in Emergency Mode
                                        </Button>
                                    )}
                                </>
                            )}
                            
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
                                            <span style={{ color: progress === 100 ? '#52c41a' : '#1890ff' }}>{`>`}</span> {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <Typography.Title level={4} style={{ 
                        color: progress === 100 ? '#52c41a' : '#000000', 
                        marginTop: '20px',
                        transition: 'color 0.5s ease-in-out'
                    }}>
                        {progress === 100 ? 'Analysis Complete!' : vercelDeployment ? 'Processing in the Cloud' : jobId ? 'Analyzing Your Book' : 'Preparing Analysis'}
                    </Typography.Title>
                </div>
            )}
            </div>
        </Layout>
    </ConfigProvider>
    </AntApp>
    );
}